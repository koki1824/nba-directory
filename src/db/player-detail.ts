import { query, queryOne } from "./client";
import { toNumber } from "./players";

/**
 * 選手ページの問い合わせ（W2-6）。
 *
 * 【シーズン別の行について】
 * `stint_id` が入っている行は、シーズン途中の移籍で分割された内訳。
 * シーズン合計行と中身が重なるので、**表では分けて扱う**。
 * 素直に並べると同じシーズンが2回出て、合計と内訳の区別がつかない。
 */

export type PlayerProfile = {
  id: string;
  slug: string;
  fullNameEn: string;
  fullNameJa: string | null;
  nameJaState: string;
  birthDate: string | null;
  heightCm: number | null;
  weightKg: number | null;
  country: string | null;
  position: string | null;
  jerseyNumber: number | null;
  draftYear: number | null;
  draftRound: number | null;
  draftPick: number | null;
  isActive: boolean;
  hasManualOverride: boolean;
};

export type SeasonStatRow = {
  seasonId: string;
  seasonType: "regular" | "playoff";
  /** 移籍の内訳行なら、その在籍のID。シーズン合計行は null */
  stintId: string | null;
  teamAbbreviation: string | null;
  teamNameJa: string | null;
  ageAtSeasonStart: number | null;
  gamesPlayed: number | null;
  gamesStarted: number | null;
  minutesPerGame: number | null;
  pointsPerGame: number | null;
  reboundsPerGame: number | null;
  assistsPerGame: number | null;
  stealsPerGame: number | null;
  blocksPerGame: number | null;
  turnoversPerGame: number | null;
  fieldGoalPct: number | null;
  threePointPct: number | null;
  freeThrowPct: number | null;
  effectiveFieldGoalPct: number | null;
  trueShootingPct: number | null;
  pointsPer36: number | null;
  reboundsPer36: number | null;
  assistsPer36: number | null;
};

export type CareerRow = {
  seasonType: "regular" | "playoff";
  seasonsPlayed: number;
  gamesPlayed: number | null;
  points: number | null;
  pointsPerGame: number | null;
  reboundsPerGame: number | null;
  assistsPerGame: number | null;
  fieldGoalPct: number | null;
  threePointPct: number | null;
  freeThrowPct: number | null;
  effectiveFieldGoalPct: number | null;
  trueShootingPct: number | null;
};

export type PercentileRow = {
  metricCode: string;
  metricNameJa: string;
  value: number | null;
  percentile: number | null;
  population: number;
  isQualified: boolean;
  higherIsBetter: boolean;
};

export type TeamHistoryRow = {
  seasonId: string;
  stintOrder: number;
  /** チームページのURLに使う。改名しても変わらないフランチャイズのslug */
  franchiseSlug: string;
  teamAbbreviation: string | null;
  teamNameJa: string | null;
  teamNameEn: string | null;
  startedOn: string | null;
  endedOn: string | null;
};

export async function getPlayerBySlug(slug: string): Promise<PlayerProfile | null> {
  const row = await queryOne<{
    id: string;
    slug: string;
    full_name_en: string;
    full_name_ja: string | null;
    name_ja_state: string;
    birth_date: string | null;
    height_cm: number | null;
    weight_kg: number | null;
    country: string | null;
    position: string | null;
    jersey_number: number | null;
    draft_year: number | null;
    draft_round: number | null;
    draft_pick: number | null;
    is_active: boolean;
    has_manual_override: boolean;
  }>(
    `select id, slug, full_name_en, full_name_ja, name_ja_state::text as name_ja_state,
            birth_date::text as birth_date, height_cm, weight_kg, country,
            position::text as position, jersey_number,
            draft_year, draft_round, draft_pick, is_active, has_manual_override
       from public.players_effective
      where slug = $1`,
    [slug],
  );
  if (!row) return null;

  return {
    id: row.id,
    slug: row.slug,
    fullNameEn: row.full_name_en,
    fullNameJa: row.full_name_ja,
    nameJaState: row.name_ja_state,
    birthDate: row.birth_date,
    heightCm: row.height_cm,
    weightKg: row.weight_kg,
    country: row.country,
    position: row.position,
    jerseyNumber: row.jersey_number,
    draftYear: row.draft_year,
    draftRound: row.draft_round,
    draftPick: row.draft_pick,
    isActive: row.is_active,
    hasManualOverride: row.has_manual_override,
  };
}

/**
 * シーズン別の成績。合計行も内訳行も両方返す。
 * どう並べるかは画面側で決める（内訳は合計行の下にたたむ）。
 *
 * 年齢はシーズン開幕日を基準にする（docs/DECISIONS.md §1）。
 * 開幕日が未取得のシーズンは NULL。推測で埋めない。
 */
export async function getPlayerSeasons(playerId: string): Promise<SeasonStatRow[]> {
  const rows = await query<Record<string, string | number | null>>(
    `select
       d.season_id, d.season_type::text as season_type, d.stint_id,
       t.abbreviation as team_abbreviation, t.name_ja as team_name_ja,
       case
         when se.regular_season_start_date is null or p.birth_date is null then null
         else extract(year from age(se.regular_season_start_date, p.birth_date))::int
       end as age_at_season_start,
       d.games_played, d.games_started,
       d.minutes_per_game, d.points_per_game, d.rebounds_per_game, d.assists_per_game,
       d.steals_per_game, d.blocks_per_game, d.turnovers_per_game,
       d.field_goal_pct, d.three_point_pct, d.free_throw_pct,
       d.effective_field_goal_pct, d.true_shooting_pct,
       d.points_per_36, d.rebounds_per_36, d.assists_per_36
     from public.player_season_stats_derived d
     join public.players_effective p on p.id = d.player_id
     join public.seasons se on se.id = d.season_id
     left join public.stints st on st.id = d.stint_id
     left join public.teams_effective t on t.id = st.team_id
     where d.player_id = $1
     order by d.season_id desc, d.season_type asc, d.stint_id nulls first`,
    [playerId],
  );

  return rows.map((r) => ({
    seasonId: String(r.season_id),
    seasonType: r.season_type as "regular" | "playoff",
    stintId: r.stint_id === null ? null : String(r.stint_id),
    teamAbbreviation: r.team_abbreviation === null ? null : String(r.team_abbreviation),
    teamNameJa: r.team_name_ja === null ? null : String(r.team_name_ja),
    ageAtSeasonStart: toNumber(r.age_at_season_start as number | null),
    gamesPlayed: toNumber(r.games_played as number | null),
    gamesStarted: toNumber(r.games_started as number | null),
    minutesPerGame: toNumber(r.minutes_per_game as string | null),
    pointsPerGame: toNumber(r.points_per_game as string | null),
    reboundsPerGame: toNumber(r.rebounds_per_game as string | null),
    assistsPerGame: toNumber(r.assists_per_game as string | null),
    stealsPerGame: toNumber(r.steals_per_game as string | null),
    blocksPerGame: toNumber(r.blocks_per_game as string | null),
    turnoversPerGame: toNumber(r.turnovers_per_game as string | null),
    fieldGoalPct: toNumber(r.field_goal_pct as string | null),
    threePointPct: toNumber(r.three_point_pct as string | null),
    freeThrowPct: toNumber(r.free_throw_pct as string | null),
    effectiveFieldGoalPct: toNumber(r.effective_field_goal_pct as string | null),
    trueShootingPct: toNumber(r.true_shooting_pct as string | null),
    pointsPer36: toNumber(r.points_per_36 as string | null),
    reboundsPer36: toNumber(r.rebounds_per_36 as string | null),
    assistsPer36: toNumber(r.assists_per_36 as string | null),
  }));
}

/**
 * キャリア通算。
 * 率はDBのビューが「合計してから割った」値を返す。
 * シーズン率の平均ではない（オーバーライド v3 §8）。
 */
export async function getPlayerCareer(playerId: string): Promise<CareerRow[]> {
  const rows = await query<Record<string, string | number | null>>(
    `select season_type::text as season_type, seasons_played, games_played, points,
            points_per_game, rebounds_per_game, assists_per_game,
            field_goal_pct, three_point_pct, free_throw_pct,
            effective_field_goal_pct, true_shooting_pct
       from public.player_career_stats
      where player_id = $1
      order by season_type asc`,
    [playerId],
  );

  return rows.map((r) => ({
    seasonType: r.season_type as "regular" | "playoff",
    seasonsPlayed: Number(r.seasons_played ?? 0),
    gamesPlayed: toNumber(r.games_played as number | null),
    points: toNumber(r.points as number | null),
    pointsPerGame: toNumber(r.points_per_game as string | null),
    reboundsPerGame: toNumber(r.rebounds_per_game as string | null),
    assistsPerGame: toNumber(r.assists_per_game as string | null),
    fieldGoalPct: toNumber(r.field_goal_pct as string | null),
    threePointPct: toNumber(r.three_point_pct as string | null),
    freeThrowPct: toNumber(r.free_throw_pct as string | null),
    effectiveFieldGoalPct: toNumber(r.effective_field_goal_pct as string | null),
    trueShootingPct: toNumber(r.true_shooting_pct as string | null),
  }));
}

/**
 * リーグ内での位置（パーセンタイル）。
 *
 * 母集団は規定到達者のみ（Q3の決定）。
 * 画面には必ず「◯人中」と最低条件を併記すること。
 * 母集団を書かないと、何と比べた値なのか分からない。
 */
export async function getPlayerPercentiles(
  playerId: string,
  seasonId: string,
  seasonType: "regular" | "playoff" = "regular",
): Promise<PercentileRow[]> {
  const rows = await query<Record<string, string | number | boolean | null>>(
    `select pc.metric_code, md.name_ja as metric_name_ja, pc.value, pc.percentile,
            pc.population, pc.is_qualified, md.higher_is_better
       from public.player_percentiles pc
       join public.metric_definitions md on md.code = pc.metric_code
      where pc.player_id = $1 and pc.season_id = $2 and pc.season_type = $3
      order by md.code`,
    [playerId, seasonId, seasonType],
  );

  return rows.map((r) => ({
    metricCode: String(r.metric_code),
    metricNameJa: String(r.metric_name_ja),
    value: toNumber(r.value as string | null),
    percentile: toNumber(r.percentile as string | null),
    population: Number(r.population ?? 0),
    isQualified: Boolean(r.is_qualified),
    higherIsBetter: Boolean(r.higher_is_better),
  }));
}

/** 所属履歴。途中移籍があるシーズンは複数行になる。 */
export async function getPlayerTeamHistory(playerId: string): Promise<TeamHistoryRow[]> {
  const rows = await query<Record<string, string | number | null>>(
    `select st.season_id, st.stint_order, f.slug as franchise_slug,
            t.abbreviation as team_abbreviation, t.name_ja as team_name_ja, t.name_en as team_name_en,
            st.started_on::text as started_on, st.ended_on::text as ended_on
       from public.stints st
       join public.teams_effective t on t.id = st.team_id
       join public.franchises f on f.id = t.franchise_id
      where st.player_id = $1
      order by st.season_id desc, st.stint_order asc`,
    [playerId],
  );

  return rows.map((r) => ({
    seasonId: String(r.season_id),
    stintOrder: Number(r.stint_order ?? 1),
    franchiseSlug: String(r.franchise_slug),
    teamAbbreviation: r.team_abbreviation === null ? null : String(r.team_abbreviation),
    teamNameJa: r.team_name_ja === null ? null : String(r.team_name_ja),
    teamNameEn: r.team_name_en === null ? null : String(r.team_name_en),
    startedOn: r.started_on === null ? null : String(r.started_on),
    endedOn: r.ended_on === null ? null : String(r.ended_on),
  }));
}

/** 受賞歴。無ければ空。無いことと未取得は画面側で区別して書く。 */
export async function getPlayerAwards(
  playerId: string,
): Promise<{ seasonId: string; nameJa: string; code: string }[]> {
  const rows = await query<{ season_id: string; name_ja: string; code: string }>(
    `select pa.season_id, a.name_ja, a.code
       from public.player_awards pa
       join public.awards a on a.id = pa.award_id
      where pa.player_id = $1
      order by pa.season_id desc`,
    [playerId],
  );
  return rows.map((r) => ({ seasonId: r.season_id, nameJa: r.name_ja, code: r.code }));
}

/** 比較ページ用。複数選手をまとめて取る。 */
export async function getPlayersBySlugs(slugs: readonly string[]): Promise<PlayerProfile[]> {
  if (slugs.length === 0) return [];

  const rows = await query<{ slug: string }>(
    `select slug from public.players_effective where slug = any($1::text[])`,
    [slugs],
  );
  const found = new Set(rows.map((r) => r.slug));

  // URLで指定された順を保つ。DBの返す順に任せると、
  // 並べ替えたつもりのない順番で選手が入れ替わる。
  const profiles = await Promise.all(
    slugs.filter((s) => found.has(s)).map((slug) => getPlayerBySlug(slug)),
  );
  return profiles.filter((p): p is PlayerProfile => p !== null);
}
