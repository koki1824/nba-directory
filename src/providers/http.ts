/**
 * 外部APIへの問い合わせ（W4-1）。
 *
 * 【なぜ専用の層を作るか】
 * 外部APIは「たまに失敗する」ことを前提に扱う必要がある。
 * 呼び出すたびに毎回リトライや待ち時間を書くと、必ずどこかで書き忘れる。
 * ここに集約して、プロバイダ側は取得の中身に集中する。
 *
 * 【fetch を外から渡す理由】
 * この開発環境から外部へは接続できない（プロキシが遮断する）。
 * 本物のAPIを叩かずに、記録した応答で動きを確かめられるようにする。
 * 本番では省略して、そのまま実行環境の fetch を使う。
 */

export type FetchLike = (url: string, init?: RequestInit) => Promise<Response>;

export type HttpClientOptions = {
  baseUrl: string;
  apiKey: string;
  fetchImpl?: FetchLike;
  /**
   * リクエストの最小間隔（ミリ秒）。
   * レート制限は「1分あたり◯回」で決まるので、間隔を空けて守る。
   * 上限に当たってから待つより、最初から間隔を空けるほうが速い
   * （429 を食らうと Retry-After のぶんだけ止まるため）。
   */
  minIntervalMs?: number;
  /** 失敗したときに何回まで試すか（最初の1回を含む） */
  maxAttempts?: number;
  /** 待ち時間の起点。試行のたびに倍にする */
  baseBackoffMs?: number;
  /** 待つ処理。テストでは即座に返す実装を渡す */
  sleep?: (ms: number) => Promise<void>;
};

export class ApiError extends Error {
  readonly status: number | null;
  readonly url: string;

  constructor(message: string, options: { status?: number | null; url: string }) {
    super(message);
    this.name = "ApiError";
    this.status = options.status ?? null;
    this.url = options.url;
  }
}

/** 応答の形が想定と違うときに投げる。黙って進めない。 */
export class ApiShapeError extends Error {
  constructor(message: string) {
    super(
      `${message}\n` +
        "APIの応答の形が、こちらの想定と違います。\n" +
        "APIの仕様が変わったか、こちらの読み取り方が間違っています。\n" +
        "**そのまま取り込むと、誤ったデータがサイトに載ります。**\n" +
        "src/providers/balldontlie.ts の読み取り部分を、実際の応答に合わせて直してください。",
    );
    this.name = "ApiShapeError";
  }
}

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export class HttpClient {
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly fetchImpl: FetchLike;
  private readonly minIntervalMs: number;
  private readonly maxAttempts: number;
  private readonly baseBackoffMs: number;
  private readonly sleep: (ms: number) => Promise<void>;

  /** 直前のリクエストの時刻。間隔を空けるために持つ */
  private lastRequestAt = 0;
  /** 実際に投げたリクエストの数。ログと検証に使う */
  requestCount = 0;

  constructor(options: HttpClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/$/, "");
    this.apiKey = options.apiKey;
    this.fetchImpl = options.fetchImpl ?? ((url, init) => fetch(url, init));
    this.minIntervalMs = options.minIntervalMs ?? 1200;
    this.maxAttempts = options.maxAttempts ?? 4;
    this.baseBackoffMs = options.baseBackoffMs ?? 1000;
    this.sleep = options.sleep ?? defaultSleep;
  }

  private async waitForSlot(): Promise<void> {
    const elapsed = Date.now() - this.lastRequestAt;
    if (this.lastRequestAt !== 0 && elapsed < this.minIntervalMs) {
      await this.sleep(this.minIntervalMs - elapsed);
    }
    this.lastRequestAt = Date.now();
  }

  /**
   * 1件取得する。
   *
   * リトライするもの:
   *   429（レート制限）… Retry-After があればその秒数、無ければ待ち時間を倍にしていく
   *   5xx（サーバー側の不調）… 一時的なことが多い
   *   通信の失敗 … 同上
   *
   * リトライしないもの:
   *   401 / 403 … キーが違う。何度試しても同じで、待つだけ無駄
   *   404 … 無いものは何度聞いても無い
   *   その他の4xx … こちらの投げ方が間違っている
   */
  async getJson<T>(
    path: string,
    query: Record<string, string | number | undefined> = {},
  ): Promise<T> {
    const url = this.buildUrl(path, query);
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= this.maxAttempts; attempt += 1) {
      await this.waitForSlot();
      this.requestCount += 1;

      let response: Response;
      try {
        response = await this.fetchImpl(url, {
          headers: { Authorization: this.apiKey, Accept: "application/json" },
        });
      } catch (error) {
        // 通信そのものが失敗した。一時的なことが多いので試し直す。
        lastError = error instanceof Error ? error : new Error(String(error));
        if (attempt < this.maxAttempts) {
          await this.sleep(this.baseBackoffMs * 2 ** (attempt - 1));
          continue;
        }
        throw new ApiError(
          `通信に失敗しました（${this.maxAttempts}回試行）: ${lastError.message}`,
          {
            url,
          },
        );
      }

      if (response.ok) {
        try {
          return (await response.json()) as T;
        } catch {
          throw new ApiShapeError("応答をJSONとして読み取れませんでした。");
        }
      }

      // 待てば直る見込みのないものは、その場で止める。
      if (response.status === 401 || response.status === 403) {
        throw new ApiError(
          `APIキーが受け付けられませんでした（${response.status}）。\n` +
            "GitHub Secrets の BALLDONTLIE_API_KEY を確認してください。\n" +
            "契約プランで、このデータを取得できるかも合わせてご確認ください。",
          { status: response.status, url },
        );
      }
      if (response.status === 404) {
        throw new ApiError(`該当のデータがありませんでした（404）。`, {
          status: response.status,
          url,
        });
      }
      if (response.status < 500 && response.status !== 429) {
        throw new ApiError(`リクエストが受け付けられませんでした（${response.status}）。`, {
          status: response.status,
          url,
        });
      }

      // 429 と 5xx は試し直す。
      if (attempt >= this.maxAttempts) {
        throw new ApiError(
          `${response.status} が続いたため中断しました（${this.maxAttempts}回試行）。` +
            (response.status === 429
              ? "\nレート制限に当たっています。取得の間隔を広げるか、時間を空けて再実行してください。"
              : ""),
          { status: response.status, url },
        );
      }

      const waitMs = this.retryDelayMs(response, attempt);
      await this.sleep(waitMs);
    }

    // ここには来ない（ループ内で必ず return か throw する）
    throw new ApiError("予期しない状態です。", { url });
  }

  /**
   * 次に待つ時間。
   * 429 のとき Retry-After があれば必ず従う。相手が指定した時間より
   * 早く投げ直すと、制限がさらに延びることがある。
   */
  private retryDelayMs(response: Response, attempt: number): number {
    const retryAfter = response.headers.get("retry-after");
    if (retryAfter) {
      const seconds = Number(retryAfter);
      if (Number.isFinite(seconds) && seconds >= 0) return seconds * 1000;
    }
    return this.baseBackoffMs * 2 ** (attempt - 1);
  }

  private buildUrl(path: string, query: Record<string, string | number | undefined>): string {
    const url = new URL(`${this.baseUrl}${path.startsWith("/") ? path : `/${path}`}`);
    for (const [key, value] of Object.entries(query)) {
      if (value === undefined) continue;
      url.searchParams.append(key, String(value));
    }
    return url.toString();
  }
}
