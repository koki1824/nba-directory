/**
 * データ取得の共通インターフェース（W1-9）。
 *
 * 要件定義書とオーバーライド v3 が「データ取得を特定APIに直結させず、
 * 必ず Provider Adapter を介す」と定めている。プロバイダを乗り換えても
 * 画面とDBを作り直さずに済むようにするため。
 *
 * 10/4 の公開は SeedProvider（自前のサンプルデータ）で行う。
 * 外部APIへの切り替えは、環境変数を変えるだけで済む（Phase 3）。
 */

/**
 * そのプロバイダが何を提供できるか。
 *
 * 【重要】提供できない指標は、画面に**列ごと出さない**（Q2 の決定）。
 * 空欄を並べると「データが無い」のか「0」なのか利用者に伝わらない。
 */
export type ProviderCapabilities = {
  /** 提供できる指標のコード。metric_definitions.code に対応する */
  readonly metrics: readonly string[];
  /** 取得できる最も古いシーズン。null なら不明 */
  readonly earliestSeason: string | null;
  /** プレーオフの成績を提供できるか */
  readonly supportsPlayoffs: boolean;
  /** チームの公式成績を提供できるか（個人成績の合計で代用してはいけない） */
  readonly supportsTeamStats: boolean;
  /** シーズン途中の移籍を、チーム別に分割して提供できるか */
  readonly supportsStintSplit: boolean;
};

export type ProviderId = "seed" | "balldontlie";

export type PlayerRecord = {
  externalId: string;
  fullNameEn: string;
  birthDate: string | null;
  heightCm: number | null;
  weightKg: number | null;
};

export type SeasonStatRecord = {
  playerExternalId: string;
  seasonId: string;
  seasonType: "regular" | "playoff";
  teamExternalId: string | null;
  gamesPlayed: number | null;
  minutes: number | null;
  /**
   * 実数のみ。率は渡さない。
   * 率はDBのビューで計算する。プロバイダが丸めた率を受け取ると、
   * 「試投0本」と「0%」を区別できなくなるため（オーバーライド §8）。
   */
  fieldGoalsMade: number | null;
  fieldGoalsAttempted: number | null;
  points: number | null;
};

export type FetchSeasonStatsParams = {
  seasonId: string;
  seasonType: "regular" | "playoff";
};

export interface DataProvider {
  readonly id: ProviderId;
  readonly capabilities: ProviderCapabilities;

  /**
   * 取得したデータを自社DBへ永続保存してよいか。
   *
   * 外部プロバイダは契約条件に依存するため、環境変数で明示的に許諾する
   * まで false のままにする。自前のseedは自分のデータなので常に true。
   */
  readonly persistenceAllowed: boolean;

  fetchPlayers(): Promise<PlayerRecord[]>;
  fetchSeasonStats(params: FetchSeasonStatsParams): Promise<SeasonStatRecord[]>;
}

/** その指標をこのプロバイダが提供できるか。画面の列の出し分けに使う。 */
export function supportsMetric(provider: DataProvider, metricCode: string): boolean {
  return provider.capabilities.metrics.includes(metricCode);
}
