/**
 * 欠損値の判定（W2-3）。
 *
 * オーバーライド v3 §8:「0 / NULL / N/A / Not calculated を区別する。欠損値を0扱いしない」
 *
 * 【なぜ層を分けるか】
 * 「—」と出すか「0」と出すかの判断を画面のあちこちに書くと、必ずどこかで
 * `value ?? 0` のような書き方が混ざり、記録が無いだけの選手が「0本」になる。
 * 判断はこのファイルだけで行い、画面は結果を表示するだけにする。
 *
 * 【4つの状態】
 *   値がある      0 も立派な値。「1本も決めなかった」は事実であって欠損ではない
 *   no_data        値が無い          … まだ取得していない / 記録が残っていない
 *   not_applicable 概念が当てはまらない … 例: プレーオフ未出場の選手のPO平均得点
 *   not_calculated 算出できない       … 例: 試投0本のときのFG%（0÷0）。0%ではない
 *
 * 【0% と 算出不可 の違い】
 *   10本打って0本 → 0%（決められなかったという事実）
 *    0本打って0本 → 算出不可（打っていないので成功率が存在しない）
 * この2つを同じ「0%」にすると、シュートを打たない選手が
 * 「成功率0%の下手な選手」として並ぶ。
 */

import type { MissingReason } from "@/components/ui/MissingValue";

export type { MissingReason };

export type StatValue =
  { kind: "value"; value: number } | { kind: "missing"; reason: MissingReason; detail?: string };

/** 数値として確定している値。0 もここに入る。 */
export function value(n: number): StatValue {
  return { kind: "value", value: n };
}

export function missing(reason: MissingReason, detail?: string): StatValue {
  return detail === undefined ? { kind: "missing", reason } : { kind: "missing", reason, detail };
}

export function isValue(v: StatValue): v is { kind: "value"; value: number } {
  return v.kind === "value";
}

/**
 * DBから来た数値をそのまま受ける。
 *
 * null / undefined は「記録が無い」であって 0 ではない。
 * NaN も値として扱わない（計算の失敗が画面に出るのを防ぐ）。
 */
export function fromNullable(
  n: number | null | undefined,
  reason: MissingReason = "no_data",
  detail?: string,
): StatValue {
  if (n === null || n === undefined || Number.isNaN(n)) return missing(reason, detail);
  return value(n);
}

/**
 * 割り算。率・平均・36分換算はすべてここを通す。
 *
 *   分子か分母が未取得 → no_data（計算のしようがない）
 *   分母が 0          → not_calculated（0除算。0% ではない）
 *
 * 【重要】ここで 0 を返してはいけない。
 * 「試投0本のFG%」を0%にすると、打っていない選手が最下位に並ぶ。
 */
export function divide(
  numerator: number | null | undefined,
  denominator: number | null | undefined,
  detail?: string,
): StatValue {
  if (
    numerator === null ||
    numerator === undefined ||
    Number.isNaN(numerator) ||
    denominator === null ||
    denominator === undefined ||
    Number.isNaN(denominator)
  ) {
    return missing("no_data", detail);
  }
  if (denominator === 0) return missing("not_calculated", detail ?? "分母が0");
  return value(numerator / denominator);
}

/**
 * 「その概念が当てはまらない」を明示する。
 *
 * 例: プレーオフに出ていない選手のプレーオフ平均得点。
 * これは no_data（まだ取れていない）ではない。永久に存在しない。
 * 混同すると「データ取得中」と誤解される。
 */
export function notApplicable(detail: string): StatValue {
  return missing("not_applicable", detail);
}

/**
 * 条件を満たすときだけ値を出す。満たさなければ not_applicable。
 *
 * プレーオフ欄のように「出場していなければ欄ごと意味を持たない」場面で使う。
 */
export function onlyWhen(condition: boolean, v: StatValue, detail: string): StatValue {
  return condition ? v : notApplicable(detail);
}
