// このファイルは自動生成です。手で編集しないでください。
//
// 生成: npm run db:types
// 元:   supabase/migrations/*.sql を適用したデータベースの構造
//
// スキーマを変えたら作り直してください。
// CI が `npm run db:types:check` で、作り直し忘れを検出します。

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

// ---- enum ----
export type ImageReviewState = "pending" | "approved" | "rejected";
export type InquiryCategory = "ad_sponsorship" | "general" | "bug" | "rights_correction";
export type NameJaState = "unset" | "machine" | "human_verified";
export type OverrideTarget = "player" | "team" | "player_season_stats" | "team_season_stats";
export type PositionCode = "G" | "F" | "C" | "G-F" | "F-G" | "F-C" | "C-F";
export type SeasonType = "regular" | "playoff";
export type SyncStatus = "running" | "succeeded" | "failed" | "cancelled";

// ---- テーブル ----
export type AwardsRow = {
  id: string;
  code: string;
  name_en: string;
  name_ja: string | null;
  description_ja: string | null;
  created_at: string;
  updated_at: string;
};
export type AwardsInsert = {
  id?: string;
  code: string;
  name_en: string;
  name_ja?: string | null;
  description_ja?: string | null;
  created_at?: string;
  updated_at?: string;
};
export type AwardsUpdate = Partial<AwardsInsert>;

export type DataSourcesRow = {
  id: string;
  code: string;
  name_ja: string;
  url: string | null;
  attribution_ja: string | null;
  persistence_allowed: boolean;
  created_at: string;
  updated_at: string;
};
export type DataSourcesInsert = {
  id?: string;
  code: string;
  name_ja: string;
  url?: string | null;
  attribution_ja?: string | null;
  persistence_allowed?: boolean;
  created_at?: string;
  updated_at?: string;
};
export type DataSourcesUpdate = Partial<DataSourcesInsert>;

export type FavoritesRow = {
  id: string;
  user_id: string;
  player_id: string | null;
  team_id: string | null;
  created_at: string;
};
export type FavoritesInsert = {
  id?: string;
  user_id: string;
  player_id?: string | null;
  team_id?: string | null;
  created_at?: string;
};
export type FavoritesUpdate = Partial<FavoritesInsert>;

export type FranchisesRow = {
  id: string;
  slug: string;
  created_at: string;
  updated_at: string;
};
export type FranchisesInsert = {
  id?: string;
  slug: string;
  created_at?: string;
  updated_at?: string;
};
export type FranchisesUpdate = Partial<FranchisesInsert>;

export type ImageLicensesRow = {
  code: string;
  name_en: string;
  requires_attribution: boolean;
  is_allowed: boolean;
  note_ja: string | null;
  created_at: string;
};
export type ImageLicensesInsert = {
  code: string;
  name_en: string;
  requires_attribution?: boolean;
  is_allowed?: boolean;
  note_ja?: string | null;
  created_at?: string;
};
export type ImageLicensesUpdate = Partial<ImageLicensesInsert>;

export type InquiriesRow = {
  id: string;
  category: InquiryCategory;
  forwarded_at: string | null;
  forward_succeeded: boolean | null;
  error_message: string | null;
  created_at: string;
};
export type InquiriesInsert = {
  id?: string;
  category: InquiryCategory;
  forwarded_at?: string | null;
  forward_succeeded?: boolean | null;
  error_message?: string | null;
  created_at?: string;
};
export type InquiriesUpdate = Partial<InquiriesInsert>;

export type ManualOverridesRow = {
  id: string;
  target: OverrideTarget;
  target_id: string;
  column_name: string;
  value_text: string | null;
  is_null_override: boolean;
  reason_ja: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};
export type ManualOverridesInsert = {
  id?: string;
  target: OverrideTarget;
  target_id: string;
  column_name: string;
  value_text?: string | null;
  is_null_override?: boolean;
  reason_ja: string;
  created_by?: string | null;
  created_at?: string;
  updated_at?: string;
};
export type ManualOverridesUpdate = Partial<ManualOverridesInsert>;

export type MetricDefinitionsRow = {
  code: string;
  name_ja: string;
  name_en: string;
  unit: string | null;
  decimal_places: number;
  higher_is_better: boolean;
  is_rate: boolean;
  is_advanced: boolean;
  display_order: number;
  created_at: string;
  updated_at: string;
};
export type MetricDefinitionsInsert = {
  code: string;
  name_ja: string;
  name_en: string;
  unit?: string | null;
  decimal_places?: number;
  higher_is_better?: boolean;
  is_rate?: boolean;
  is_advanced?: boolean;
  display_order?: number;
  created_at?: string;
  updated_at?: string;
};
export type MetricDefinitionsUpdate = Partial<MetricDefinitionsInsert>;

export type PageSeoRow = {
  id: string;
  path: string;
  should_index: boolean;
  canonical_path: string | null;
  title_override: string | null;
  description_override: string | null;
  created_at: string;
  updated_at: string;
};
export type PageSeoInsert = {
  id?: string;
  path: string;
  should_index?: boolean;
  canonical_path?: string | null;
  title_override?: string | null;
  description_override?: string | null;
  created_at?: string;
  updated_at?: string;
};
export type PageSeoUpdate = Partial<PageSeoInsert>;

export type PlayerAwardsRow = {
  id: string;
  player_id: string;
  award_id: string;
  season_id: string;
  source_id: string | null;
  created_at: string;
};
export type PlayerAwardsInsert = {
  id?: string;
  player_id: string;
  award_id: string;
  season_id: string;
  source_id?: string | null;
  created_at?: string;
};
export type PlayerAwardsUpdate = Partial<PlayerAwardsInsert>;

export type PlayerImagesRow = {
  id: string;
  player_id: string;
  source_url: string;
  storage_path: string | null;
  license_code: string | null;
  author_text: string | null;
  credit_text: string | null;
  review_state: ImageReviewState;
  reviewed_by: string | null;
  reviewed_at: string | null;
  width: number | null;
  height: number | null;
  created_at: string;
  updated_at: string;
};
export type PlayerImagesInsert = {
  id?: string;
  player_id: string;
  source_url: string;
  storage_path?: string | null;
  license_code?: string | null;
  author_text?: string | null;
  credit_text?: string | null;
  review_state?: ImageReviewState;
  reviewed_by?: string | null;
  reviewed_at?: string | null;
  width?: number | null;
  height?: number | null;
  created_at?: string;
  updated_at?: string;
};
export type PlayerImagesUpdate = Partial<PlayerImagesInsert>;

export type PlayerSeasonStatsRow = {
  id: string;
  player_id: string;
  season_id: string;
  season_type: SeasonType;
  stint_id: string | null;
  games_played: number | null;
  games_started: number | null;
  minutes: number | null;
  field_goals_made: number | null;
  field_goals_attempted: number | null;
  three_pointers_made: number | null;
  three_pointers_attempted: number | null;
  free_throws_made: number | null;
  free_throws_attempted: number | null;
  offensive_rebounds: number | null;
  defensive_rebounds: number | null;
  assists: number | null;
  steals: number | null;
  blocks: number | null;
  turnovers: number | null;
  personal_fouls: number | null;
  points: number | null;
  box_plus_minus: number | null;
  value_over_replacement: number | null;
  source_id: string | null;
  created_at: string;
  updated_at: string;
};
export type PlayerSeasonStatsInsert = {
  id?: string;
  player_id: string;
  season_id: string;
  season_type: SeasonType;
  stint_id?: string | null;
  games_played?: number | null;
  games_started?: number | null;
  minutes?: number | null;
  field_goals_made?: number | null;
  field_goals_attempted?: number | null;
  three_pointers_made?: number | null;
  three_pointers_attempted?: number | null;
  free_throws_made?: number | null;
  free_throws_attempted?: number | null;
  offensive_rebounds?: number | null;
  defensive_rebounds?: number | null;
  assists?: number | null;
  steals?: number | null;
  blocks?: number | null;
  turnovers?: number | null;
  personal_fouls?: number | null;
  points?: number | null;
  box_plus_minus?: number | null;
  value_over_replacement?: number | null;
  source_id?: string | null;
  created_at?: string;
  updated_at?: string;
};
export type PlayerSeasonStatsUpdate = Partial<PlayerSeasonStatsInsert>;

export type PlayersRow = {
  id: string;
  slug: string;
  full_name_en: string;
  first_name_en: string | null;
  last_name_en: string | null;
  full_name_ja: string | null;
  name_ja_state: NameJaState;
  birth_date: string | null;
  height_cm: number | null;
  weight_kg: number | null;
  country: string | null;
  position: PositionCode | null;
  jersey_number: number | null;
  draft_year: number | null;
  draft_round: number | null;
  draft_pick: number | null;
  is_active: boolean;
  representative_franchise_id: string | null;
  wikidata_qid: string | null;
  created_at: string;
  updated_at: string;
};
export type PlayersInsert = {
  id?: string;
  slug: string;
  full_name_en: string;
  first_name_en?: string | null;
  last_name_en?: string | null;
  full_name_ja?: string | null;
  name_ja_state?: NameJaState;
  birth_date?: string | null;
  height_cm?: number | null;
  weight_kg?: number | null;
  country?: string | null;
  position?: PositionCode | null;
  jersey_number?: number | null;
  draft_year?: number | null;
  draft_round?: number | null;
  draft_pick?: number | null;
  is_active?: boolean;
  representative_franchise_id?: string | null;
  wikidata_qid?: string | null;
  created_at?: string;
  updated_at?: string;
};
export type PlayersUpdate = Partial<PlayersInsert>;

export type ProviderEntityIdsRow = {
  id: string;
  source_id: string;
  entity_type: string;
  internal_id: string;
  provider_id: string;
  created_at: string;
};
export type ProviderEntityIdsInsert = {
  id?: string;
  source_id: string;
  entity_type: string;
  internal_id: string;
  provider_id: string;
  created_at?: string;
};
export type ProviderEntityIdsUpdate = Partial<ProviderEntityIdsInsert>;

export type RankingRulesRow = {
  id: string;
  season_id: string | null;
  metric_code: string;
  season_type: SeasonType;
  minimum_games: number | null;
  minimum_minutes: number | null;
  minimum_per_game: number | null;
  allows_official_exception: boolean;
  note_ja: string | null;
  created_at: string;
  updated_at: string;
};
export type RankingRulesInsert = {
  id?: string;
  season_id?: string | null;
  metric_code: string;
  season_type: SeasonType;
  minimum_games?: number | null;
  minimum_minutes?: number | null;
  minimum_per_game?: number | null;
  allows_official_exception?: boolean;
  note_ja?: string | null;
  created_at?: string;
  updated_at?: string;
};
export type RankingRulesUpdate = Partial<RankingRulesInsert>;

export type RankingSnapshotsRow = {
  id: string;
  season_id: string;
  season_type: SeasonType;
  metric_code: string;
  player_id: string | null;
  team_id: string | null;
  rank: number;
  value: number | null;
  captured_on: string;
  created_at: string;
};
export type RankingSnapshotsInsert = {
  id?: string;
  season_id: string;
  season_type: SeasonType;
  metric_code: string;
  player_id?: string | null;
  team_id?: string | null;
  rank: number;
  value?: number | null;
  captured_on?: string;
  created_at?: string;
};
export type RankingSnapshotsUpdate = Partial<RankingSnapshotsInsert>;

export type SeasonsRow = {
  id: string;
  start_year: number;
  end_year: number;
  regular_season_start_date: string | null;
  scheduled_games: number | null;
  is_shortened: boolean;
  created_at: string;
  updated_at: string;
};
export type SeasonsInsert = {
  id: string;
  start_year: number;
  end_year: number;
  regular_season_start_date?: string | null;
  scheduled_games?: number | null;
  is_shortened?: boolean;
  created_at?: string;
  updated_at?: string;
};
export type SeasonsUpdate = Partial<SeasonsInsert>;

export type StintsRow = {
  id: string;
  player_id: string;
  season_id: string;
  team_id: string;
  stint_order: number;
  started_on: string | null;
  ended_on: string | null;
  created_at: string;
  updated_at: string;
};
export type StintsInsert = {
  id?: string;
  player_id: string;
  season_id: string;
  team_id: string;
  stint_order?: number;
  started_on?: string | null;
  ended_on?: string | null;
  created_at?: string;
  updated_at?: string;
};
export type StintsUpdate = Partial<StintsInsert>;

export type SyncRunsRow = {
  id: string;
  source_id: string;
  status: SyncStatus;
  target_season_from: string | null;
  target_season_to: string | null;
  started_at: string;
  finished_at: string | null;
  records_read: number;
  records_written: number;
  error_message: string | null;
  created_at: string;
};
export type SyncRunsInsert = {
  id?: string;
  source_id: string;
  status?: SyncStatus;
  target_season_from?: string | null;
  target_season_to?: string | null;
  started_at?: string;
  finished_at?: string | null;
  records_read?: number;
  records_written?: number;
  error_message?: string | null;
  created_at?: string;
};
export type SyncRunsUpdate = Partial<SyncRunsInsert>;

export type TeamSeasonStatsRow = {
  id: string;
  team_id: string;
  season_id: string;
  season_type: SeasonType;
  games_played: number | null;
  wins: number | null;
  losses: number | null;
  points_for: number | null;
  points_against: number | null;
  field_goals_made: number | null;
  field_goals_attempted: number | null;
  three_pointers_made: number | null;
  three_pointers_attempted: number | null;
  free_throws_made: number | null;
  free_throws_attempted: number | null;
  offensive_rebounds: number | null;
  defensive_rebounds: number | null;
  assists: number | null;
  steals: number | null;
  blocks: number | null;
  turnovers: number | null;
  source_id: string | null;
  created_at: string;
  updated_at: string;
};
export type TeamSeasonStatsInsert = {
  id?: string;
  team_id: string;
  season_id: string;
  season_type: SeasonType;
  games_played?: number | null;
  wins?: number | null;
  losses?: number | null;
  points_for?: number | null;
  points_against?: number | null;
  field_goals_made?: number | null;
  field_goals_attempted?: number | null;
  three_pointers_made?: number | null;
  three_pointers_attempted?: number | null;
  free_throws_made?: number | null;
  free_throws_attempted?: number | null;
  offensive_rebounds?: number | null;
  defensive_rebounds?: number | null;
  assists?: number | null;
  steals?: number | null;
  blocks?: number | null;
  turnovers?: number | null;
  source_id?: string | null;
  created_at?: string;
  updated_at?: string;
};
export type TeamSeasonStatsUpdate = Partial<TeamSeasonStatsInsert>;

export type TeamsRow = {
  id: string;
  franchise_id: string;
  name_en: string;
  name_ja: string | null;
  abbreviation: string;
  city_en: string | null;
  city_ja: string | null;
  conference: string | null;
  division: string | null;
  effective_from_season_id: string | null;
  effective_to_season_id: string | null;
  primary_color: string | null;
  secondary_color: string | null;
  created_at: string;
  updated_at: string;
};
export type TeamsInsert = {
  id?: string;
  franchise_id: string;
  name_en: string;
  name_ja?: string | null;
  abbreviation: string;
  city_en?: string | null;
  city_ja?: string | null;
  conference?: string | null;
  division?: string | null;
  effective_from_season_id?: string | null;
  effective_to_season_id?: string | null;
  primary_color?: string | null;
  secondary_color?: string | null;
  created_at?: string;
  updated_at?: string;
};
export type TeamsUpdate = Partial<TeamsInsert>;

// ---- ビュー（読み取り専用） ----
export type PlayerCareerStatsRow = {
  player_id: string | null;
  season_type: SeasonType | null;
  seasons_played: number | null;
  games_played: number | null;
  games_started: number | null;
  minutes: number | null;
  field_goals_made: number | null;
  field_goals_attempted: number | null;
  three_pointers_made: number | null;
  three_pointers_attempted: number | null;
  free_throws_made: number | null;
  free_throws_attempted: number | null;
  offensive_rebounds: number | null;
  defensive_rebounds: number | null;
  assists: number | null;
  steals: number | null;
  blocks: number | null;
  turnovers: number | null;
  points: number | null;
  field_goal_pct: number | null;
  three_point_pct: number | null;
  free_throw_pct: number | null;
  effective_field_goal_pct: number | null;
  true_shooting_pct: number | null;
  points_per_game: number | null;
  rebounds_per_game: number | null;
  assists_per_game: number | null;
  steals_per_game: number | null;
  blocks_per_game: number | null;
  turnovers_per_game: number | null;
  minutes_per_game: number | null;
};

export type PlayerOverridesRow = {
  target_id: string | null;
  ov: Json | null;
};

export type PlayerPercentilesRow = {
  player_id: string | null;
  season_id: string | null;
  season_type: SeasonType | null;
  metric_code: string | null;
  value: number | null;
  is_qualified: boolean | null;
  population: number | null;
  percentile: number | null;
};

export type PlayerRankingsRow = {
  player_id: string | null;
  season_id: string | null;
  season_type: SeasonType | null;
  metric_code: string | null;
  value: number | null;
  games_played: number | null;
  minutes: number | null;
  minimum_games: number | null;
  minimum_minutes: number | null;
  allows_official_exception: boolean | null;
  higher_is_better: boolean | null;
  is_qualified: boolean | null;
  rank: number | null;
};

export type PlayerSeasonMetricsRow = {
  player_id: string | null;
  season_id: string | null;
  season_type: SeasonType | null;
  games_played: number | null;
  minutes: number | null;
  metric_code: string | null;
  value: number | null;
};

export type PlayerSeasonStatsDerivedRow = {
  id: string | null;
  player_id: string | null;
  season_id: string | null;
  season_type: SeasonType | null;
  stint_id: string | null;
  games_played: number | null;
  games_started: number | null;
  minutes: number | null;
  field_goals_made: number | null;
  field_goals_attempted: number | null;
  three_pointers_made: number | null;
  three_pointers_attempted: number | null;
  free_throws_made: number | null;
  free_throws_attempted: number | null;
  offensive_rebounds: number | null;
  defensive_rebounds: number | null;
  assists: number | null;
  steals: number | null;
  blocks: number | null;
  turnovers: number | null;
  personal_fouls: number | null;
  points: number | null;
  box_plus_minus: number | null;
  value_over_replacement: number | null;
  source_id: string | null;
  has_manual_override: boolean | null;
  total_rebounds: number | null;
  field_goal_pct: number | null;
  three_point_pct: number | null;
  free_throw_pct: number | null;
  effective_field_goal_pct: number | null;
  true_shooting_pct: number | null;
  points_per_game: number | null;
  rebounds_per_game: number | null;
  assists_per_game: number | null;
  steals_per_game: number | null;
  blocks_per_game: number | null;
  turnovers_per_game: number | null;
  minutes_per_game: number | null;
  points_per_36: number | null;
  rebounds_per_36: number | null;
  assists_per_36: number | null;
  steals_per_36: number | null;
  blocks_per_36: number | null;
};

export type PlayerSeasonStatsEffectiveRow = {
  id: string | null;
  player_id: string | null;
  season_id: string | null;
  season_type: SeasonType | null;
  stint_id: string | null;
  games_played: number | null;
  games_started: number | null;
  minutes: number | null;
  field_goals_made: number | null;
  field_goals_attempted: number | null;
  three_pointers_made: number | null;
  three_pointers_attempted: number | null;
  free_throws_made: number | null;
  free_throws_attempted: number | null;
  offensive_rebounds: number | null;
  defensive_rebounds: number | null;
  assists: number | null;
  steals: number | null;
  blocks: number | null;
  turnovers: number | null;
  personal_fouls: number | null;
  points: number | null;
  box_plus_minus: number | null;
  value_over_replacement: number | null;
  source_id: string | null;
  has_manual_override: boolean | null;
};

export type PlayersEffectiveRow = {
  id: string | null;
  slug: string | null;
  full_name_en: string | null;
  full_name_ja: string | null;
  name_ja_state: NameJaState | null;
  birth_date: string | null;
  height_cm: number | null;
  weight_kg: number | null;
  position: PositionCode | null;
  jersey_number: number | null;
  country: string | null;
  draft_year: number | null;
  draft_round: number | null;
  draft_pick: number | null;
  is_active: boolean | null;
  representative_franchise_id: string | null;
  wikidata_qid: string | null;
  has_manual_override: boolean | null;
};

export type PssOverridesRow = {
  target_id: string | null;
  ov: Json | null;
};

export type TeamOverridesRow = {
  target_id: string | null;
  ov: Json | null;
};

export type TeamRostersRow = {
  team_id: string | null;
  season_id: string | null;
  player_id: string | null;
  stint_order: number | null;
  started_on: string | null;
  ended_on: string | null;
  player_slug: string | null;
  full_name_en: string | null;
  full_name_ja: string | null;
  position: PositionCode | null;
  jersey_number: number | null;
  height_cm: number | null;
  weight_kg: number | null;
  birth_date: string | null;
  age_at_season_start: number | null;
  team_name_en: string | null;
  team_name_ja: string | null;
  team_abbreviation: string | null;
};

export type TeamsEffectiveRow = {
  id: string | null;
  franchise_id: string | null;
  name_en: string | null;
  name_ja: string | null;
  abbreviation: string | null;
  city_en: string | null;
  city_ja: string | null;
  conference: string | null;
  division: string | null;
  effective_from_season_id: string | null;
  effective_to_season_id: string | null;
  primary_color: string | null;
  secondary_color: string | null;
  has_manual_override: boolean | null;
};

// ---- 名前の一覧 ----
export type TableName = "awards" | "data_sources" | "favorites" | "franchises" | "image_licenses" | "inquiries" | "manual_overrides" | "metric_definitions" | "page_seo" | "player_awards" | "player_images" | "player_season_stats" | "players" | "provider_entity_ids" | "ranking_rules" | "ranking_snapshots" | "seasons" | "stints" | "sync_runs" | "team_season_stats" | "teams";
export type ViewName = "player_career_stats" | "player_overrides" | "player_percentiles" | "player_rankings" | "player_season_metrics" | "player_season_stats_derived" | "player_season_stats_effective" | "players_effective" | "pss_overrides" | "team_overrides" | "team_rosters" | "teams_effective";

