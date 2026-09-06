import type {
  DataProvider,
  FetchSeasonStatsParams,
  PlayerRecord,
  ProviderCapabilities,
  SeasonStatRecord,
} from "./types";

/**
 * 自前のサンプルデータを返すプロバイダ（W1-9の骨格）。
 *
 * 10/4 の公開はこれで行う。外部APIに依存しないので、
 * 契約や障害の影響を受けない（08_FEASIBILITY.md §8.3 の保険）。
 *
 * データは自社DBの seed から読む。実際の投入は W2-1。
 * ここでは取得の口だけを用意し、SQLの実行は外から渡してもらう。
 * そうするとDBに繋がずにテストできる。
 */

/** SQLを実行して行を返す関数。DB接続の詳細をこのファイルから切り離すために使う。 */
export type SqlRunner = <T>(sql: string, params?: readonly unknown[]) => Promise<T[]>;

/**
 * seed が提供できる指標。
 *
 * 高度指標（BPM / VORP）は**含めない**。手入力のサンプルに
 * それらしい値を入れると、根拠のない数字が画面に出るため。
 * 含まれない指標は画面に列ごと出ない（Q2 の決定）。
 */
const SEED_CAPABILITIES: ProviderCapabilities = {
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
    "efg_pct",
    "ts_pct",
    "pts_per_36",
    "reb_per_36",
    "ast_per_36",
  ],
  earliestSeason: null,
  supportsPlayoffs: true,
  supportsTeamStats: true,
  supportsStintSplit: true,
};

export function createSeedProvider(run: SqlRunner): DataProvider {
  return {
    id: "seed",
    capabilities: SEED_CAPABILITIES,
    // 自分で用意したデータなので、保存の可否を外部に問う必要がない。
    persistenceAllowed: true,

    async fetchPlayers(): Promise<PlayerRecord[]> {
      return run<PlayerRecord>(
        `select id::text as "externalId",
                full_name_en as "fullNameEn",
                birth_date::text as "birthDate",
                height_cm as "heightCm",
                weight_kg as "weightKg"
         from players
         order by full_name_en`,
      );
    },

    async fetchSeasonStats(params: FetchSeasonStatsParams): Promise<SeasonStatRecord[]> {
      return run<SeasonStatRecord>(
        `select s.player_id::text as "playerExternalId",
                s.season_id as "seasonId",
                s.season_type as "seasonType",
                st.team_id::text as "teamExternalId",
                s.games_played as "gamesPlayed",
                s.minutes as "minutes",
                s.field_goals_made as "fieldGoalsMade",
                s.field_goals_attempted as "fieldGoalsAttempted",
                s.points as "points"
         from player_season_stats s
         left join stints st on st.id = s.stint_id
         where s.season_id = $1 and s.season_type = $2`,
        [params.seasonId, params.seasonType],
      );
    },
  };
}
