import { StatValue } from "@/components/ui/StatValue";
import { Table, Td, Th } from "@/components/ui/Table";
import type { SeasonStatRow } from "@/db/player-detail";

/**
 * シーズン別成績の表（W2-6）。
 *
 * 【移籍の内訳の見せ方】
 * シーズン合計行のすぐ下に、移籍前後の内訳をぶら下げる。
 * 並列に並べると「同じシーズンが2回出ている」ように見え、
 * 合計なのか一部なのか分からない。
 * 内訳の行は少し下げて、チーム名を先頭に置く。
 */

type Props = {
  rows: SeasonStatRow[];
  seasonType: "regular" | "playoff";
};

export function SeasonStatsTable({ rows, seasonType }: Props) {
  const filtered = rows.filter((r) => r.seasonType === seasonType);

  if (filtered.length === 0) {
    return (
      <p className="text-ink-muted border-line border-l-2 py-4 pl-4 text-sm">
        {seasonType === "playoff"
          ? "プレーオフの出場記録はありません。"
          : "レギュラーシーズンの記録はありません。"}
      </p>
    );
  }

  // シーズン合計行を軸に、その内訳をぶら下げる形へ組み替える。
  const totals = filtered.filter((r) => r.stintId === null);
  const partsBySeason = new Map<string, SeasonStatRow[]>();
  for (const row of filtered) {
    if (row.stintId === null) continue;
    const list = partsBySeason.get(row.seasonId) ?? [];
    list.push(row);
    partsBySeason.set(row.seasonId, list);
  }

  return (
    <Table
      caption={`シーズン別成績（${seasonType === "playoff" ? "プレーオフ" : "レギュラーシーズン"}）`}
      wide
    >
      <thead>
        <tr>
          <Th>シーズン</Th>
          <Th align="right">年齢</Th>
          <Th align="right">試合</Th>
          <Th align="right">先発</Th>
          <Th align="right">出場時間</Th>
          <Th align="right">得点</Th>
          <Th align="right">リバウンド</Th>
          <Th align="right">アシスト</Th>
          <Th align="right">FG%</Th>
          <Th align="right">3P%</Th>
          <Th align="right">FT%</Th>
          <Th align="right">TS%</Th>
        </tr>
      </thead>
      <tbody>
        {totals.map((row) => {
          const parts = partsBySeason.get(row.seasonId) ?? [];
          return (
            <StatRowGroup key={`${row.seasonId}-${row.seasonType}`} total={row} parts={parts} />
          );
        })}
      </tbody>
    </Table>
  );
}

function StatRowGroup({ total, parts }: { total: SeasonStatRow; parts: SeasonStatRow[] }) {
  return (
    <>
      <StatRow row={total} label={total.seasonId} />
      {parts.map((part) => (
        <StatRow
          key={part.stintId}
          row={part}
          label={part.teamNameJa ?? part.teamAbbreviation ?? "移籍前後"}
          isPart
        />
      ))}
    </>
  );
}

function StatRow({
  row,
  label,
  isPart = false,
}: {
  row: SeasonStatRow;
  label: string;
  isPart?: boolean;
}) {
  return (
    <tr className={isPart ? "bg-surface-sunken/40" : undefined}>
      <Td>
        {isPart ? (
          // 内訳だと一目で分かるように下げて小さくする。
          <span className="text-ink-muted pl-4 text-xs">└ {label}</span>
        ) : (
          <span className="font-medium">{label}</span>
        )}
      </Td>
      <Td align="right">
        {/* 開幕日が未取得のシーズンは年齢を出さない（推測で埋めない） */}
        <StatValue value={row.ageAtSeasonStart} digits={0} />
      </Td>
      <Td align="right">
        <StatValue value={row.gamesPlayed} digits={0} />
      </Td>
      <Td align="right">
        <StatValue value={row.gamesStarted} digits={0} />
      </Td>
      <Td align="right">
        <StatValue value={row.minutesPerGame} />
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
      <Td align="right">
        <StatValue
          value={row.fieldGoalPct}
          percent
          missingReason="not_calculated"
          missingDetail="試投0本"
        />
      </Td>
      <Td align="right">
        <StatValue
          value={row.threePointPct}
          percent
          missingReason="not_calculated"
          missingDetail="3P試投0本"
        />
      </Td>
      <Td align="right">
        <StatValue
          value={row.freeThrowPct}
          percent
          missingReason="not_calculated"
          missingDetail="FT試投0本"
        />
      </Td>
      <Td align="right">
        <StatValue
          value={row.trueShootingPct}
          percent
          missingReason="not_calculated"
          missingDetail="試投0本"
        />
      </Td>
    </tr>
  );
}
