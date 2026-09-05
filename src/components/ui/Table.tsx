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
  className?: string;
};

export function Table({ children, caption, showCaption = false, className }: TableProps) {
  return (
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
