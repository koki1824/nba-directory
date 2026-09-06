"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { Select } from "@/components/ui/Select";
import type { MetricOption } from "@/db/rankings";

/**
 * ランキングの切り替え（W2-10）。
 *
 * 指標・シーズン・種別をURLに持たせる。
 * 「得点王のページ」をそのまま人に送れるようにするため。
 */

type Props = {
  metrics: MetricOption[];
  seasons: string[];
  metric: string;
  season: string;
  seasonType: "regular" | "playoff";
};

export function RankingControls({ metrics, seasons, metric, season, seasonType }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function update(key: string, value: string) {
    const next = new URLSearchParams(searchParams.toString());
    next.set(key, value);
    router.push(`${pathname}?${next.toString()}`);
  }

  return (
    <div className="border-line bg-surface grid gap-3 border p-4 sm:grid-cols-3">
      <div>
        <label htmlFor="ranking-metric" className="text-ink-muted mb-1 block text-xs">
          指標
        </label>
        <Select
          id="ranking-metric"
          value={metric}
          onChange={(e) => update("metric", e.target.value)}
          options={metrics.map((m) => ({ value: m.code, label: m.nameJa }))}
        />
      </div>

      <div>
        <label htmlFor="ranking-season" className="text-ink-muted mb-1 block text-xs">
          シーズン
        </label>
        <Select
          id="ranking-season"
          value={season}
          onChange={(e) => update("season", e.target.value)}
          options={seasons.map((s) => ({ value: s, label: s }))}
        />
      </div>

      <div>
        <label htmlFor="ranking-type" className="text-ink-muted mb-1 block text-xs">
          種別
        </label>
        <Select
          id="ranking-type"
          value={seasonType}
          onChange={(e) => update("type", e.target.value)}
          options={[
            { value: "regular", label: "レギュラーシーズン" },
            { value: "playoff", label: "プレーオフ" },
          ]}
        />
      </div>
    </div>
  );
}
