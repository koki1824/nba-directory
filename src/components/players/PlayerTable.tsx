import Link from "next/link";

import { CompareToggleButton } from "@/components/players/CompareTray";
import { StatValue } from "@/components/ui/StatValue";
import { Table, Td, Th } from "@/components/ui/Table";
import type { PlayerListItem } from "@/db/players";
import { routes } from "@/config/routes";

/**
 * 選手一覧の表（W2-5）。
 *
 * 【FG% の欠損理由の出し分け】
 * 出場しているのに FG% が無い＝一本も打っていない、なので「算出不可」。
 * 出場そのものが無いなら「データなし」。
 * 同じ「—」にすると、打っていないのか記録が無いのか区別できない。
 */

type Props = {
  players: PlayerListItem[];
  seasonId: string | null;
};

export function PlayerTable({ players, seasonId }: Props) {
  return (
    <Table caption={`選手一覧（${seasonId ?? "シーズン未設定"} のレギュラーシーズン成績）`}>
      wide
      <thead>
        <tr>
          <Th>選手</Th>
          <Th>チーム</Th>
          <Th align="center">Pos</Th>
          <Th align="right">試合</Th>
          <Th align="right">得点</Th>
          <Th align="right">リバウンド</Th>
          <Th align="right">アシスト</Th>
          <Th align="right">FG%</Th>
          <Th align="center">比較</Th>
        </tr>
      </thead>
      <tbody>
        {players.map((p) => (
          <tr key={p.id}>
            <Td>
              <Link href={routes.player(p.slug)} className="text-ink hover:text-accent">
                {p.fullNameJa ?? p.fullNameEn}
              </Link>
              {/* 日本語名がある選手は英語名も併記する。
                  同姓同名がいるため、原語表記が手がかりになる。 */}
              {p.fullNameJa && <span className="text-ink-muted ml-2 text-xs">{p.fullNameEn}</span>}
            </Td>
            <Td>
              {p.teamAbbreviation ? (
                <span className="text-ink-muted text-xs">
                  {p.teamNameJa ?? p.teamNameEn}（{p.teamAbbreviation}）
                </span>
              ) : (
                <span className="text-ink-muted text-xs">—</span>
              )}
            </Td>
            <Td align="center">{p.position ?? "—"}</Td>
            <Td align="right">
              <StatValue value={p.gamesPlayed} digits={0} />
            </Td>
            <Td align="right">
              <StatValue value={p.pointsPerGame} />
            </Td>
            <Td align="right">
              <StatValue value={p.reboundsPerGame} />
            </Td>
            <Td align="right">
              <StatValue value={p.assistsPerGame} />
            </Td>
            <Td align="right">
              <StatValue
                value={p.fieldGoalPct}
                percent
                missingReason={p.gamesPlayed !== null ? "not_calculated" : "no_data"}
                missingDetail={p.gamesPlayed !== null ? "試投0本" : undefined}
              />
            </Td>
            <Td align="center">
              <CompareToggleButton slug={p.slug} name={p.fullNameJa ?? p.fullNameEn} />
            </Td>
          </tr>
        ))}
      </tbody>
    </Table>
  );
}
