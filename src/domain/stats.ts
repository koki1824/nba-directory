/**
 * 成績の計算（W2-2）。
 *
 * 【このファイルの立場】
 * 同じ計算がDBのビュー（0002_views.sql）にもある。二重に持つのは意図的で、
 * ビューは一覧やランキングをDB側で速く出すため、こちらは
 * 画面上で組み替える場面（比較で任意のシーズンを足す等）のために使う。
 *
 * **二重に持つ以上、食い違えば嘘になる。** そのため
 *   ・式は必ずこのファイルに集約する（画面に直接書かない）
 *   ・ビューと同じ答えになることをテストで固定する
 * の2点を守る。片方だけ直すのが最も危険なので、式を変えるときは
 * 必ず supabase/migrations 側も一緒に見ること。
 *
 * 【絶対に破ってはいけない3つ】（オーバーライド v3 §8）
 *   1. 欠損値を0扱いしない        → missing.ts に判断を寄せる
 *   2. キャリア値をシーズン率の単純平均で出さない → 合計してから割る
 *   3. チーム成績を個人成績の合計で代用しない   → ここでは扱わない（DBの公式値を使う）
 */

import { divide, fromNullable, missing, notApplicable, type StatValue } from "./missing";

/**
 * 計算に必要な実数だけを持つ形。
 * 率は受け取らない。丸められた率を入力にすると、
 * 「試投0本」と「0%」の区別が失われるため。
 */
export type StatCounts = {
  gamesPlayed: number | null;
  minutes: number | null;
  fieldGoalsMade: number | null;
  fieldGoalsAttempted: number | null;
  threePointersMade: number | null;
  threePointersAttempted: number | null;
  freeThrowsMade: number | null;
  freeThrowsAttempted: number | null;
  offensiveRebounds: number | null;
  defensiveRebounds: number | null;
  assists: number | null;
  steals: number | null;
  blocks: number | null;
  turnovers: number | null;
  points: number | null;
};

// --- 率 ---------------------------------------------------------------------

/** FG% = FGM / FGA。試投0本は算出不可（0%ではない）。 */
export function fieldGoalPct(s: StatCounts): StatValue {
  return divide(s.fieldGoalsMade, s.fieldGoalsAttempted, "試投0本");
}

export function threePointPct(s: StatCounts): StatValue {
  return divide(s.threePointersMade, s.threePointersAttempted, "3P試投0本");
}

export function freeThrowPct(s: StatCounts): StatValue {
  return divide(s.freeThrowsMade, s.freeThrowsAttempted, "FT試投0本");
}

/**
 * eFG% = (FGM + 0.5 × 3PM) / FGA
 * 3Pは2Pより1点多いので、その価値を織り込んだ成功率。
 */
export function effectiveFieldGoalPct(s: StatCounts): StatValue {
  if (s.fieldGoalsMade === null || s.threePointersMade === null) return missing("no_data");
  return divide(s.fieldGoalsMade + 0.5 * s.threePointersMade, s.fieldGoalsAttempted, "試投0本");
}

/**
 * TS% = PTS / (2 × (FGA + 0.44 × FTA))
 * フリースローも含めた総合的な得点効率。0.44 はFT獲得の平均的な試投換算係数。
 */
export function trueShootingPct(s: StatCounts): StatValue {
  if (s.fieldGoalsAttempted === null || s.freeThrowsAttempted === null) return missing("no_data");
  return divide(s.points, 2 * (s.fieldGoalsAttempted + 0.44 * s.freeThrowsAttempted), "試投0本");
}

// --- リバウンド --------------------------------------------------------------

/**
 * 総リバウンド = オフェンス + ディフェンス。
 * 片方でも未取得なら合計も出さない。0として足すと、
 * 記録が無いだけの選手が「少ない」と誤解される。
 */
export function totalRebounds(s: StatCounts): StatValue {
  if (s.offensiveRebounds === null || s.defensiveRebounds === null) return missing("no_data");
  return fromNullable(s.offensiveRebounds + s.defensiveRebounds);
}

// --- 1試合平均 ---------------------------------------------------------------

function perGame(total: number | null, gamesPlayed: number | null): StatValue {
  return divide(total, gamesPlayed, "出場0試合");
}

export function pointsPerGame(s: StatCounts): StatValue {
  return perGame(s.points, s.gamesPlayed);
}

export function reboundsPerGame(s: StatCounts): StatValue {
  const reb = totalRebounds(s);
  if (reb.kind === "missing") return reb;
  return perGame(reb.value, s.gamesPlayed);
}

export function assistsPerGame(s: StatCounts): StatValue {
  return perGame(s.assists, s.gamesPlayed);
}

export function stealsPerGame(s: StatCounts): StatValue {
  return perGame(s.steals, s.gamesPlayed);
}

export function blocksPerGame(s: StatCounts): StatValue {
  return perGame(s.blocks, s.gamesPlayed);
}

export function turnoversPerGame(s: StatCounts): StatValue {
  return perGame(s.turnovers, s.gamesPlayed);
}

export function minutesPerGame(s: StatCounts): StatValue {
  return perGame(s.minutes, s.gamesPlayed);
}

// --- 36分換算 ---------------------------------------------------------------

/**
 * 36分換算。出場時間の違いを揃えて比べるための指標。
 * 控え選手と主力を同じ土俵で見るときに使う。
 *
 * 出場0分は算出不可。0として出すと、出ていない選手が
 * 「36分出ても0点」の選手に見える。
 */
function per36(total: number | null, minutes: number | null): StatValue {
  if (total === null || minutes === null) return missing("no_data");
  return divide(total * 36, minutes, "出場0分");
}

export function pointsPer36(s: StatCounts): StatValue {
  return per36(s.points, s.minutes);
}

export function reboundsPer36(s: StatCounts): StatValue {
  const reb = totalRebounds(s);
  if (reb.kind === "missing") return reb;
  return per36(reb.value, s.minutes);
}

export function assistsPer36(s: StatCounts): StatValue {
  return per36(s.assists, s.minutes);
}

export function stealsPer36(s: StatCounts): StatValue {
  return per36(s.steals, s.minutes);
}

export function blocksPer36(s: StatCounts): StatValue {
  return per36(s.blocks, s.minutes);
}

// --- キャリア集計 -------------------------------------------------------------

/**
 * シーズン成績の1行。キャリア集計の入力。
 *
 * stintId が入っている行は「シーズン途中の移籍で分割された行」で、
 * 同じシーズンの合計行と中身が重複する。集計時に必ず除外する。
 */
export type SeasonRow = StatCounts & {
  seasonId: string;
  stintId: string | null;
};

export type CareerTotals = StatCounts & {
  seasonsPlayed: number;
  /**
   * 合計に「記録が無いシーズン」が混ざっているか。
   *
   * SQL の sum() と同じく null は飛ばして合計するため、
   * 数値としては出るが「全期間の合計」ではない場合がある。
   * 画面では注記を出せるようにこのフラグを立てておく。
   */
  isPartial: boolean;
};

/**
 * 合計。null は飛ばす（SQL の sum() と同じ挙動）。
 * 全部が null のときは合計そのものを出さない（0 にしない）。
 *
 * partial =「数値は出るが、全期間の合計ではない」。
 * 一部のシーズンだけ記録があり、残りが欠けている状態を指す。
 *
 * 【注意】全シーズンで欠けている項目は partial ではない。
 * そのときは合計自体を出さない（null）ので、少なく見える心配がない。
 * ここを「1つでも欠けたら partial」にすると、
 * 未取得の項目が1つあるだけで注記が出っぱなしになり、
 * 本当に一部だけ欠けている場合の警告が埋もれる。
 */
function sumField(
  rows: SeasonRow[],
  key: keyof StatCounts,
): { total: number | null; partial: boolean } {
  let total = 0;
  let seen = 0;
  let skipped = 0;

  for (const row of rows) {
    const v = row[key];
    if (v === null || v === undefined || Number.isNaN(v)) {
      skipped += 1;
      continue;
    }
    total += v;
    seen += 1;
  }

  if (seen === 0) return { total: null, partial: false };
  return { total, partial: skipped > 0 };
}

/**
 * シーズン合計行だけを残す。
 *
 * stint別の行を含めると同じ成績を二重に数える。
 * 例: シーズン途中で移籍した選手は「移籍前」「移籍後」「シーズン合計」の
 *     3行を持つため、素直に足すと2倍になる。
 */
export function seasonTotalRows(rows: SeasonRow[]): SeasonRow[] {
  return rows.filter((r) => r.stintId === null);
}

/**
 * キャリア通算。
 *
 * 【最重要】実数を合計してから率を出す。シーズンごとの率を平均してはいけない。
 *
 *   1本中1本成功(100%) と 100本中40本(40%) のシーズンを平均すると 70%
 *   正しくは (1+40) / (1+100) = 41/101 = 40.6%
 *
 * 試投数の重みを無視すると、ほとんど打っていないシーズンが
 * 通算成功率を大きく押し上げてしまう。
 */
export function careerTotals(rows: SeasonRow[]): CareerTotals {
  const seasonRows = seasonTotalRows(rows);

  const fields: (keyof StatCounts)[] = [
    "gamesPlayed",
    "minutes",
    "fieldGoalsMade",
    "fieldGoalsAttempted",
    "threePointersMade",
    "threePointersAttempted",
    "freeThrowsMade",
    "freeThrowsAttempted",
    "offensiveRebounds",
    "defensiveRebounds",
    "assists",
    "steals",
    "blocks",
    "turnovers",
    "points",
  ];

  const totals = {} as StatCounts;
  let isPartial = false;

  for (const field of fields) {
    const { total, partial } = sumField(seasonRows, field);
    totals[field] = total;
    if (partial) isPartial = true;
  }

  return {
    ...totals,
    // 同じシーズンが複数行あっても1シーズンとして数える
    seasonsPlayed: new Set(seasonRows.map((r) => r.seasonId)).size,
    isPartial,
  };
}

// --- プレーオフ ---------------------------------------------------------------

/**
 * プレーオフ欄の値。
 *
 * 出場していない選手は not_applicable。no_data ではない。
 * 「まだデータを入れていない」と「その年は出ていない」を混ぜてはいけない。
 */
export function playoffValue(hasPlayoffAppearance: boolean, compute: () => StatValue): StatValue {
  if (!hasPlayoffAppearance) return notApplicable("プレーオフ未出場");
  return compute();
}
