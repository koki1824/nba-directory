import Link from "next/link";

import { MissingValue } from "@/components/ui/MissingValue";
import { StatBar, type SlotIndex } from "@/components/ui/StatBar";
import { StatValue } from "@/components/ui/StatValue";
import { routes } from "@/config/routes";
import { bestIndex, metricMax, type ComparePlayer, type CompareMetric } from "@/db/compare";

/**
 * 2人の向かい合わせ比較（W2-7 / モバイル対応 W2-11）。モック 02_compare.jpg の形。
 *
 * 【広い画面】
 * 中央に指標名を置き、左右へ棒を伸ばす。
 * どちらが長いかを目で追うだけで差が分かる。
 *
 * 【狭い画面】
 * 向かい合わせは横に3列必要で、スマホの幅に収まらない。
 * 実測で 412px の画面に対して 498px はみ出していた。
 * 狭いときは**縦積み**にして、指標名の下に2人ぶんを重ねて置く。
 * 棒は左端から同じ向きに伸ばすので、長さの比較はそのままできる。
 *
 * 選手名は上部に固定して、スクロールしても「どちらが誰か」を見失わないようにする。
 *
 * 【色だけで区別しない】
 * 選手の色（赤・青）は明度がほぼ同じで、色覚特性やモノクロ印刷では
 * 見分けられない（docs/DECISIONS.md の比較スロット色の注記）。
 * かならず名前とラベル（A / B）を併記する。
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
const LABELS = ["A", "B"] as const;

function nameOf(player: ComparePlayer): string {
  return player.profile.fullNameJa ?? player.profile.fullNameEn;
}

export function FacingCompare({ players, metrics }: Props) {
  const [left, right] = players;

  return (
    <div>
      {/* スクロールしても誰と誰かを見失わないよう、狭い画面では上部に貼り付ける。 */}
      <div className="border-line bg-canvas sticky top-0 z-10 grid grid-cols-2 gap-4 border-b py-3 sm:static sm:grid-cols-[1fr_auto_1fr] sm:items-end sm:py-0 sm:pb-4">
        <PlayerHead player={left} slot={SLOTS[0]} align="left" label={LABELS[0]} />
        <span className="text-ink-muted hidden pb-2 text-xs sm:block">比較</span>
        <PlayerHead player={right} slot={SLOTS[1]} align="right" label={LABELS[1]} />
      </div>

      <ul className="mt-6 space-y-6 sm:space-y-5">
        {metrics.map((metric) => {
          const max = metricMax(metric, players);
          const winner = bestIndex(metric, players);

          return (
            <li key={metric.key}>
              {/* --- 狭い画面: 縦積み --- */}
              <div className="sm:hidden">
                <div className="text-ink-muted text-center text-xs">
                  {metric.label}
                  {!metric.higherIsBetter && (
                    <span className="ml-1 text-[10px]">（少ないほど良い）</span>
                  )}
                </div>
                <div className="mt-2 space-y-2">
                  {players.map((player, i) => (
                    <div key={player.profile.id}>
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="text-ink-muted truncate text-xs">
                          {LABELS[i]} {nameOf(player)}
                        </span>
                        <span
                          className={
                            winner === i
                              ? "text-ink shrink-0 font-medium"
                              : "text-ink-muted shrink-0"
                          }
                        >
                          <Value
                            metric={metric}
                            value={player.values[metric.key] ?? null}
                            player={player}
                          />
                        </span>
                      </div>
                      <div className="mt-1">
                        <StatBar
                          value={max === null ? null : (player.values[metric.key] ?? null)}
                          max={max ?? 1}
                          slot={SLOTS[i]}
                          label={`${nameOf(player)} の${metric.label}`}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* --- 広い画面: 向かい合わせ --- */}
              <div className="hidden sm:block">
                <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
                  <div className="text-right">
                    <span className={winner === 0 ? "text-ink font-medium" : "text-ink-muted"}>
                      <Value
                        metric={metric}
                        value={left.values[metric.key] ?? null}
                        player={left}
                      />
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
                      <Value
                        metric={metric}
                        value={right.values[metric.key] ?? null}
                        player={right}
                      />
                    </span>
                  </div>
                </div>

                <div className="mt-1.5 grid grid-cols-[1fr_auto_1fr] items-center gap-3">
                  <StatBar
                    value={max === null ? null : (left.values[metric.key] ?? null)}
                    max={max ?? 1}
                    slot={SLOTS[0]}
                    direction="rtl"
                    label={`${nameOf(left)} の${metric.label}`}
                  />
                  <span className="min-w-28" />
                  <StatBar
                    value={max === null ? null : (right.values[metric.key] ?? null)}
                    max={max ?? 1}
                    slot={SLOTS[1]}
                    label={`${nameOf(right)} の${metric.label}`}
                  />
                </div>
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
  const slotBorder = slot === 1 ? "border-slot-1" : "border-slot-2";

  return (
    // 狭い画面では左右に並ぶだけなので、右寄せは広い画面のときだけにする。
    <div className={align === "right" ? "sm:text-right" : "text-left"}>
      {/* 色は補助。ラベル（A / B）と名前を必ず出す。 */}
      <span className={`text-ink-muted border-b-2 pb-0.5 text-[11px] ${slotBorder}`}>{label}</span>
      <h2 className="mt-2 text-base leading-tight sm:text-xl">
        <Link href={routes.player(player.profile.slug)} className="hover:text-accent">
          {nameOf(player)}
        </Link>
      </h2>
      <p className="text-ink-muted mt-1 text-xs">
        {player.teamNameJa ?? player.teamAbbreviation ?? "所属不明"}
        {player.profile.position ? ` ・ ${player.profile.position}` : ""}
      </p>
    </div>
  );
}
