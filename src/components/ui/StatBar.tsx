import { cx } from "@/lib/cx";
import { MissingValue, type MissingReason } from "./MissingValue";

/**
 * 数値を横棒で見せる部品。ランキングの相対量と、比較のリーグ内パーセンタイルの両方で使う。
 *
 * モック 02_compare.jpg では2本の棒が中央を挟んで向かい合い、下に 0/25/50/75/100 の目盛が付きます。
 * その「向かい合わせ」は direction で作ります（左の選手は rtl、右の選手は ltr）。
 *
 * 棒そのものは aria-hidden にしています。数値を隣にテキストで出すので、
 * 読み上げで同じ情報を二度言わせないためです。棒は数値の飾りという位置づけ。
 */

export type SlotIndex = 1 | 2 | 3 | 4;

const SLOT_BAR: Record<SlotIndex, string> = {
  1: "bg-slot-1",
  2: "bg-slot-2",
  3: "bg-slot-3",
  4: "bg-slot-4",
};

const SLOT_TEXT: Record<SlotIndex, string> = {
  1: "text-slot-1",
  2: "text-slot-2",
  3: "text-slot-3",
  4: "text-slot-4",
};

type Props = {
  /** null のときは棒を描かず、欠損値として表示する */
  value: number | null;
  /** value が null のときの理由。0 と欠損を混同させないため既定は「データなし」 */
  missingReason?: MissingReason;
  /** 満点。パーセンタイルなら 100 */
  max?: number;
  /** 比較スロットの色。省略時はメインの濃紺 */
  slot?: SlotIndex;
  /** 棒の伸びる向き。rtl は右端から左へ伸びる（向かい合わせレイアウト用） */
  direction?: "ltr" | "rtl";
  /** 0/25/50/75/100 の目盛を出す */
  showScale?: boolean;
  /** この棒が何の値かを説明する。例:「得点のリーグ内パーセンタイル」 */
  label: string;
  className?: string;
};

const SCALE_TICKS = [0, 25, 50, 75, 100] as const;

export function StatBar({
  value,
  missingReason = "no_data",
  max = 100,
  slot,
  direction = "ltr",
  showScale = false,
  label,
  className,
}: Props) {
  if (value === null) {
    return (
      <div className={cx("flex items-center gap-2", className)}>
        <MissingValue reason={missingReason} detail={label} />
      </div>
    );
  }

  // 範囲外の値でも棒がはみ出さないように丸める。データ側の異常は棒を壊さない。
  const ratio = max === 0 ? 0 : Math.min(Math.max(value / max, 0), 1);
  const isRtl = direction === "rtl";

  return (
    <div className={cx("w-full", className)}>
      <div className={cx("flex items-center gap-2", isRtl && "flex-row-reverse")}>
        <span
          data-numeric=""
          className={cx("shrink-0 text-sm font-medium", slot ? SLOT_TEXT[slot] : "text-ink")}
        >
          {value}
        </span>
        <div
          aria-hidden="true"
          className="bg-surface-sunken h-2 min-w-0 flex-1 rounded-sm"
          data-testid="statbar-track"
        >
          <div
            className={cx("h-full rounded-sm", slot ? SLOT_BAR[slot] : "bg-ink")}
            style={{ width: `${ratio * 100}%`, marginLeft: isRtl ? "auto" : undefined }}
            data-testid="statbar-fill"
          />
        </div>
      </div>

      {showScale && (
        <div
          aria-hidden="true"
          className={cx(
            "text-ink-muted mt-1 flex justify-between text-[10px]",
            isRtl && "flex-row-reverse",
          )}
        >
          {SCALE_TICKS.map((tick) => (
            <span key={tick}>{tick}</span>
          ))}
        </div>
      )}

      <span className="sr-only">
        {label}: {value} / {max}
      </span>
    </div>
  );
}
