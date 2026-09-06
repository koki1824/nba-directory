import { query, queryOne } from "./client";

/**
 * 選手まわりの問い合わせ（W2-5 / W2-6 / W2-7 が使う）。
 *
 * 【方針】
 * ・SQL はこのファイルに集約する。画面のコンポーネントには書かない
 * ・値の埋め込みは必ず $1, $2 … を使う。文字列連結で組み立てない
 * ・読むのは基本ビュー。率やキャリア集計を画面側で計算し直さない
 *   （DBとTypeScriptで式が食い違う余地を増やさないため。
 *     どうしても画面で組み替えるときだけ src/domain/stats.ts を使う）
 * ・欠損は NULL のまま返す。ここで 0 に置き換えない
 */

export type PlayerListItem = {
  id: string;
  slug: string;
  fullNameEn: string;
  fullNameJa: string | null;
  position: string | null;
  jerseyNumber: number | null;
  heightCm: number | null;
  weightKg: number | null;
  birthDate: string | null;
  teamId: string | null;
  teamNameJa: string | null;
  teamNameEn: string | null;
  teamAbbreviation: string | null;
  seasonId: string | null;
  gamesPlayed: number | null;
  pointsPerGame: number | null;
  reboundsPerGame: number | null;
  assistsPerGame: number | null;
  minutesPerGame: number | null;
  fieldGoalPct: number | null;
};

export const PLAYER_SORT_KEYS = ["name", "points", "rebounds", "assists", "minutes"] as const;

export type PlayerSortKey = (typeof PLAYER_SORT_KEYS)[number];

/**
 * 並び順の指定を SQL の断片に変換する。
 *
 * 【重要】URLの ?sort= をそのまま SQL に混ぜてはいけない。
 * 決められた候補の中から選ぶ形にして、想定外の文字列は既定値に落とす。
 * ここを文字列連結にすると、URLに書いた内容がSQLとして実行される余地ができる。
 *
 * 成績での並び替えでは NULL を必ず最後に置く。
 * 「記録が無い」を0とみなして先頭や末尾に混ぜると、
 * 出場していない選手が「最下位の選手」として並んでしまう。
 */
function orderByClause(sort: PlayerSortKey): string {
  switch (sort) {
    case "points":
      return "m.points_per_game desc nulls last, p.full_name_en asc";
    case "rebounds":
      return "m.rebounds_per_game desc nulls last, p.full_name_en asc";
    case "assists":
      return "m.assists_per_game desc nulls last, p.full_name_en asc";
    case "minutes":
      return "m.minutes_per_game desc nulls last, p.full_name_en asc";
    case "name":
    default:
      // 日本語名がある選手はそちらで並べたいが、未設定の選手が先頭に固まると
      // 探しにくい。英語名を常に持っているので、そちらを基準にする。
      return "p.full_name_en asc";
  }
}

export function isPlayerSortKey(value: string | undefined): value is PlayerSortKey {
  return value !== undefined && (PLAYER_SORT_KEYS as readonly string[]).includes(value);
}

export type PlayerListFilters = {
  /** 名前の一部。英語名・日本語名の両方を見る */
  q?: string | undefined;
  /** チームの略称（HCA など） */
  team?: string | undefined;
  /** ポジション（G / F / C など） */
  position?: string | undefined;
  /** 成績を表示する対象シーズン。未指定なら最新 */
  season?: string | undefined;
  sort?: PlayerSortKey | undefined;
  limit?: number | undefined;
  offset?: number | undefined;
};

export type PlayerListResult = {
  items: PlayerListItem[];
  total: number;
  seasonId: string | null;
};

/**
 * 一覧に出す最新シーズン。
 * 「今どのシーズンか」を定数で持つと、シーズンが進むたびに直すことになる。
 * 成績が入っているシーズンのうち最も新しいものを使う。
 */
export async function latestSeasonWithStats(): Promise<string | null> {
  const row = await queryOne<{ season_id: string }>(
    `select season_id from public.player_season_stats
      where season_type = 'regular'
      order by season_id desc
      limit 1`,
  );
  return row?.season_id ?? null;
}

/**
 * 選手一覧。
 *
 * 成績は「指定シーズンのレギュラーシーズン合計行」を並べる。
 * stint別の行（移籍前後の内訳）は混ぜない。混ぜると同じ選手が2回出る。
 *
 * 所属チームも同じシーズンのもの。途中移籍した選手は複数チームに在籍するので、
 * 最後に在籍したチーム（stint_order が最大）を代表として出す。
 */
export async function listPlayers(filters: PlayerListFilters = {}): Promise<PlayerListResult> {
  const seasonId = filters.season ?? (await latestSeasonWithStats());
  const sort = filters.sort ?? "name";
  const limit = Math.min(Math.max(filters.limit ?? 50, 1), 200);
  const offset = Math.max(filters.offset ?? 0, 0);

  const params: unknown[] = [seasonId];
  const where: string[] = [];

  if (filters.q?.trim()) {
    params.push(`%${filters.q.trim()}%`);
    // 英語名・日本語名のどちらでも引っかかるようにする。
    // 日本語名が未設定の選手を取りこぼさないよう coalesce で空文字に落とす。
    where.push(
      `(p.full_name_en ilike $${params.length} or coalesce(p.full_name_ja, '') ilike $${params.length})`,
    );
  }

  if (filters.team?.trim()) {
    params.push(filters.team.trim());
    where.push(`t.abbreviation = $${params.length}`);
  }

  if (filters.position?.trim()) {
    params.push(filters.position.trim());
    // 'G' で G-F も拾う。ポジション表記は複合があるため前方一致で見る。
    where.push(`p.position::text like $${params.length} || '%'`);
  }

  const whereSql = where.length > 0 ? `where ${where.join(" and ")}` : "";

  // 在籍は「そのシーズンで最後に所属したチーム」を1つだけ取る。
  // 素直に join すると途中移籍の選手が複数行になる。
  const base = `
    from public.players_effective p
    left join lateral (
      select st.team_id, st.stint_order
      from public.stints st
      where st.player_id = p.id and st.season_id = $1
      order by st.stint_order desc
      limit 1
    ) s on true
    left join public.teams_effective t on t.id = s.team_id
    left join public.player_season_stats_derived m
      on m.player_id = p.id
     and m.season_id = $1
     and m.season_type = 'regular'
     and m.stint_id is null
  `;

  const rows = await query<{
    id: string;
    slug: string;
    full_name_en: string;
    full_name_ja: string | null;
    position: string | null;
    jersey_number: number | null;
    height_cm: number | null;
    weight_kg: number | null;
    birth_date: string | null;
    team_id: string | null;
    team_name_ja: string | null;
    team_name_en: string | null;
    team_abbreviation: string | null;
    games_played: number | null;
    points_per_game: string | null;
    rebounds_per_game: string | null;
    assists_per_game: string | null;
    minutes_per_game: string | null;
    field_goal_pct: string | null;
  }>(
    `select
       p.id, p.slug, p.full_name_en, p.full_name_ja, p.position::text as position,
       p.jersey_number, p.height_cm, p.weight_kg, p.birth_date::text as birth_date,
       t.id as team_id, t.name_ja as team_name_ja, t.name_en as team_name_en,
       t.abbreviation as team_abbreviation,
       m.games_played, m.points_per_game, m.rebounds_per_game, m.assists_per_game,
       m.minutes_per_game, m.field_goal_pct
     ${base}
     ${whereSql}
     order by ${orderByClause(sort)}
     limit ${limit} offset ${offset}`,
    params,
  );

  const totalRow = await queryOne<{ n: string }>(
    `select count(*)::text as n ${base} ${whereSql}`,
    params,
  );

  return {
    items: rows.map((r) => ({
      id: r.id,
      slug: r.slug,
      fullNameEn: r.full_name_en,
      fullNameJa: r.full_name_ja,
      position: r.position,
      jerseyNumber: r.jersey_number,
      heightCm: r.height_cm,
      weightKg: r.weight_kg,
      birthDate: r.birth_date,
      teamId: r.team_id,
      teamNameJa: r.team_name_ja,
      teamNameEn: r.team_name_en,
      teamAbbreviation: r.team_abbreviation,
      seasonId,
      gamesPlayed: r.games_played,
      // numeric は文字列で返る。数値にしてから画面へ渡す。
      // NULL は NULL のまま（0 にしない）。
      pointsPerGame: toNumber(r.points_per_game),
      reboundsPerGame: toNumber(r.rebounds_per_game),
      assistsPerGame: toNumber(r.assists_per_game),
      minutesPerGame: toNumber(r.minutes_per_game),
      fieldGoalPct: toNumber(r.field_goal_pct),
    })),
    total: Number(totalRow?.n ?? 0),
    seasonId,
  };
}

/**
 * Postgres の numeric は精度を落とさないよう文字列で返ってくる。
 * NULL を 0 にしないことがこの関数の仕事。
 */
export function toNumber(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isNaN(n) ? null : n;
}

/** 絞り込みに使う選択肢。DBにある値だけを出す（空振りする選択肢を作らない）。 */
export async function playerFilterOptions(): Promise<{
  teams: { abbreviation: string; nameJa: string | null; nameEn: string }[];
  positions: string[];
  seasons: string[];
}> {
  const [teams, positions, seasons] = await Promise.all([
    query<{ abbreviation: string; name_ja: string | null; name_en: string }>(
      `select distinct t.abbreviation, t.name_ja, t.name_en
         from public.teams_effective t
         join public.stints st on st.team_id = t.id
        order by t.abbreviation`,
    ),
    query<{ position: string }>(
      `select distinct p.position::text as position
         from public.players p
        where p.position is not null
        order by 1`,
    ),
    query<{ season_id: string }>(
      `select distinct season_id from public.player_season_stats
        where season_type = 'regular'
        order by season_id desc`,
    ),
  ]);

  return {
    teams: teams.map((t) => ({
      abbreviation: t.abbreviation,
      nameJa: t.name_ja,
      nameEn: t.name_en,
    })),
    positions: positions.map((p) => p.position),
    seasons: seasons.map((s) => s.season_id),
  };
}
