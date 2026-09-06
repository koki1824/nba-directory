import { StatBar } from "@/components/ui/StatBar";
import type { PercentileRow } from "@/db/player-detail";

/**
 * リーグ内での位置（W2-6）。
 *
 * 【母集団を必ず書く】
 * 「上位20%」とだけ書くと、何と比べた話なのか分からない。
 * 規定到達者のみが母集団（Q3の決定）なので、
 * 「◯人中」と条件を必ず併記する。
 *
 * 【規定未到達をどう出すか】
 * 順位を付けない。空欄にして「規定に達していません」と理由を書く。
 * 0% と出すと「リーグ最下位」の意味になってしまう。
 */

type Props = {
  rows: PercentileRow[];
  seasonId: string;
};

export function PercentilePanel({ rows, seasonId }: Props) {
  const shown = rows.filter((r) => r.value !== null);

  if (shown.length === 0) {
    return (
      <p className="text-ink-muted border-line border-l-2 py-4 pl-4 text-sm">
        {seasonId} シーズンの成績が無いため、リーグ内での位置は出せません。
      </p>
    );
  }

  const population = shown.find((r) => r.population > 0)?.population ?? 0;

  return (
    <div>
      <p className="text-ink-muted mb-4 text-xs leading-relaxed">
        {seasonId} シーズンのレギュラーシーズン。
        {population > 0 ? (
          <>
            母集団は<strong className="text-ink">規定到達者 {population} 人</strong>です。
          </>
        ) : (
          "母集団を計算できるだけの人数がありません。"
        )}
        <br />
        規定に達していない選手には順位を付けません（0% とは異なります）。
      </p>

      <ul className="space-y-3">
        {shown.map((row) => (
          <li key={row.metricCode} className="grid grid-cols-[10rem_1fr] items-center gap-3">
            <span className="text-ink text-sm">
              {row.metricNameJa}
              {!row.higherIsBetter && (
                <span className="text-ink-muted ml-1 text-[11px]">（少ないほど良い）</span>
              )}
            </span>
            {row.isQualified && row.percentile !== null ? (
              <StatBar
                value={row.percentile}
                max={100}
                showScale
                label={`${row.metricNameJa}のリーグ内パーセンタイル（規定到達者 ${row.population} 人中）`}
              />
            ) : (
              <span className="text-ink-muted text-xs">
                規定に達していません（順位は付きません）
              </span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
