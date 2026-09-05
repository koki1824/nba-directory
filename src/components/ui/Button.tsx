import type { ButtonHTMLAttributes } from "react";

import { cx } from "@/lib/cx";

export type ButtonVariant = "primary" | "secondary" | "quiet";
export type ButtonSize = "sm" | "md";

const VARIANT: Record<ButtonVariant, string> = {
  // 塗りは赤。決定Q10の「赤は強調・選択状態に限定」に沿い、主要動作のみに使う。
  primary: "bg-accent text-white hover:bg-accent-hover border border-transparent",
  secondary: "bg-surface text-ink border border-line-strong hover:bg-surface-sunken",
  quiet: "bg-transparent text-ink-muted border border-transparent hover:text-ink",
};

const SIZE: Record<ButtonSize, string> = {
  sm: "h-8 px-3 text-xs",
  md: "h-10 px-4 text-sm",
};

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
};

export function Button({
  variant = "secondary",
  size = "md",
  className,
  type = "button",
  ...rest
}: Props) {
  return (
    <button
      // type を省略するとフォーム内で submit になり、意図しない送信が起きる。
      // 既定を button にして、送信したいときだけ明示させる。
      type={type}
      className={cx(
        "inline-flex items-center justify-center gap-1.5 rounded-sm transition-colors",
        "disabled:cursor-not-allowed disabled:opacity-45",
        VARIANT[variant],
        SIZE[size],
        className,
      )}
      {...rest}
    />
  );
}
