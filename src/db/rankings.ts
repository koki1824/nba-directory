import { query, queryOne } from "./client";
import { toNumber } from "./players";

/**
 * ランキング（W2-10）。
 *
 * 【規定到達の扱い】
 * `player_rankings` ビューが規定到達を判定し、未到達には順位を付けない。
 * 画面では**未到達者も表示する**が、順位は空欄にして理由を書く。
 * 隠すと「なぜこの選手がいないのか」が分からなくなる。
 *
 * 【プレーオフは最低条件を設けない】
 * 全選手を表示し、試合数を併記する（docs/DECISIONS.md §4）。
 * プレーオフは出場試合数が少なく、一律の条件を当てると
 * ほとんどの選手が消えてしまうため。
 */

export type RankingRow = {
  rank: number | null;
  playerId: string;
  playerSlug: string;
  fullNameEn: string;
  fullNameJa: string | null;
  teamAbbreviation: string | null;
  franchiseSlug: string | null;
  value: number | null;
  gamesPlayed: number | null;
  minutes: number | null;
  isQualified: boolean;
};

export type RankingMeta = {
  metricCode: string;
  metricNameJa: string;
  higherIsBetter: boolean;
  isRate: boolean;
  decimals: number;
  /** 規定の最低出場試合数。設定されていなければ null（条件なし） */
  minimumGames: number | null;
  minimumMinutes: number | null;
  /** 規定に到達している人数。画面に「◯人中」と出す */
  qualifiedCount: number;
};

export type MetricOption = { code: string; nameJa: string };

/** ランキングに出せる指標の一覧。 */
export async function rankingMetrics(): Promise<MetricOption[]> {
  const rows = await query<{ code: string; name_ja: string; display_order: number }>(
    // 指標定義にあっても、実際に値が入っていないものは選ばせない。
    // 選んだ先が空だと「壊れている」と受け取られる。
    `select distinct md.code, md.name_ja, md.display_order
       from public.metric_definitions md
       join public.player_season_metrics m on m.metric_code = md.code
      where m.value is not null
      -- 並びは display_order。コード順だと画面の並びが意味と合わない
      order by md.display_order, md.code`,
  );
  return rows.map((r) => ({ code: r.code, nameJa: r.name_ja }));
}

export async function rankingSeasons(): Promise<string[]> {
  const rows = await query<{ season_id: string }>(
    `select distinct season_id from public.player_season_stats
      order by season_id desc`,
  );
  return rows.map((r) => r.season_id);
}

export async function getRankingMeta(
  metricCode: string,
  seasonId: string,
  seasonType: "regular" | "playoff",
): Promise<RankingMeta | null> {
  const row = await queryOne<Record<string, string | number | boolean | null>>(
    `select md.code, md.name_ja, md.higher_is_better, md.is_rate, md.decimal_places,
            r.minimum_games, r.minimum_minutes,
            (select count(*) from public.player_rankings pr
              where pr.metric_code = md.code and pr.season_id = $2
                and pr.season_type = $3 and pr.is_qualified and pr.value is not null
            )::int as qualified_count
       from public.metric_definitions md
       -- 適用する規定はちょうど1件。シーズン個別 > 全シーズン共通の既定。
       -- （この絞り込みを忘れると2件に当たって行が倍になる。0004 で直した不具合）
       left join lateral (
         select rr.minimum_games, rr.minimum_minutes
         from public.ranking_rules rr
         where rr.metric_code = md.code and rr.season_type = $3
           and (rr.season_id = $2 or rr.season_id is null)
         order by (rr.season_id is null)
         limit 1
       ) r on true
      where md.code = $1`,
    [metricCode, seasonId, seasonType],
  );
  if (!row) return null;

  return {
    metricCode: String(row.code),
    metricNameJa: String(row.name_ja),
    higherIsBetter: Boolean(row.higher_is_better),
    isRate: Boolean(row.is_rate),
    decimals: Number(row.decimal_places ?? 1),
    minimumGames: toNumber(row.minimum_games as number | null),
    minimumMinutes: toNumber(row.minimum_minutes as number | null),
    qualifiedCount: Number(row.qualified_count ?? 0),
  };
}

/**
 * ランキング本体。
 *
 * 規定到達者を上位から並べ、そのあとに未到達者を続ける。
 * 未到達者を混ぜて並べると、規定を満たしていない少数試合の選手が
 * 上位に紛れ込み、順位表として読めなくなる。
 */
export async function getRanking(
  metricCode: string,
  seasonId: string,
  seasonType: "regular" | "playoff" = "regular",
  limit = 50,
): Promise<RankingRow[]> {
  const rows = await query<Record<string, string | number | boolean | null>>(
    `select r.rank, r.player_id, p.slug as player_slug,
            p.full_name_en, p.full_name_ja,
            t.abbreviation as team_abbreviation, f.slug as franchise_slug,
            r.value, r.games_played, r.minutes, r.is_qualified
       from public.player_rankings r
       join public.players_effective p on p.id = r.player_id
       left join lateral (
         select st.team_id from public.stints st
         where st.player_id = r.player_id and st.season_id = r.season_id
         order by st.stint_order desc limit 1
       ) s on true
       left join public.teams_effective t on t.id = s.team_id
       left join public.franchises f on f.id = t.franchise_id
      where r.metric_code = $1 and r.season_id = $2 and r.season_type = $3
        and r.value is not null
      -- 規定到達者が先。そのあとに未到達者を成績順で続ける。
      order by r.is_qualified desc, r.rank asc nulls last,
               case when $4 then r.value else -r.value end desc
      limit $5`,
    [metricCode, seasonId, seasonType, await isHigherBetter(metricCode), limit],
  );

  return rows.map((r) => ({
    rank: toNumber(r.rank as number | null),
    playerId: String(r.player_id),
    playerSlug: String(r.player_slug),
    fullNameEn: String(r.full_name_en),
    fullNameJa: r.full_name_ja === null ? null : String(r.full_name_ja),
    teamAbbreviation: r.team_abbreviation === null ? null : String(r.team_abbreviation),
    franchiseSlug: r.franchise_slug === null ? null : String(r.franchise_slug),
    value: toNumber(r.value as string | null),
    gamesPlayed: toNumber(r.games_played as number | null),
    minutes: toNumber(r.minutes as string | null),
    isQualified: Boolean(r.is_qualified),
  }));
}

async function isHigherBetter(metricCode: string): Promise<boolean> {
  const row = await queryOne<{ higher_is_better: boolean }>(
    `select higher_is_better from public.metric_definitions where code = $1`,
    [metricCode],
  );
  // 定義が無い指標は「大きいほうが良い」とみなす。
  // ここで例外にすると、指標が増えたときに画面ごと落ちる。
  return row?.higher_is_better ?? true;
}
