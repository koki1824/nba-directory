import Link from "next/link";

import { MissingValue } from "@/components/ui/MissingValue";
import { StatValue } from "@/components/ui/StatValue";
import { Table, Td, Th } from "@/components/ui/Table";
import { routes } from "@/config/routes";
import { bestIndex, type ComparePlayer, type CompareMetric } from "@/db/compare";

/**
 * 3〜4人の比較（W2-7）。
 *
 * 向かい合わせは2人だけの形なので、3人以上は表にする
 * （docs/DECISIONS.md §2: 2人レイアウトを先に、3〜4人は表で）。
 *
 * 【優れている値の示し方】
 * 太字にする。色だけで示すと、色覚特性やモノクロ印刷で分からない。
 * 比べられない指標では誰も強調しない。
 */

type Props = {
  players: ComparePlayer[];
  metrics: CompareMetric[];
};

const SLOT_BORDER = ["border-slot-1", "border-slot-2", "border-slot-3", "border-slot-4"];
const LABELS = ["A", "B", "C", "D"];

export function TableCompare({ players, metrics }: Props) {
  return (
    <Table caption="選手比較">
      <thead>
        <tr>
          <Th>指標</Th>
          {players.map((player, i) => (
            <Th key={player.profile.id} align="right">
              <span
                className={`text-ink-muted mb-1 block border-b-2 pb-0.5 text-[11px] ${SLOT_BORDER[i]}`}
              >
                {LABELS[i]}
              </span>
              <Link
                href={routes.player(player.profile.slug)}
                className="text-ink hover:text-accent block leading-tight"
              >
                {player.profile.fullNameJa ?? player.profile.fullNameEn}
              </Link>
              <span className="text-ink-muted block text-[11px] font-normal">
                {player.teamAbbreviation ?? "—"}
              </span>
            </Th>
          ))}
        </tr>
      </thead>
      <tbody>
        {metrics.map((metric) => {
          const winner = bestIndex(metric, players);
          return (
            <tr key={metric.key}>
              <Td>
                {metric.label}
                {!metric.higherIsBetter && (
                  <span className="text-ink-muted ml-1 text-[10px]">（少ないほど良い）</span>
                )}
              </Td>
              {players.map((player, i) => (
                <Td key={player.profile.id} align="right">
                  <span className={winner === i ? "text-ink font-medium" : undefined}>
                    {player.hasSeasonRecord ? (
                      <StatValue
                        value={player.values[metric.key] ?? null}
                        percent={metric.percent}
                        missingReason="not_calculated"
                        missingDetail="算出条件を満たしません"
                      />
                    ) : (
                      <MissingValue
                        reason="not_applicable"
                        detail="このシーズンの出場記録がありません"
                      />
                    )}
                  </span>
                </Td>
              ))}
            </tr>
          );
        })}
      </tbody>
    </Table>
  );
}
