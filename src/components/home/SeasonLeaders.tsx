import Link from "next/link";

import { StatBar } from "@/components/ui/StatBar";
import { StatValue } from "@/components/ui/StatValue";
import { routes } from "@/config/routes";
import type { RankingRow } from "@/db/rankings";

/**
 * 今季ランキング（W2-4）。モック 01_top.jpg の右側のパネル。
 *
 * トップから上位5人を見せて、ランキングページへ誘導する。
 *
 * 【棒の長さの基準】
 * 1位の値を満点にする。0を基準にすると、平均得点のように
 * 値の幅が狭い指標で棒がどれも同じ長さに見え、差が読めない。
 */

type Props = {
  seasonId: string;
  metricNameJa: string;
  metricCode: string;
  rows: RankingRow[];
};

export function SeasonLeaders({ seasonId, metricNameJa, metricCode, rows }: Props) {
  if (rows.length === 0) return null;

  const top = rows.slice(0, 5);
  const max = Math.max(...top.map((r) => r.value ?? 0));

  return (
    <section className="border-line bg-surface border p-6">
      <div className="flex items-baseline justify-between gap-4">
        <h2 className="text-xl">
          {seasonId} の{metricNameJa}
        </h2>
        <Link
          href={`${routes.rankings()}?metric=${metricCode}&season=${seasonId}`}
          className="text-accent hover:text-accent-hover shrink-0 text-xs"
        >
          ランキング一覧へ →
        </Link>
      </div>

      <ol className="mt-4 space-y-3">
        {top.map((row, i) => (
          <li key={row.playerId} className="grid grid-cols-[1.5rem_1fr_3.5rem] items-center gap-3">
            <span
              className={i === 0 ? "text-accent text-sm font-medium" : "text-ink-muted text-sm"}
              data-numeric
            >
              {row.rank ?? i + 1}
            </span>

            <div className="min-w-0">
              <Link
                href={routes.player(row.playerSlug)}
                className="text-ink hover:text-accent block truncate text-sm"
              >
                {row.fullNameJa ?? row.fullNameEn}
                {row.teamAbbreviation && (
                  <span className="text-ink-muted ml-2 text-xs">{row.teamAbbreviation}</span>
                )}
              </Link>
              <div className="mt-1">
                <StatBar
                  value={row.value}
                  max={max > 0 ? max : 1}
                  {...(i === 0 ? { slot: 1 as const } : {})}
                  label={`${row.fullNameJa ?? row.fullNameEn} の${metricNameJa}`}
                />
              </div>
            </div>

            <span className="text-ink text-right text-sm">
              <StatValue value={row.value} />
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}
