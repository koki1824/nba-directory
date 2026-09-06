import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { DatabaseNotice } from "@/components/layout/DatabaseNotice";
import { RankingControls } from "@/components/rankings/RankingControls";
import { StatValue } from "@/components/ui/StatValue";
import { Table, Td, Th } from "@/components/ui/Table";
import { routes } from "@/config/routes";
import { MissingDatabaseUrlError } from "@/db/client";
import { getRanking, getRankingMeta, rankingMetrics, rankingSeasons } from "@/db/rankings";

export const metadata: Metadata = {
  title: "ランキング",
  description: "指標ごとのリーグ上位選手。規定到達の条件を明示しています。",
};

/**
 * ランキング（W2-10）。
 *
 * 【規定を必ず画面に書く】
 * 「◯試合以上」という条件を書かないと、なぜある選手が載っていないのかが
 * 分からない。条件と母集団の人数を必ず併記する。
 *
 * 【規定未到達も載せる】
 * 順位は付けないが、行としては出す。隠すと「この選手はどこ？」となる。
 */
export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function Page({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;

  let metrics;
  let seasons;
  try {
    [metrics, seasons] = await Promise.all([rankingMetrics(), rankingSeasons()]);
  } catch (error) {
    if (error instanceof MissingDatabaseUrlError) {
      return (
        <div className="mx-auto max-w-4xl px-6 py-12">
          <h1 className="text-3xl">ランキング</h1>
          <div className="mt-8">
            <DatabaseNotice />
          </div>
        </div>
      );
    }
    throw error;
  }

  if (metrics.length === 0 || seasons.length === 0) {
    return (
      <div className="mx-auto max-w-4xl px-6 py-12">
        <h1 className="text-3xl">ランキング</h1>
        <p className="border-line bg-surface mt-8 border p-8 text-center text-sm">
          ランキングを出せる成績がまだありません。
        </p>
      </div>
    );
  }

  // URLの値が候補に無ければ既定に落とす。共有されたURLでエラーを見せない。
  const metricParam = firstValue(params.metric);
  const metric = metrics.some((m) => m.code === metricParam)
    ? metricParam!
    : (metrics.find((m) => m.code === "pts_per_game")?.code ?? metrics[0]!.code);

  const seasonParam = firstValue(params.season);
  const season = seasons.includes(seasonParam ?? "") ? seasonParam! : seasons[0]!;

  const seasonType = firstValue(params.type) === "playoff" ? "playoff" : "regular";

  const [meta, rows] = await Promise.all([
    getRankingMeta(metric, season, seasonType),
    getRanking(metric, season, seasonType, 50),
  ]);

  return (
    <div className="mx-auto max-w-4xl px-6 py-12">
      <h1 className="text-3xl">ランキング</h1>

      <div className="mt-6">
        <Suspense fallback={<div className="h-24" />}>
          <RankingControls
            metrics={metrics}
            seasons={seasons}
            metric={metric}
            season={season}
            seasonType={seasonType}
          />
        </Suspense>
      </div>

      {meta && (
        <div className="border-line mt-6 border-l-2 pl-4">
          <p className="text-ink-muted text-xs leading-relaxed">
            {season} ・{seasonType === "playoff" ? "プレーオフ" : "レギュラーシーズン"} ・
            {meta.metricNameJa}
            {!meta.higherIsBetter && "（少ないほど良い指標です）"}
            <br />
            {seasonType === "playoff" ? (
              <>
                <strong className="text-ink">プレーオフは最低出場条件を設けていません。</strong>
                全選手を掲載し、出場試合数を併記しています。
                試合数が少ない選手の平均は大きく振れる点にご注意ください。
              </>
            ) : meta.minimumGames !== null || meta.minimumMinutes !== null ? (
              <>
                規定:{" "}
                {meta.minimumGames !== null && (
                  <strong className="text-ink">{meta.minimumGames}試合以上</strong>
                )}
                {meta.minimumGames !== null && meta.minimumMinutes !== null && " かつ "}
                {meta.minimumMinutes !== null && (
                  <strong className="text-ink">{meta.minimumMinutes}分以上</strong>
                )}
                。到達しているのは <strong className="text-ink">{meta.qualifiedCount}人</strong>
                です。
              </>
            ) : (
              <>
                <strong className="text-ink">最低出場条件はまだ設定していません。</strong>
                現在は全選手を対象にしています（設定は `W3-6`、妥当性の確認は `W3-12` で行います）。
              </>
            )}
          </p>
        </div>
      )}

      <div className="mt-6">
        {rows.length === 0 ? (
          <p className="border-line bg-surface border p-8 text-center text-sm">
            このシーズンの成績がありません。
          </p>
        ) : (
          <Table caption={`${season} ${meta?.metricNameJa ?? ""} のランキング`}>
            <thead>
              <tr>
                <Th align="right">順位</Th>
                <Th>選手</Th>
                <Th align="center">チーム</Th>
                <Th align="right">試合</Th>
                <Th align="right">{meta?.metricNameJa ?? "値"}</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.playerId} className={row.isQualified ? undefined : "opacity-70"}>
                  <Td align="right">
                    {row.rank !== null ? (
                      <span data-numeric>{row.rank}</span>
                    ) : (
                      // 順位を空にするだけだと理由が伝わらない
                      <span className="text-ink-muted text-[11px]">規定外</span>
                    )}
                  </Td>
                  <Td>
                    <Link
                      href={routes.player(row.playerSlug)}
                      className="text-ink hover:text-accent"
                    >
                      {row.fullNameJa ?? row.fullNameEn}
                    </Link>
                  </Td>
                  <Td align="center">
                    {row.franchiseSlug ? (
                      <Link
                        href={routes.team(row.franchiseSlug)}
                        className="text-ink-muted hover:text-accent text-xs"
                      >
                        {row.teamAbbreviation}
                      </Link>
                    ) : (
                      <span className="text-ink-muted text-xs">—</span>
                    )}
                  </Td>
                  <Td align="right">
                    <StatValue value={row.gamesPlayed} digits={0} />
                  </Td>
                  <Td align="right">
                    <StatValue
                      value={row.value}
                      percent={meta?.isRate ?? false}
                      digits={meta?.isRate ? 1 : (meta?.decimals ?? 1)}
                    />
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </div>

      {rows.some((r) => !r.isQualified) && (
        <p className="text-ink-muted mt-4 text-xs leading-relaxed">
          「規定外」は、最低出場条件に達していないため順位を付けていない選手です。
          <strong className="text-ink">成績が悪いという意味ではありません。</strong>
          比較の参考として値だけを載せています。
        </p>
      )}
    </div>
  );
}
