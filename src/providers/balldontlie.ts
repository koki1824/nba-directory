import { ApiShapeError, HttpClient, type FetchLike } from "./http";
import type {
  DataProvider,
  FetchSeasonStatsParams,
  PlayerRecord,
  ProviderCapabilities,
  SeasonStatRecord,
} from "./types";

/**
 * BALLDONTLIE からデータを取る（W4-1）。
 *
 * ⚠️ **応答の形は実際のAPIで確認していません。**
 * この開発環境から外部へ接続できないためです（プロキシが遮断する）。
 * 下の読み取りは公開ドキュメントの記述に沿って書いた**想定**であり、
 * 実物と違う可能性があります。
 *
 * そのため、**想定と違う形が来たら黙って取り込まず、止めます。**
 * 誤ったデータをサイトに載せるより、取り込まないほうがましだからです。
 *
 * 最初の実行の前に `npm run probe:api` を実行してください。
 * 実際の応答の形を表示するので、それに合わせてここを直します。
 * 「たぶんこうだろう」で本番のデータを作らないための手順です。
 */

/**
 * エンドポイントとパラメータ。
 * 実物に合わせて直すときは、まずここを見る。
 */
export const BALLDONTLIE = {
  baseUrl: "https://api.balldontlie.io/v1",
  endpoints: {
    players: "/players",
    seasonAverages: "/season_averages",
    teams: "/teams",
  },
  /** 1ページあたりの件数。大きくすると総リクエスト数が減る */
  perPage: 100,
} as const;

/**
 * このプロバイダが提供できるもの。
 *
 * ⚠️ **契約プランによって取得できる範囲が変わります。**
 * 無料枠では選手一覧しか取れず、成績は有料、ということがあり得ます。
 * 実際に何が取れるかはキーを入れて `npm run probe:api` で確認します。
 * ここは「取れたら使う」つもりの一覧であって、取れることの保証ではありません。
 */
export const BALLDONTLIE_CAPABILITIES: ProviderCapabilities = {
  metrics: [
    "pts_per_game",
    "reb_per_game",
    "ast_per_game",
    "stl_per_game",
    "blk_per_game",
    "tov_per_game",
    "min_per_game",
    "fg_pct",
    "fg3_pct",
    "ft_pct",
  ],
  earliestSeason: null,
  supportsPlayoffs: false,
  supportsTeamStats: false,
  // シーズン途中の移籍をチーム別に分けて取れるかは未確認。
  // 確認できるまで false にしておく。true にして取れなければ、
  // 移籍した選手の成績が片方のチームに丸ごと付く形で壊れる。
  supportsStintSplit: false,
};

// --- 応答の読み取り -----------------------------------------------------------
//
// どの項目も「あるはず」と決めつけず、確かめてから使う。
// 想定と違えば、実際に来たキーを添えて止める。

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function describeKeys(value: unknown): string {
  if (!isRecord(value)) return `（オブジェクトではありません: ${typeof value}）`;
  const keys = Object.keys(value);
  return keys.length > 0 ? keys.join(", ") : "（キーがありません）";
}

/** 必須の文字列。数値で来ても文字列にして受ける（IDが数値のことがあるため）。 */
function requireId(row: Record<string, unknown>, key: string, context: string): string {
  const value = row[key];
  if (typeof value === "string" && value.length > 0) return value;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  throw new ApiShapeError(
    `${context}: "${key}" が見つかりません。実際に来たキー: ${describeKeys(row)}`,
  );
}

function requireString(row: Record<string, unknown>, key: string, context: string): string {
  const value = row[key];
  if (typeof value === "string") return value;
  throw new ApiShapeError(
    `${context}: "${key}" が文字列ではありません。実際に来たキー: ${describeKeys(row)}`,
  );
}

/**
 * 任意の数値。
 *
 * 【重要】読み取れない値は null にする。0 にしない。
 * 「取れなかった」を 0 として保存すると、記録が無いだけの選手が
 * 「0本の選手」としてサイトに載る（オーバーライド v3 §8）。
 */
function optionalNumber(row: Record<string, unknown>, key: string): number | null {
  return toFiniteNumber(row[key]);
}

/** 一覧の入れ物。data 配列と、次ページの手がかりを取り出す。 */
function readList(
  payload: unknown,
  context: string,
): { rows: Record<string, unknown>[]; nextCursor: string | null } {
  if (!isRecord(payload)) {
    throw new ApiShapeError(`${context}: 応答がオブジェクトではありません。`);
  }
  const data = payload.data;
  if (!Array.isArray(data)) {
    throw new ApiShapeError(
      `${context}: "data" が配列ではありません。実際に来たキー: ${describeKeys(payload)}`,
    );
  }

  const rows = data.filter(isRecord);
  if (rows.length !== data.length) {
    throw new ApiShapeError(`${context}: "data" にオブジェクトでない要素が混ざっています。`);
  }

  // 次ページの手がかり。無ければ最後のページ。
  const meta = isRecord(payload.meta) ? payload.meta : {};
  const cursor = meta.next_cursor;
  const nextCursor =
    cursor === null || cursor === undefined
      ? null
      : typeof cursor === "number"
        ? String(cursor)
        : typeof cursor === "string" && cursor.length > 0
          ? cursor
          : null;

  return { rows, nextCursor };
}

/**
 * 数値として読めるなら数値、読めなければ null。
 *
 * 【なぜ自前で書くか】
 * `Number(null)` は 0、`Number("")` も 0 になる。
 * 素直に Number() へ渡すと、**値が無いことが 0 という数値に化ける。**
 * 身長が取れなかった選手が「0cm」としてサイトに載る。
 * ここで「無い」を確実に null にする。
 */
function toFiniteNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "boolean") return null;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

/** フィート・インチの身長をセンチにする。取れなければ null。 */
export function heightToCm(feet: unknown, inches: unknown): number | null {
  const f = toFiniteNumber(feet);
  if (f === null) return null;
  const i = toFiniteNumber(inches) ?? 0;
  return Math.round((f * 12 + i) * 2.54);
}

/** ポンドをキログラムにする。取れなければ null。 */
export function poundsToKg(pounds: unknown): number | null {
  const lb = toFiniteNumber(pounds);
  if (lb === null || lb <= 0) return null;
  return Math.round(lb * 0.45359237);
}

/** "2024-25" → 2024。APIはシーズンを開始年の数値で受けることが多い。 */
export function seasonStartYear(seasonId: string): number {
  const year = Number(seasonId.slice(0, 4));
  if (!Number.isFinite(year)) {
    throw new Error(`シーズンの指定が正しくありません: ${seasonId}`);
  }
  return year;
}

// --- プロバイダ ---------------------------------------------------------------

export type BalldontlieOptions = {
  apiKey: string;
  persistenceAllowed: boolean;
  fetchImpl?: FetchLike;
  sleep?: (ms: number) => Promise<void>;
  minIntervalMs?: number;
  /** 取得を打ち切る上限。暴走して延々と叩き続けるのを防ぐ */
  maxPages?: number;
};

export class BalldontlieProvider implements DataProvider {
  readonly id = "balldontlie" as const;
  readonly capabilities = BALLDONTLIE_CAPABILITIES;
  readonly persistenceAllowed: boolean;

  private readonly http: HttpClient;
  private readonly maxPages: number;

  constructor(options: BalldontlieOptions) {
    this.persistenceAllowed = options.persistenceAllowed;
    this.maxPages = options.maxPages ?? 100;
    this.http = new HttpClient({
      baseUrl: BALLDONTLIE.baseUrl,
      apiKey: options.apiKey,
      ...(options.fetchImpl ? { fetchImpl: options.fetchImpl } : {}),
      ...(options.sleep ? { sleep: options.sleep } : {}),
      ...(options.minIntervalMs !== undefined ? { minIntervalMs: options.minIntervalMs } : {}),
    });
  }

  get requestCount(): number {
    return this.http.requestCount;
  }

  /**
   * 全ページを取る。
   *
   * 上限を設けているのは、次ページの手がかりが返り続ける不具合に当たったときに
   * 延々と叩き続けないため。レート制限を使い切ると他の取得もできなくなる。
   */
  private async *paginate(
    path: string,
    query: Record<string, string | number | undefined>,
    context: string,
  ): AsyncGenerator<Record<string, unknown>[]> {
    let cursor: string | undefined;
    const seen = new Set<string>();

    for (let page = 0; page < this.maxPages; page += 1) {
      const payload = await this.http.getJson<unknown>(path, {
        ...query,
        per_page: BALLDONTLIE.perPage,
        cursor,
      });
      const { rows, nextCursor } = readList(payload, context);
      yield rows;

      if (nextCursor === null) return;
      // 同じ手がかりが返ってきたら、進んでいないので止める。
      if (seen.has(nextCursor)) {
        throw new ApiShapeError(
          `${context}: 次ページの手がかりが同じ値を繰り返しています（${nextCursor}）。`,
        );
      }
      seen.add(nextCursor);
      cursor = nextCursor;
    }

    throw new ApiShapeError(
      `${context}: ページ数が上限（${this.maxPages}）に達しました。取得条件を見直してください。`,
    );
  }

  async fetchPlayers(): Promise<PlayerRecord[]> {
    const players: PlayerRecord[] = [];

    for await (const rows of this.paginate(BALLDONTLIE.endpoints.players, {}, "選手一覧")) {
      for (const row of rows) {
        const first = requireString(row, "first_name", "選手一覧");
        const last = requireString(row, "last_name", "選手一覧");

        players.push({
          externalId: requireId(row, "id", "選手一覧"),
          fullNameEn: `${first} ${last}`.trim(),
          // 生年月日は返らないことがある。無ければ null。
          // 年齢の計算に使うので、推測で埋めない。
          birthDate: typeof row.birthdate === "string" ? row.birthdate.slice(0, 10) : null,
          heightCm: heightToCm(row.height_feet, row.height_inches),
          weightKg: poundsToKg(row.weight_pounds),
        });
      }
    }

    return players;
  }

  /**
   * シーズン成績。
   *
   * ⚠️ プレーオフは capabilities で false にしている。
   * 取れると確認できるまで、要求されたら明示的に断る。
   * 黙ってレギュラーシーズンの値を返すと、
   * プレーオフの欄にレギュラーの数字が載る。
   */
  async fetchSeasonStats(params: FetchSeasonStatsParams): Promise<SeasonStatRecord[]> {
    if (params.seasonType === "playoff" && !this.capabilities.supportsPlayoffs) {
      throw new Error(
        "このプロバイダはプレーオフの成績に対応していません。\n" +
          "取得できることを確認したら capabilities.supportsPlayoffs を true にしてください。",
      );
    }

    const season = seasonStartYear(params.seasonId);
    const stats: SeasonStatRecord[] = [];

    for await (const rows of this.paginate(
      BALLDONTLIE.endpoints.seasonAverages,
      { season },
      "シーズン成績",
    )) {
      for (const row of rows) {
        stats.push({
          playerExternalId: requireId(row, "player_id", "シーズン成績"),
          seasonId: params.seasonId,
          seasonType: params.seasonType,
          // どのチームでの成績かは、この応答からは分からないことがある。
          // 分からないものを埋めずに null で返す。
          teamExternalId: null,
          gamesPlayed: optionalNumber(row, "games_played"),
          minutes: parseMinutes(row.min),
          // 率ではなく実数を返す（オーバーライド v3 §8）。
          // 率だけしか取れない場合は、ここで実数に戻せないので null にする。
          fieldGoalsMade: optionalNumber(row, "fgm"),
          fieldGoalsAttempted: optionalNumber(row, "fga"),
          points: optionalNumber(row, "pts"),
        });
      }
    }

    return stats;
  }
}

/**
 * 出場時間。"32:15" のような形で返ることがある。
 * 読み取れなければ null。0 にしない。
 */
export function parseMinutes(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string" || value.length === 0) return null;

  const parts = value.split(":");
  if (parts.length === 2) {
    const minutes = Number(parts[0]);
    const seconds = Number(parts[1]);
    if (!Number.isFinite(minutes) || !Number.isFinite(seconds)) return null;
    return Math.round((minutes + seconds / 60) * 10) / 10;
  }

  return toFiniteNumber(value);
}
