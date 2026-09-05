import Link from "next/link";

import { cx } from "@/lib/cx";

/**
 * 下線タブ。モック 01_top.jpg（ランキングの指標切替）と
 * 02_compare.jpg（詳細スタッツのカテゴリ切替）の両方で使われている形。
 *
 * 用途が2つあるので、遷移するタブとその場で切り替えるタブの両方を扱えるようにしています。
 *   href あり … <a> になる。URLに状態が乗るので共有・戻るボタンが効く（一覧・ランキング向け）
 *   href なし … <button> になる。onSelect で受ける（ページ内の表示切替向け）
 */

export type TabItem = {
  id: string;
  label: string;
  /** 指定するとリンクとして描画する */
  href?: string;
  disabled?: boolean;
};

type Props = {
  items: readonly TabItem[];
  activeId: string;
  onSelect?: (id: string) => void;
  /** スクリーンリーダー向けのタブ列の名前。例:「スタッツのカテゴリ」 */
  label: string;
  className?: string;
};

const BASE =
  "relative -mb-px whitespace-nowrap border-b-2 px-4 py-2 text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-45";
// 選択状態を赤の下線で示す。決定Q10の「赤は選択状態に使う」に沿う。
const ACTIVE = "border-accent text-accent font-medium";
const INACTIVE = "border-transparent text-ink-muted hover:text-ink";

export function Tabs({ items, activeId, onSelect, label, className }: Props) {
  return (
    <div
      role="tablist"
      aria-label={label}
      className={cx("border-line flex overflow-x-auto border-b", className)}
    >
      {items.map((item) => {
        const isActive = item.id === activeId;
        const classes = cx(BASE, isActive ? ACTIVE : INACTIVE);

        if (item.href !== undefined) {
          return (
            <Link
              key={item.id}
              href={item.href}
              role="tab"
              aria-selected={isActive}
              className={classes}
            >
              {item.label}
            </Link>
          );
        }

        return (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            disabled={item.disabled}
            onClick={() => onSelect?.(item.id)}
            className={classes}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
