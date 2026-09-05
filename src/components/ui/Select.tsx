import type { SelectHTMLAttributes } from "react";

import { cx } from "@/lib/cx";

export type SelectOption = {
  value: string;
  label: string;
  disabled?: boolean;
};

type Props = Omit<SelectHTMLAttributes<HTMLSelectElement>, "children"> & {
  options: readonly SelectOption[];
  /** 未選択のときに出す文言。例:「シーズンを選択」 */
  placeholder?: string;
};

export function Select({ options, placeholder, className, ...rest }: Props) {
  return (
    <div className="relative inline-block w-full">
      <select
        className={cx(
          "border-line-strong bg-surface h-10 w-full appearance-none rounded-sm border",
          "text-ink pr-8 pl-3 text-sm",
          "disabled:cursor-not-allowed disabled:opacity-45",
          className,
        )}
        {...rest}
      >
        {placeholder !== undefined && (
          // value="" にして「未選択」を表現する。required と組み合わせると
          // 未選択のままの送信をブラウザが弾いてくれる。
          <option value="">{placeholder}</option>
        )}
        {options.map((option) => (
          <option key={option.value} value={option.value} disabled={option.disabled}>
            {option.label}
          </option>
        ))}
      </select>
      {/* 矢印。select 自体の装飾はブラウザ差が大きいので、appearance-none にして自前で描く。 */}
      <span
        aria-hidden="true"
        className="text-ink-muted pointer-events-none absolute top-1/2 right-3 -translate-y-1/2"
      >
        <svg width="10" height="6" viewBox="0 0 10 6" fill="none">
          <path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="1.5" />
        </svg>
      </span>
    </div>
  );
}
