import { query, queryOne } from "./client";
import { toNumber } from "./players";

/**
 * チームまわりの問い合わせ（W2-8）。
 *
 * 【URLにフランチャイズのslugを使う理由】
 * チームは名称や本拠地が変わることがある（teams テーブルは
 * effective_from_season_id / effective_to_season_id で年代を持つ）。
 * 略称や名前をURLにすると、改名のたびにURLが変わってリンクが切れる。
 * フランチャイズは改名しても同じものなので、URLの軸にはこちらを使う。
 *
 * 【チーム成績は公式値をそのまま出す】
 * 所属選手の成績を合計して代用しない（オーバーライド v3 §8）。
 * 合計は公式記録と一致しない（移籍・記録漏れ・出場停止などのため）。
 */

export type TeamListItem = {
  id: string;
  franchiseSlug: string;
  nameJa: string | null;
  nameEn: string;
  abbreviation: string;
  cityJa: string | null;
  conference: string | null;
  division: string | null;
  primaryColor: string | null;
  wins: number | null;
  losses: number | null;
  pointsFor: number | null;
  pointsAgainst: number | null;
};

export type TeamDetail = TeamListItem & {
  seasonId: string | null;
  gamesPlayed: number | null;
  /** チーム成績の1試合平均。公式の合計値から割ったもの */
  pointsForPerGame: number | null;
  pointsAgainstPerGame: number | null;
  fieldGoalPct: number | null;
  threePointPct: number | null;
  freeThrowPct: number | null;
  assistsPerGame: number | null;
  reboundsPerGame: number | null;
  turnoversPerGame: number | null;
};

export type RosterRow = {
  playerId: string;
  playerSlug: string;
  fullNameEn: string;
  fullNameJa: string | null;
  position: string | null;
  jerseyNumber: number | null;
  heightCm: number | null;
  weightKg: number | null;
  ageAtSeasonStart: number | null;
  stintOrder: number;
  gamesPlayed: number | null;
  pointsPerGame: number | null;
  reboundsPerGame: number | null;
  assistsPerGame: number | null;
  minutesPerGame: number | null;
};

/** 成績が入っているシーズンのうち最新のもの。 */
export async function latestTeamSeason(): Promise<string | null> {
  const row = await queryOne<{ season_id: string }>(
    `select season_id from public.team_season_stats
      where season_type = 'regular' order by season_id desc limit 1`,
  );
  return row?.season_id ?? null;
}

/** チームが記録を持つシーズン一覧（新しい順）。年代別ロスターの選択肢に使う。 */
export async function teamSeasons(franchiseSlug: string): Promise<string[]> {
  const rows = await query<{ season_id: string }>(
    `select distinct st.season_id
       from public.stints st
       join public.teams t on t.id = st.team_id
       join public.franchises f on f.id = t.franchise_id
      where f.slug = $1
      order by st.season_id desc`,
    [franchiseSlug],
  );
  return rows.map((r) => r.season_id);
}

const TEAM_BASE = `
  from public.teams_effective t
  join public.franchises f on f.id = t.franchise_id
  left join public.team_season_stats ts
    on ts.team_id = t.id and ts.season_id = $1 and ts.season_type = 'regular'
`;

export async function listTeams(seasonId?: string): Promise<{
  teams: TeamListItem[];
  seasonId: string | null;
}> {
  const season = seasonId ?? (await latestTeamSeason());

  const rows = await query<{
    id: string;
    franchise_slug: string;
    name_ja: string | null;
    name_en: string;
    abbreviation: string;
    city_ja: string | null;
    conference: string | null;
    division: string | null;
    primary_color: string | null;
    wins: number | null;
    losses: number | null;
    points_for: number | null;
    points_against: number | null;
  }>(
    `select t.id, f.slug as franchise_slug, t.name_ja, t.name_en, t.abbreviation,
            t.city_ja, t.conference, t.division, t.primary_color,
            ts.wins, ts.losses, ts.points_for, ts.points_against
     ${TEAM_BASE}
     -- 勝敗が入っていないチームも一覧には出す（記録待ちと存在しないは別）
     order by ts.wins desc nulls last, t.name_en asc`,
    [season],
  );

  return {
    teams: rows.map((r) => ({
      id: r.id,
      franchiseSlug: r.franchise_slug,
      nameJa: r.name_ja,
      nameEn: r.name_en,
      abbreviation: r.abbreviation,
      cityJa: r.city_ja,
      conference: r.conference,
      division: r.division,
      primaryColor: r.primary_color,
      wins: r.wins,
      losses: r.losses,
      pointsFor: r.points_for,
      pointsAgainst: r.points_against,
    })),
    seasonId: season,
  };
}

export async function getTeamBySlug(
  franchiseSlug: string,
  seasonId?: string,
): Promise<TeamDetail | null> {
  const season = seasonId ?? (await latestTeamSeason());

  const row = await queryOne<Record<string, string | number | null>>(
    `select t.id, f.slug as franchise_slug, t.name_ja, t.name_en, t.abbreviation,
            t.city_ja, t.conference, t.division, t.primary_color,
            ts.wins, ts.losses, ts.points_for, ts.points_against, ts.games_played,
            -- 1試合平均は公式の合計値から割る。選手の合計ではない。
            ts.points_for::numeric / nullif(ts.games_played, 0) as points_for_per_game,
            ts.points_against::numeric / nullif(ts.games_played, 0) as points_against_per_game,
            ts.field_goals_made::numeric / nullif(ts.field_goals_attempted, 0) as field_goal_pct,
            ts.three_pointers_made::numeric / nullif(ts.three_pointers_attempted, 0)
              as three_point_pct,
            ts.free_throws_made::numeric / nullif(ts.free_throws_attempted, 0) as free_throw_pct,
            ts.assists::numeric / nullif(ts.games_played, 0) as assists_per_game,
            (ts.offensive_rebounds + ts.defensive_rebounds)::numeric
              / nullif(ts.games_played, 0) as rebounds_per_game,
            ts.turnovers::numeric / nullif(ts.games_played, 0) as turnovers_per_game
     ${TEAM_BASE}
     where f.slug = $2
     limit 1`,
    [season, franchiseSlug],
  );
  if (!row) return null;

  return {
    id: String(row.id),
    franchiseSlug: String(row.franchise_slug),
    nameJa: row.name_ja === null ? null : String(row.name_ja),
    nameEn: String(row.name_en),
    abbreviation: String(row.abbreviation),
    cityJa: row.city_ja === null ? null : String(row.city_ja),
    conference: row.conference === null ? null : String(row.conference),
    division: row.division === null ? null : String(row.division),
    primaryColor: row.primary_color === null ? null : String(row.primary_color),
    seasonId: season,
    wins: toNumber(row.wins as number | null),
    losses: toNumber(row.losses as number | null),
    pointsFor: toNumber(row.points_for as number | null),
    pointsAgainst: toNumber(row.points_against as number | null),
    gamesPlayed: toNumber(row.games_played as number | null),
    pointsForPerGame: toNumber(row.points_for_per_game as string | null),
    pointsAgainstPerGame: toNumber(row.points_against_per_game as string | null),
    fieldGoalPct: toNumber(row.field_goal_pct as string | null),
    threePointPct: toNumber(row.three_point_pct as string | null),
    freeThrowPct: toNumber(row.free_throw_pct as string | null),
    assistsPerGame: toNumber(row.assists_per_game as string | null),
    reboundsPerGame: toNumber(row.rebounds_per_game as string | null),
    turnoversPerGame: toNumber(row.turnovers_per_game as string | null),
  };
}

/**
 * 年代別ロスター。
 *
 * 成績はそのシーズンの合計行（stint_id が NULL）を使う。
 * 移籍した選手はチームごとの内訳を持つが、ロスターに出すのは
 * 「そのシーズン全体の成績」。内訳を出すと、
 * 同じ選手の数字が所属チームごとに違って見えて混乱する。
 * 途中加入・途中退団は在籍期間で読み取れるようにする。
 */
export async function getTeamRoster(teamId: string, seasonId: string): Promise<RosterRow[]> {
  const rows = await query<Record<string, string | number | null>>(
    `select r.player_id, r.player_slug, r.full_name_en, r.full_name_ja,
            r.position::text as position, r.jersey_number, r.height_cm, r.weight_kg,
            r.age_at_season_start, r.stint_order,
            d.games_played, d.points_per_game, d.rebounds_per_game,
            d.assists_per_game, d.minutes_per_game
       from public.team_rosters r
       left join public.player_season_stats_derived d
         on d.player_id = r.player_id
        and d.season_id = r.season_id
        and d.season_type = 'regular'
        and d.stint_id is null
      where r.team_id = $1 and r.season_id = $2
      order by d.points_per_game desc nulls last, r.full_name_en asc`,
    [teamId, seasonId],
  );

  return rows.map((r) => ({
    playerId: String(r.player_id),
    playerSlug: String(r.player_slug),
    fullNameEn: String(r.full_name_en),
    fullNameJa: r.full_name_ja === null ? null : String(r.full_name_ja),
    position: r.position === null ? null : String(r.position),
    jerseyNumber: toNumber(r.jersey_number as number | null),
    heightCm: toNumber(r.height_cm as number | null),
    weightKg: toNumber(r.weight_kg as number | null),
    ageAtSeasonStart: toNumber(r.age_at_season_start as number | null),
    stintOrder: Number(r.stint_order ?? 1),
    gamesPlayed: toNumber(r.games_played as number | null),
    pointsPerGame: toNumber(r.points_per_game as string | null),
    reboundsPerGame: toNumber(r.rebounds_per_game as string | null),
    assistsPerGame: toNumber(r.assists_per_game as string | null),
    minutesPerGame: toNumber(r.minutes_per_game as string | null),
  }));
}

/**
 * 所属選手の得点合計。
 *
 * 【これはチーム成績ではない】
 * 画面で「チームの公式得点」と並べて、両者が一致しないことを
 * 示すために使う。合計で代用してよいという誤解を避けるため。
 */
export async function rosterPointsSum(teamId: string, seasonId: string): Promise<number | null> {
  const row = await queryOne<{ total: string | null }>(
    `select sum(s.points)::text as total
       from public.stints st
       join public.player_season_stats s
         on s.player_id = st.player_id and s.season_id = st.season_id
        and s.season_type = 'regular' and s.stint_id is null
      where st.team_id = $1 and st.season_id = $2`,
    [teamId, seasonId],
  );
  return toNumber(row?.total ?? null);
}
