import type { ReactNode, ThHTMLAttributes, TdHTMLAttributes } from "react";

import { cx } from "@/lib/cx";

/**
 * スタッツ表の骨組み。
 *
 * 横長の表は画面幅を超えるので、必ず Table 自身がスクロール枠を持ちます
 * （要件定義書 §13「横長表は必要最小限の横scroll」）。
 * ページ全体が横に伸びると、モバイルで他の要素まで巻き添えになるためです。
 */

type TableProps = {
  children: ReactNode;
  /** 表が何の一覧かを説明する。スクリーンリーダーが最初に読む。 */
  caption: string;
  /** caption を目に見える見出しとしても出すか */
  showCaption?: boolean;
  /**
   * 列が多く、狭い画面では確実にはみ出す表に付ける。
   * 「横に振れば続きがある」と気づけるよう、小さい画面でだけ一言添える。
   * スクロールできること自体は見た目から分かりにくく、
   * 右側の列があることに気づかないまま読み終える人が出る。
   */
  wide?: boolean;
  className?: string;
};

export function Table({
  children,
  caption,
  showCaption = false,
  wide = false,
  className,
}: TableProps) {
  return (
    <div className="w-full">
      <div className="w-full overflow-x-auto">
        <table className={cx("w-full border-collapse text-sm", className)}>
          <caption
            className={cx(
              "text-ink-muted text-left",
              showCaption ? "pb-2 text-xs" : "sr-only", // sr-only = 目には見えないが読み上げられる
            )}
          >
            {caption}
          </caption>
          {children}
        </table>
      </div>
      {wide && (
        // 広い画面では収まるので出さない。
        <p className="text-ink-muted mt-2 text-[11px] sm:hidden">→ 横にスクロールできます</p>
      )}
    </div>
  );
}

type CellProps = {
  align?: "left" | "center" | "right";
};

const ALIGN = {
  left: "text-left",
  center: "text-center",
  right: "text-right",
} as const;

type ThProps = ThHTMLAttributes<HTMLTableCellElement> & CellProps;

export function Th({ align = "left", className, scope = "col", ...rest }: ThProps) {
  return (
    <th
      // scope が無いと、読み上げ時にどのセルがどの見出しに属するか分からなくなる。
      scope={scope}
      className={cx(
        "border-line bg-surface text-ink-muted border-b px-3 py-2 font-medium",
        ALIGN[align],
        className,
      )}
      {...rest}
    />
  );
}

type TdProps = TdHTMLAttributes<HTMLTableCellElement> & CellProps;

export function Td({ align = "left", className, ...rest }: TdProps) {
  return (
    <td
      className={cx("border-line text-ink border-b px-3 py-2", ALIGN[align], className)}
      {...rest}
    />
  );
}
