"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

import { Select } from "@/components/ui/Select";

/**
 * 選手一覧の絞り込み（W2-5）。
 *
 * 【URLに状態を持たせる理由】
 * 絞り込んだ結果をそのまま人に送れるようにするため。
 * 画面の中だけに状態を持つと、送られた側は最初から操作し直すことになる。
 * 戻るボタンも効かなくなる。
 *
 * 【入力のたびに検索しない】
 * 名前の入力は少し待ってから反映する。1文字ごとにサーバーへ問い合わせると、
 * 打っている途中の中途半端な語で検索が何度も走る。
 */

type Props = {
  teams: { abbreviation: string; nameJa: string | null; nameEn: string }[];
  positions: string[];
  seasons: string[];
};

const SORT_OPTIONS = [
  { value: "name", label: "名前順" },
  { value: "points", label: "平均得点が多い順" },
  { value: "rebounds", label: "平均リバウンドが多い順" },
  { value: "assists", label: "平均アシストが多い順" },
  { value: "minutes", label: "出場時間が長い順" },
];

export function PlayerFilters({ teams, positions, seasons }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [q, setQ] = useState(searchParams.get("q") ?? "");

  // 戻る・進むでURLが変わったとき、入力欄の中身も合わせる。
  // 合わせないと、URLは戻ったのに検索欄だけ古いままになる。
  useEffect(() => {
    setQ(searchParams.get("q") ?? "");
  }, [searchParams]);

  function updateParam(key: string, value: string) {
    const next = new URLSearchParams(searchParams.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    // 絞り込みを変えたら1ページ目に戻る。
    // 戻さないと「3ページ目のまま絞り込んで0件」になり、
    // 該当が無いのか押し間違えたのか分からなくなる。
    next.delete("page");
    router.push(`${pathname}?${next.toString()}`);
  }

  // 入力が止まってから反映する
  useEffect(() => {
    const current = searchParams.get("q") ?? "";
    if (q === current) return;

    const timer = setTimeout(() => {
      updateParam("q", q);
    }, 300);
    return () => clearTimeout(timer);
    // updateParam は毎回作り直されるので依存に入れない。
    // 入れると入力のたびにタイマーが張り直されて永久に発火しない。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, searchParams]);

  return (
    <div className="border-line bg-surface mb-6 grid gap-3 border p-4 sm:grid-cols-2 lg:grid-cols-4">
      <div>
        <label htmlFor="player-search" className="text-ink-muted mb-1 block text-xs">
          名前で探す
        </label>
        <input
          id="player-search"
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="日本語・英語のどちらでも"
          className="border-line-strong bg-surface text-ink h-10 w-full rounded-sm border px-3 text-sm"
        />
      </div>

      <div>
        <label htmlFor="player-team" className="text-ink-muted mb-1 block text-xs">
          チーム
        </label>
        <Select
          id="player-team"
          value={searchParams.get("team") ?? ""}
          onChange={(e) => updateParam("team", e.target.value)}
          placeholder="すべてのチーム"
          options={teams.map((t) => ({
            value: t.abbreviation,
            label: `${t.nameJa ?? t.nameEn}（${t.abbreviation}）`,
          }))}
        />
      </div>

      <div>
        <label htmlFor="player-position" className="text-ink-muted mb-1 block text-xs">
          ポジション
        </label>
        <Select
          id="player-position"
          value={searchParams.get("position") ?? ""}
          onChange={(e) => updateParam("position", e.target.value)}
          placeholder="すべて"
          options={positions.map((p) => ({ value: p, label: p }))}
        />
      </div>

      <div>
        <label htmlFor="player-season" className="text-ink-muted mb-1 block text-xs">
          シーズン
        </label>
        <Select
          id="player-season"
          value={searchParams.get("season") ?? ""}
          onChange={(e) => updateParam("season", e.target.value)}
          placeholder="最新シーズン"
          options={seasons.map((s) => ({ value: s, label: s }))}
        />
      </div>

      <div className="sm:col-span-2 lg:col-span-1">
        <label htmlFor="player-sort" className="text-ink-muted mb-1 block text-xs">
          並び順
        </label>
        <Select
          id="player-sort"
          value={searchParams.get("sort") ?? "name"}
          onChange={(e) => updateParam("sort", e.target.value)}
          options={SORT_OPTIONS}
        />
      </div>
    </div>
  );
}
