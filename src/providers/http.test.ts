import { describe, expect, it, vi } from "vitest";

import { ApiError, ApiShapeError, HttpClient, type FetchLike } from "./http";

/**
 * 外部APIの扱い方を確かめる。
 *
 * 本物のAPIは叩かない（この環境から外部へ接続できない）。
 * 応答を差し替えて、失敗したときの振る舞いを固定する。
 */

function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
    ...init,
  });
}

/** 呼ばれた順に応答を返す fetch。 */
function scriptedFetch(responses: (Response | Error)[]): { fetch: FetchLike; calls: string[] } {
  const calls: string[] = [];
  let i = 0;
  const fetchImpl: FetchLike = async (url) => {
    calls.push(url);
    const next = responses[Math.min(i, responses.length - 1)];
    i += 1;
    if (next instanceof Error) throw next;
    return next!;
  };
  return { fetch: fetchImpl, calls };
}

function client(responses: (Response | Error)[], overrides = {}) {
  const { fetch: fetchImpl, calls } = scriptedFetch(responses);
  const sleeps: number[] = [];
  const c = new HttpClient({
    baseUrl: "https://api.example.test/v1",
    apiKey: "test-key",
    fetchImpl,
    // テストでは待たない。待ち時間は記録して確かめる。
    sleep: async (ms) => {
      sleeps.push(ms);
    },
    minIntervalMs: 0,
    baseBackoffMs: 100,
    ...overrides,
  });
  return { c, calls, sleeps };
}

describe("正常系", () => {
  it("JSONを取得できる", async () => {
    const { c } = client([jsonResponse({ data: [{ id: 1 }] })]);

    expect(await c.getJson("/players")).toEqual({ data: [{ id: 1 }] });
  });

  it("APIキーを Authorization ヘッダで送る", async () => {
    let sentHeaders: HeadersInit | undefined;
    const c = new HttpClient({
      baseUrl: "https://api.example.test/v1",
      apiKey: "secret-key",
      minIntervalMs: 0,
      fetchImpl: async (_url, init) => {
        sentHeaders = init?.headers;
        return jsonResponse({});
      },
    });

    await c.getJson("/players");

    expect((sentHeaders as Record<string, string>).Authorization).toBe("secret-key");
  });

  it("クエリを組み立てる（未指定は付けない）", async () => {
    const { c, calls } = client([jsonResponse({})]);

    await c.getJson("/stats", { season: 2024, per_page: 100, cursor: undefined });

    expect(calls[0]).toContain("season=2024");
    expect(calls[0]).toContain("per_page=100");
    expect(calls[0]).not.toContain("cursor");
  });
});

describe("レート制限（429）", () => {
  it("Retry-After に従って待ってから試し直す", async () => {
    // 相手が指定した時間より早く投げ直すと、制限がさらに延びることがある。
    const { c, sleeps } = client([
      jsonResponse({}, { status: 429, headers: { "retry-after": "3" } }),
      jsonResponse({ ok: true }),
    ]);

    expect(await c.getJson("/players")).toEqual({ ok: true });
    expect(sleeps).toContain(3000);
  });

  it("Retry-After が無ければ待ち時間を倍にしていく", async () => {
    const { c, sleeps } = client([
      jsonResponse({}, { status: 429 }),
      jsonResponse({}, { status: 429 }),
      jsonResponse({ ok: true }),
    ]);

    await c.getJson("/players");

    expect(sleeps).toEqual([100, 200]);
  });

  it("続くようなら諦めて、次にどうすればよいかを伝える", async () => {
    const { c } = client([jsonResponse({}, { status: 429 })], { maxAttempts: 3 });

    await expect(c.getJson("/players")).rejects.toThrow(/レート制限/);
  });

  it("リクエストの最小間隔を空ける", async () => {
    // 上限に当たってから待つより、最初から間隔を空けるほうが速い。
    const { c, sleeps } = client([jsonResponse({}), jsonResponse({})], { minIntervalMs: 500 });

    await c.getJson("/a");
    await c.getJson("/b");

    expect(sleeps.some((ms) => ms > 0 && ms <= 500)).toBe(true);
  });
});

describe("サーバー側の不調（5xx）", () => {
  it("試し直して、回復すれば成功する", async () => {
    const { c, calls } = client([jsonResponse({}, { status: 503 }), jsonResponse({ ok: true })]);

    expect(await c.getJson("/players")).toEqual({ ok: true });
    expect(calls).toHaveLength(2);
  });

  it("回数を使い切ったら止める", async () => {
    const { c, calls } = client([jsonResponse({}, { status: 500 })], { maxAttempts: 3 });

    await expect(c.getJson("/players")).rejects.toThrow(ApiError);
    expect(calls).toHaveLength(3);
  });
});

describe("試し直さないもの", () => {
  it("401 は即座に止め、キーの確認を促す", async () => {
    // 何度試しても同じ。待つだけ無駄。
    const { c, calls } = client([jsonResponse({}, { status: 401 })]);

    await expect(c.getJson("/players")).rejects.toThrow(/APIキー/);
    expect(calls).toHaveLength(1);
  });

  it("403 も同じ（契約プランの確認も促す）", async () => {
    const { c } = client([jsonResponse({}, { status: 403 })]);

    await expect(c.getJson("/players")).rejects.toThrow(/契約プラン/);
  });

  it("404 は即座に止める", async () => {
    const { c, calls } = client([jsonResponse({}, { status: 404 })]);

    await expect(c.getJson("/players")).rejects.toThrow(ApiError);
    expect(calls).toHaveLength(1);
  });

  it("400 も即座に止める（こちらの投げ方の誤り）", async () => {
    const { c, calls } = client([jsonResponse({}, { status: 400 })]);

    await expect(c.getJson("/players")).rejects.toThrow(ApiError);
    expect(calls).toHaveLength(1);
  });
});

describe("通信の失敗", () => {
  it("試し直して、回復すれば成功する", async () => {
    const { c } = client([new Error("ECONNRESET"), jsonResponse({ ok: true })]);

    expect(await c.getJson("/players")).toEqual({ ok: true });
  });

  it("回数を使い切ったら、原因を添えて止める", async () => {
    const { c } = client([new Error("ECONNRESET")], { maxAttempts: 2 });

    await expect(c.getJson("/players")).rejects.toThrow(/ECONNRESET/);
  });
});

describe("応答の形", () => {
  it("JSONとして読めなければ、黙って進めずに止める", async () => {
    const broken = new Response("<html>error</html>", {
      status: 200,
      headers: { "content-type": "text/html" },
    });
    const { c } = client([broken]);

    await expect(c.getJson("/players")).rejects.toThrow(ApiShapeError);
  });

  it("形が違うときのメッセージが、何をすべきか伝える", async () => {
    const broken = new Response("not json", { status: 200 });
    const { c } = client([broken]);

    await expect(c.getJson("/players")).rejects.toThrow(/誤ったデータがサイトに載ります/);
  });
});

describe("リクエスト数の記録", () => {
  it("実際に投げた数を数える（試し直しも含む）", async () => {
    const { c } = client([jsonResponse({}, { status: 500 }), jsonResponse({ ok: true })]);

    await c.getJson("/players");

    expect(c.requestCount).toBe(2);
  });
});

describe("待つ処理", () => {
  it("既定では実際に待つ（テストでは差し替える）", async () => {
    vi.useFakeTimers();
    const c = new HttpClient({
      baseUrl: "https://api.example.test/v1",
      apiKey: "k",
      minIntervalMs: 0,
      fetchImpl: async () => jsonResponse({ ok: true }),
    });

    const promise = c.getJson("/players");
    await vi.runAllTimersAsync();

    expect(await promise).toEqual({ ok: true });
    vi.useRealTimers();
  });
});
