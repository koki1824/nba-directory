import Link from "next/link";

import { StatValue } from "@/components/ui/StatValue";
import { Table, Td, Th } from "@/components/ui/Table";
import { routes } from "@/config/routes";
import type { RosterRow } from "@/db/teams";

/**
 * 年代別ロスター（W2-8）。
 *
 * 【成績はシーズン全体のもの】
 * 途中移籍した選手も、そのシーズン全体の成績を出す。
 * チームごとの内訳を出すと、同じ選手の数字が所属チームごとに
 * 違って見えて混乱する。移籍のあった選手には印を付ける。
 */

export function RosterTable({ rows, seasonId }: { rows: RosterRow[]; seasonId: string }) {
  if (rows.length === 0) {
    return (
      <p className="text-ink-muted border-line border-l-2 py-4 pl-4 text-sm">
        {seasonId} シーズンの在籍記録がありません。
      </p>
    );
  }

  const hasMidSeasonMove = rows.some((r) => r.stintOrder > 1);

  return (
    <>
      <Table caption={`${seasonId} シーズンの在籍選手`}>
        wide
        <thead>
          <tr>
            <Th align="right">#</Th>
            <Th>選手</Th>
            <Th align="center">Pos</Th>
            <Th align="right">身長</Th>
            <Th align="right">年齢</Th>
            <Th align="right">試合</Th>
            <Th align="right">得点</Th>
            <Th align="right">リバウンド</Th>
            <Th align="right">アシスト</Th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.playerId}>
              <Td align="right">
                <span className="text-ink-muted text-xs">{row.jerseyNumber ?? "—"}</span>
              </Td>
              <Td>
                <Link href={routes.player(row.playerSlug)} className="text-ink hover:text-accent">
                  {row.fullNameJa ?? row.fullNameEn}
                </Link>
                {row.stintOrder > 1 && (
                  <span className="text-ink-muted ml-2 text-[11px]">※シーズン途中に加入</span>
                )}
              </Td>
              <Td align="center">{row.position ?? "—"}</Td>
              <Td align="right">{row.heightCm ? <span data-numeric>{row.heightCm}</span> : "—"}</Td>
              <Td align="right">
                <StatValue value={row.ageAtSeasonStart} digits={0} />
              </Td>
              <Td align="right">
                <StatValue value={row.gamesPlayed} digits={0} />
              </Td>
              <Td align="right">
                <StatValue value={row.pointsPerGame} />
              </Td>
              <Td align="right">
                <StatValue value={row.reboundsPerGame} />
              </Td>
              <Td align="right">
                <StatValue value={row.assistsPerGame} />
              </Td>
            </tr>
          ))}
        </tbody>
      </Table>

      {hasMidSeasonMove && (
        <p className="text-ink-muted mt-3 text-xs leading-relaxed">
          ※ の選手はシーズン途中にこのチームへ加入しました。 表の成績は
          <strong className="text-ink">そのシーズン全体</strong>のもので、
          このチームでの成績だけではありません。移籍前後の内訳は選手ページで見られます。
        </p>
      )}
    </>
  );
}
