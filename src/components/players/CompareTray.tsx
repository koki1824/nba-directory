"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { Button } from "@/components/ui/Button";
import { MAX_COMPARE_PLAYERS, parseComparePlayers, routes } from "@/config/routes";

/**
 * 比較トレー（W2-5）。中核機能への入口。
 *
 * 一覧で選手を選び、下に溜めて、まとめて比較へ進む。
 *
 * 【選択をURLに持つ理由】
 * 選んだ状態のまま人に送れる。戻るボタンも効く。
 * 画面の中だけに持つと、再読み込みで消えて選び直しになる。
 *
 * 【上限を超えたときにエラーにしない理由】
 * 上限は4人（docs/DECISIONS.md §2）。5人目を押したときに
 * 何も起きないと「壊れている」と思われるので、理由を出す。
 */

export function useCompareSelection() {
  const searchParams = useSearchParams();
  return parseComparePlayers(searchParams.getAll("p"));
}

export function CompareToggleButton({ slug, name }: { slug: string; name: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const selected = parseComparePlayers(searchParams.getAll("p"));

  const isSelected = selected.includes(slug);
  const isFull = selected.length >= MAX_COMPARE_PLAYERS;

  function toggle() {
    const next = new URLSearchParams(searchParams.toString());
    const updated = isSelected ? selected.filter((s) => s !== slug) : [...selected, slug];

    next.delete("p");
    for (const s of updated.slice(0, MAX_COMPARE_PLAYERS)) next.append("p", s);

    router.push(`${pathname}?${next.toString()}`, { scroll: false });
  }

  return (
    <Button
      size="sm"
      variant={isSelected ? "primary" : "secondary"}
      onClick={toggle}
      disabled={!isSelected && isFull}
      // ボタンの見た目だけでは「選択中」が伝わらない場合がある。
      // 読み上げにも状態を伝える。
      aria-pressed={isSelected}
      aria-label={isSelected ? `${name} を比較から外す` : `${name} を比較に追加`}
      title={!isSelected && isFull ? `比較できるのは${MAX_COMPARE_PLAYERS}人までです` : undefined}
    >
      {isSelected ? "選択中" : "比較"}
    </Button>
  );
}

export function CompareTray({ names }: { names: Record<string, string> }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const selected = parseComparePlayers(searchParams.getAll("p"));

  if (selected.length === 0) return null;

  function remove(slug: string) {
    const next = new URLSearchParams(searchParams.toString());
    next.delete("p");
    for (const s of selected.filter((x) => x !== slug)) next.append("p", s);
    router.push(`${pathname}?${next.toString()}`, { scroll: false });
  }

  function clear() {
    const next = new URLSearchParams(searchParams.toString());
    next.delete("p");
    router.push(`${pathname}?${next.toString()}`, { scroll: false });
  }

  return (
    // 画面下に貼り付ける。一覧を長くスクロールしても、選んだ人と
    // 「比較する」がいつでも見えるようにするため。
    <div
      className="border-line bg-surface fixed inset-x-0 bottom-0 z-20 border-t shadow-[0_-2px_12px_-6px_rgb(15_29_45/0.25)]"
      role="region"
      aria-label="比較する選手"
    >
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-6 py-3">
        <span className="text-ink-muted text-xs">
          比較する選手（{selected.length} / {MAX_COMPARE_PLAYERS}）
        </span>

        <ul className="flex flex-wrap items-center gap-2">
          {selected.map((slug) => (
            <li key={slug}>
              <button
                type="button"
                onClick={() => remove(slug)}
                className="border-line-strong bg-canvas text-ink hover:border-accent hover:text-accent inline-flex items-center gap-1.5 rounded-sm border px-2.5 py-1 text-xs transition-colors"
                aria-label={`${names[slug] ?? slug} を比較から外す`}
              >
                {names[slug] ?? slug}
                <span aria-hidden="true">×</span>
              </button>
            </li>
          ))}
        </ul>

        <div className="ml-auto flex items-center gap-2">
          <Button size="sm" variant="quiet" onClick={clear}>
            すべて外す
          </Button>
          <Link
            href={routes.compare(selected)}
            className="bg-accent hover:bg-accent-hover inline-flex h-8 items-center rounded-sm px-3 text-xs text-white transition-colors"
          >
            {selected.length === 1 ? "この選手を見る" : "比較する"} →
          </Link>
        </div>
      </div>
    </div>
  );
}
