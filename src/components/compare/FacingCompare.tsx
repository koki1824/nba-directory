import Link from "next/link";

import { MissingValue } from "@/components/ui/MissingValue";
import { StatBar, type SlotIndex } from "@/components/ui/StatBar";
import { StatValue } from "@/components/ui/StatValue";
import { routes } from "@/config/routes";
import { bestIndex, metricMax, type ComparePlayer, type CompareMetric } from "@/db/compare";

/**
 * 2人の向かい合わせ比較（W2-7）。モック 02_compare.jpg の形。
 *
 * 【この形にする理由】
 * 中央に指標名を置き、左右へ棒を伸ばす。
 * どちらが長いかを目で追うだけで差が分かる。
 *
 * 【色だけで区別しない】
 * 選手の色（赤・青）は明度がほぼ同じで、色覚特性やモノクロ印刷では
 * 見分けられない（docs/DECISIONS.md の比較スロット色の注記）。
 * かならず名前を併記する。
 *
 * 【比べられないときは勝ち負けを付けない】
 * 片方が欠損なら、どちらが優れているかを示さない。
 * 欠損を 0 とみなすと、記録が無いだけの選手が劣って見える。
 */

type Props = {
  players: [ComparePlayer, ComparePlayer];
  metrics: CompareMetric[];
};

const SLOTS: [SlotIndex, SlotIndex] = [1, 2];

export function FacingCompare({ players, metrics }: Props) {
  const [left, right] = players;

  return (
    <div>
      <div className="border-line grid grid-cols-[1fr_auto_1fr] items-end gap-4 border-b pb-4">
        <PlayerHead player={left} slot={SLOTS[0]} align="left" label="A" />
        <span className="text-ink-muted pb-2 text-xs">比較</span>
        <PlayerHead player={right} slot={SLOTS[1]} align="right" label="B" />
      </div>

      <ul className="mt-6 space-y-5">
        {metrics.map((metric) => {
          const max = metricMax(metric, players);
          const winner = bestIndex(metric, players);
          const leftValue = left.values[metric.key] ?? null;
          const rightValue = right.values[metric.key] ?? null;

          return (
            <li key={metric.key}>
              <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
                <div className="text-right">
                  <span className={winner === 0 ? "text-ink font-medium" : "text-ink-muted"}>
                    <Value metric={metric} value={leftValue} player={left} />
                  </span>
                </div>

                <div className="min-w-28 text-center">
                  <span className="text-ink-muted text-xs">{metric.label}</span>
                  {!metric.higherIsBetter && (
                    <span className="text-ink-muted block text-[10px]">少ないほど良い</span>
                  )}
                </div>

                <div className="text-left">
                  <span className={winner === 1 ? "text-ink font-medium" : "text-ink-muted"}>
                    <Value metric={metric} value={rightValue} player={right} />
                  </span>
                </div>
              </div>

              <div className="mt-1.5 grid grid-cols-[1fr_auto_1fr] items-center gap-3">
                <StatBar
                  value={max === null ? null : leftValue}
                  max={max ?? 1}
                  slot={SLOTS[0]}
                  direction="rtl"
                  label={`${left.profile.fullNameJa ?? left.profile.fullNameEn} の${metric.label}`}
                />
                <span className="min-w-28" />
                <StatBar
                  value={max === null ? null : rightValue}
                  max={max ?? 1}
                  slot={SLOTS[1]}
                  label={`${right.profile.fullNameJa ?? right.profile.fullNameEn} の${metric.label}`}
                />
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function Value({
  metric,
  value,
  player,
}: {
  metric: CompareMetric;
  value: number | null;
  player: ComparePlayer;
}) {
  // その選手にそのシーズンの記録が無い場合と、
  // 記録はあるが計算できない場合を区別する。
  if (!player.hasSeasonRecord) {
    return <MissingValue reason="not_applicable" detail="このシーズンの出場記録がありません" />;
  }
  return (
    <StatValue
      value={value}
      percent={metric.percent}
      missingReason="not_calculated"
      missingDetail="算出条件を満たしません"
    />
  );
}

function PlayerHead({
  player,
  slot,
  align,
  label,
}: {
  player: ComparePlayer;
  slot: SlotIndex;
  align: "left" | "right";
  label: string;
}) {
  const name = player.profile.fullNameJa ?? player.profile.fullNameEn;
  const slotBorder = slot === 1 ? "border-slot-1" : "border-slot-2";

  return (
    <div className={align === "right" ? "text-right" : "text-left"}>
      {/* 色は補助。ラベル（A / B）と名前を必ず出す。 */}
      <span className={`text-ink-muted border-b-2 pb-0.5 text-[11px] ${slotBorder}`}>{label}</span>
      <h2 className="mt-2 text-xl leading-tight">
        <Link href={routes.player(player.profile.slug)} className="hover:text-accent">
          {name}
        </Link>
      </h2>
      <p className="text-ink-muted mt-1 text-xs">
        {player.teamNameJa ?? player.teamAbbreviation ?? "所属不明"}
        {player.profile.position ? ` ・ ${player.profile.position}` : ""}
      </p>
    </div>
  );
}
