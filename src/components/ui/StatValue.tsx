import { MissingValue, type MissingReason } from "./MissingValue";

/**
 * 数値ひとつの表示。
 *
 * 画面のあちこちで `value?.toFixed(1) ?? "—"` と書くと、必ずどこかで
 * `value ?? 0` が混ざって、記録が無いだけの選手が「0.0」になる。
 * 数値と欠損の出し分けはここ1か所に集約する。
 *
 * 0 は欠損ではない。0 と null をこの層で必ず区別する。
 */

type Props = {
  value: number | null | undefined;
  /** 小数点以下の桁数。得点や平均は1桁、率は3桁（.412 の形）が既定 */
  digits?: number;
  /** 率として % で出す。0.412 → 41.2% */
  percent?: boolean;
  /**
   * 値が無いときの理由。
   * 既定は no_data（記録が無い）。分母0で計算できない場合は
   * 呼び出し側で not_calculated を渡すこと。
   */
  missingReason?: MissingReason;
  /** 欠損の理由の補足。例:「試投0本」 */
  missingDetail?: string;
};

export function StatValue({
  value,
  digits,
  percent = false,
  missingReason = "no_data",
  missingDetail,
}: Props) {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return (
      <MissingValue reason={missingReason} {...(missingDetail ? { detail: missingDetail } : {})} />
    );
  }

  const decimals = digits ?? (percent ? 1 : 1);
  const shown = percent ? `${(value * 100).toFixed(decimals)}%` : value.toFixed(decimals);

  // data-numeric は globals.css で桁を縦に揃える指定に対応している。
  // 表で数値が踊ると比較しづらい。
  return <span data-numeric>{shown}</span>;
}
