/**
 * 欠損値の表示。
 *
 * オーバーライド v3 §8:「0 / NULL / N/A / Not calculated を区別する。欠損値を0扱いしない」
 *
 * この3つは意味がまったく違います。混ぜると数字が嘘になります。
 *   no_data        値が無い          … まだ取得していない / 記録が残っていない
 *   not_applicable 概念が当てはまらない … 例: プレーオフ未出場の選手のPO平均得点
 *   not_calculated 算出できない       … 例: 試投0本のときのFG%（0÷0）。0%ではない
 *
 * 0 は欠損ではないので、このコンポーネントを使わず数値として表示すること。
 */

export type MissingReason = "no_data" | "not_applicable" | "not_calculated";

const PRESENTATION: Record<MissingReason, { glyph: string; description: string }> = {
  no_data: { glyph: "—", description: "データなし" },
  not_applicable: { glyph: "N/A", description: "該当なし" },
  not_calculated: { glyph: "算出不可", description: "算出条件を満たしません" },
};

type Props = {
  reason: MissingReason;
  /** 「なぜ出せないか」を具体的に補足する。例:「プレーオフ未出場」 */
  detail?: string;
};

export function MissingValue({ reason, detail }: Props) {
  const { glyph, description } = PRESENTATION[reason];
  const label = detail ? `${description}（${detail}）` : description;

  return (
    <span
      className="text-ink-muted"
      // 見た目は記号でも、読み上げと hover では意味が分かるようにする。
      // 「—」だけだと0との区別がつかない。
      title={label}
      aria-label={label}
      data-missing={reason}
    >
      {glyph}
    </span>
  );
}
