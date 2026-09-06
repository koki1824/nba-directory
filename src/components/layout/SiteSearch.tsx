"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { routes } from "@/config/routes";
import { cx } from "@/lib/cx";

/**
 * 選手・チームを名前で探す入力欄（W2-4）。
 * モック 01_top.jpg のヘッダーとヒーローにある検索欄。
 *
 * 【フォームとして作る理由】
 * Enterで送信でき、スマホのキーボードに「検索」ボタンが出る。
 * ボタンのクリックだけを拾う作りにすると、キーボードだけで使う人が困る。
 *
 * 探した結果は選手一覧に送る。専用の検索結果ページを作らないのは、
 * 一覧側に絞り込みと並び替えが揃っているため。
 */

type Props = {
  /** ヒーロー用の大きい見た目にするか */
  size?: "md" | "lg";
  className?: string;
  /** 読み上げ用のラベル。ヘッダーとヒーローで2つ出るため区別する */
  label: string;
};

export function SiteSearch({ size = "md", className, label }: Props) {
  const router = useRouter();
  const [value, setValue] = useState("");

  return (
    <form
      role="search"
      aria-label={label}
      onSubmit={(e) => {
        e.preventDefault();
        const q = value.trim();
        // 空のまま送ったら一覧をそのまま開く。エラーにしない。
        router.push(q ? `${routes.players()}?q=${encodeURIComponent(q)}` : routes.players());
      }}
      className={cx("flex w-full", className)}
    >
      <input
        type="search"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="選手名・チーム名を入力"
        aria-label={label}
        className={cx(
          "border-line-strong bg-surface text-ink min-w-0 flex-1 rounded-l-sm border border-r-0 px-3",
          size === "lg" ? "h-12 text-base" : "h-10 text-sm",
        )}
      />
      <button
        type="submit"
        className={cx(
          "bg-accent hover:bg-accent-hover grid shrink-0 place-items-center rounded-r-sm text-white transition-colors",
          size === "lg" ? "h-12 w-12" : "h-10 w-10",
        )}
      >
        {/* 虫めがね。装飾なので読み上げからは隠し、ボタン名は文字で持たせる */}
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          aria-hidden="true"
        >
          <circle cx="11" cy="11" r="7" />
          <path d="M20 20l-4.5-4.5" strokeLinecap="round" />
        </svg>
        <span className="sr-only">検索する</span>
      </button>
    </form>
  );
}
