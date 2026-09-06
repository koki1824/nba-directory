import { query } from "./client";
import { getPlayersBySlugs, type PlayerProfile } from "./player-detail";
import { toNumber } from "./players";

/**
 * 選手比較のデータ取得（W2-7）。
 *
 * 中核機能なので、ここが一番壊れてはいけない。
 *
 * 【比較する値の作り方】
 * DBのビューが計算した値をそのまま使う。画面側で計算し直さない。
 * 同じ数字が選手ページと比較ページで違う、という事故をなくすため。
 *
 * 【欠損の扱い】
 * 比べられない項目は「比べられない」と出す。0 として並べない。
 * 片方が「試投0本」で FG% が出せないとき、0% として棒を描くと
 * 「片方が圧倒的に上手い」という嘘の絵になる。
 */

export type CompareMetric = {
  key: string;
  label: string;
  /** 値が大きいほうが良いか。ターンオーバーだけ false */
  higherIsBetter: boolean;
  /** 率として % 表示するか */
  percent: boolean;
  /** 棒の満点。率は 1、それ以外は選手間の最大値から決める */
  max?: number;
};

export type ComparePlayer = {
  profile: PlayerProfile;
  teamNameJa: string | null;
  teamAbbreviation: string | null;
  seasonId: string | null;
  /** 指標コード → 値。値が無ければ null */
  values: Record<string, number | null>;
  /** その選手がこのシーズンに出場記録を持つか */
  hasSeasonRecord: boolean;
};

/**
 * 比較に出す指標。
 * ここに並べた順で画面に出る。増やすときは意味の近いものをまとめる。
 */
export const COMPARE_METRICS: CompareMetric[] = [
  { key: "pointsPerGame", label: "得点", higherIsBetter: true, percent: false },
  { key: "reboundsPerGame", label: "リバウンド", higherIsBetter: true, percent: false },
  { key: "assistsPerGame", label: "アシスト", higherIsBetter: true, percent: false },
  { key: "stealsPerGame", label: "スティール", higherIsBetter: true, percent: false },
  { key: "blocksPerGame", label: "ブロック", higherIsBetter: true, percent: false },
  // ターンオーバーだけ「少ないほうが良い」。
  // 一律に「多いほど良い」で描くと、ミスが多い選手が優秀に見える。
  { key: "turnoversPerGame", label: "ターンオーバー", higherIsBetter: false, percent: false },
  { key: "minutesPerGame", label: "出場時間", higherIsBetter: true, percent: false },
  { key: "fieldGoalPct", label: "FG%", higherIsBetter: true, percent: true, max: 1 },
  { key: "threePointPct", label: "3P%", higherIsBetter: true, percent: true, max: 1 },
  { key: "freeThrowPct", label: "FT%", higherIsBetter: true, percent: true, max: 1 },
  { key: "effectiveFieldGoalPct", label: "eFG%", higherIsBetter: true, percent: true, max: 1 },
  { key: "trueShootingPct", label: "TS%", higherIsBetter: true, percent: true, max: 1 },
];

const COLUMN_BY_KEY: Record<string, string> = {
  pointsPerGame: "points_per_game",
  reboundsPerGame: "rebounds_per_game",
  assistsPerGame: "assists_per_game",
  stealsPerGame: "steals_per_game",
  blocksPerGame: "blocks_per_game",
  turnoversPerGame: "turnovers_per_game",
  minutesPerGame: "minutes_per_game",
  fieldGoalPct: "field_goal_pct",
  threePointPct: "three_point_pct",
  freeThrowPct: "free_throw_pct",
  effectiveFieldGoalPct: "effective_field_goal_pct",
  trueShootingPct: "true_shooting_pct",
};

export type CompareMode = "season" | "career";

/**
 * 比較データ。
 *
 * mode = "season" … 指定シーズンのレギュラーシーズン成績
 * mode = "career" … キャリア通算（率は合計から計算したもの）
 */
export async function getCompareData(
  slugs: readonly string[],
  options: { seasonId?: string | undefined; mode?: CompareMode } = {},
): Promise<{ players: ComparePlayer[]; seasonId: string | null }> {
  const mode = options.mode ?? "season";
  const profiles = await getPlayersBySlugs(slugs);
  if (profiles.length === 0) return { players: [], seasonId: options.seasonId ?? null };

  const ids = profiles.map((p) => p.id);

  // 比較するシーズン。指定が無ければ「対象の選手が記録を持つ最新シーズン」。
  // サイト全体の最新にすると、引退した選手を比較したときに全員空になる。
  let seasonId = options.seasonId ?? null;
  if (mode === "season" && !seasonId) {
    const rows = await query<{ season_id: string }>(
      `select season_id from public.player_season_stats
        where player_id = any($1::uuid[]) and season_type = 'regular' and stint_id is null
        order by season_id desc limit 1`,
      [ids],
    );
    seasonId = rows[0]?.season_id ?? null;
  }

  const selected = Object.values(COLUMN_BY_KEY).join(", ");

  const statRows =
    mode === "career"
      ? await query<Record<string, string | number | null>>(
          `select player_id, ${selected}
             from public.player_career_stats
            where player_id = any($1::uuid[]) and season_type = 'regular'`,
          [ids],
        )
      : seasonId
        ? await query<Record<string, string | number | null>>(
            `select player_id, ${selected}
               from public.player_season_stats_derived
              where player_id = any($1::uuid[])
                and season_id = $2 and season_type = 'regular' and stint_id is null`,
            [ids, seasonId],
          )
        : [];

  const statByPlayer = new Map(statRows.map((r) => [String(r.player_id), r]));

  // 所属チーム。シーズン指定があればその年の最後の在籍。
  const teamRows = seasonId
    ? await query<{
        player_id: string;
        name_ja: string | null;
        abbreviation: string | null;
      }>(
        `select distinct on (st.player_id)
                st.player_id, t.name_ja, t.abbreviation
           from public.stints st
           join public.teams_effective t on t.id = st.team_id
          where st.player_id = any($1::uuid[]) and st.season_id = $2
          order by st.player_id, st.stint_order desc`,
        [ids, seasonId],
      )
    : [];
  const teamByPlayer = new Map(teamRows.map((r) => [r.player_id, r]));

  const players: ComparePlayer[] = profiles.map((profile) => {
    const stats = statByPlayer.get(profile.id);
    const team = teamByPlayer.get(profile.id);

    const values: Record<string, number | null> = {};
    for (const metric of COMPARE_METRICS) {
      const column = COLUMN_BY_KEY[metric.key]!;
      values[metric.key] = stats ? toNumber(stats[column] as string | null) : null;
    }

    return {
      profile,
      teamNameJa: team?.name_ja ?? null,
      teamAbbreviation: team?.abbreviation ?? null,
      seasonId: mode === "career" ? null : seasonId,
      values,
      // 「そのシーズンに記録が無い」と「値が取れていない」を区別するために持つ。
      hasSeasonRecord: stats !== undefined,
    };
  });

  return { players, seasonId };
}

/**
 * 棒の満点。
 *
 * 率は 1（=100%）で固定。それ以外は「比較している選手の最大値」を基準にする。
 * リーグ最大値を基準にすると、平均的な選手同士の比較で棒がどれも短くなり、
 * 差が読み取れなくなる。
 *
 * 全員が欠損なら null（棒を描かない）。
 */
export function metricMax(metric: CompareMetric, players: ComparePlayer[]): number | null {
  if (metric.max !== undefined) return metric.max;

  const values = players
    .map((p) => p.values[metric.key])
    .filter((v): v is number => v !== null && v !== undefined);

  if (values.length === 0) return null;
  const max = Math.max(...values);
  // 全員 0 のときに 0 で割らないようにする
  return max > 0 ? max : 1;
}

/**
 * その指標で優れているほうの選手の添字。
 *
 * 【比べられないときは誰も選ばない】
 * 片方が欠損なら勝ち負けを付けない。欠損を 0 とみなして
 * 「もう片方の勝ち」にすると、記録が無いだけの選手が劣って見える。
 * 同値のときも選ばない。
 */
export function bestIndex(metric: CompareMetric, players: ComparePlayer[]): number | null {
  const values = players.map((p) => p.values[metric.key] ?? null);
  if (values.some((v) => v === null)) return null;

  const numbers = values as number[];
  const target = metric.higherIsBetter ? Math.max(...numbers) : Math.min(...numbers);
  const winners = numbers.filter((v) => v === target);
  if (winners.length !== 1) return null;

  return numbers.indexOf(target);
}
