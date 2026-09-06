import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { DatabaseNotice } from "@/components/layout/DatabaseNotice";
import { PercentilePanel } from "@/components/players/PercentilePanel";
import { SeasonStatsTable } from "@/components/players/SeasonStatsTable";
import { StatValue } from "@/components/ui/StatValue";
import { routes } from "@/config/routes";
import { MissingDatabaseUrlError } from "@/db/client";
import {
  getPlayerAwards,
  getPlayerBySlug,
  getPlayerCareer,
  getPlayerPercentiles,
  getPlayerSeasons,
  getPlayerTeamHistory,
} from "@/db/player-detail";

/**
 * 選手ページ（W2-6）。
 *
 * 【年齢の基準日を必ず書く】
 * このサイトはシーズン開幕日を基準にする（docs/DECISIONS.md §1）。
 * 他サイト（2月1日基準）とは1歳ずれることがあるため、
 * 選手ページに基準日を明記すると決めてある。
 */
export const dynamic = "force-dynamic";

type Params = Promise<{ slug: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params;
  try {
    const player = await getPlayerBySlug(decodeURIComponent(slug));
    if (!player) return { title: "選手が見つかりません" };

    const name = player.fullNameJa ?? player.fullNameEn;
    return {
      title: name,
      description: `${name}（${player.fullNameEn}）のプロフィール・シーズン別成績・キャリア通算・リーグ内での位置。`,
    };
  } catch {
    // DBにつながらないときもページ自体は開けるようにする
    return { title: "選手" };
  }
}

export default async function Page({ params }: { params: Params }) {
  const { slug } = await params;
  const decoded = decodeURIComponent(slug);

  let player;
  try {
    player = await getPlayerBySlug(decoded);
  } catch (error) {
    if (error instanceof MissingDatabaseUrlError) {
      return (
        <div className="mx-auto max-w-5xl px-6 py-12">
          <h1 className="text-3xl">選手</h1>
          <div className="mt-8">
            <DatabaseNotice />
          </div>
        </div>
      );
    }
    throw error;
  }

  if (!player) notFound();

  const [seasons, career, teamHistory, awards] = await Promise.all([
    getPlayerSeasons(player.id),
    getPlayerCareer(player.id),
    getPlayerTeamHistory(player.id),
    getPlayerAwards(player.id),
  ]);

  // パーセンタイルは「成績のある最新シーズン」で出す。
  const latestSeason =
    seasons.find((s) => s.seasonType === "regular" && s.stintId === null)?.seasonId ?? null;
  const percentiles = latestSeason ? await getPlayerPercentiles(player.id, latestSeason) : [];

  const name = player.fullNameJa ?? player.fullNameEn;
  const careerRegular = career.find((c) => c.seasonType === "regular");
  const careerPlayoff = career.find((c) => c.seasonType === "playoff");
  const currentTeam = teamHistory[0];

  return (
    <div className="mx-auto max-w-5xl px-6 py-12">
      <nav className="text-ink-muted mb-6 text-xs" aria-label="パンくず">
        <Link href={routes.players()} className="hover:text-accent">
          選手一覧
        </Link>
        <span className="mx-2">/</span>
        <span>{name}</span>
      </nav>

      <header className="border-line border-b pb-6">
        <h1 className="text-4xl">{name}</h1>
        {player.fullNameJa && <p className="text-ink-muted mt-1 text-sm">{player.fullNameEn}</p>}

        <dl className="mt-5 grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-4">
          <Fact label="所属">
            {currentTeam ? (
              <Link
                href={routes.team(currentTeam.teamAbbreviation ?? "")}
                className="hover:text-accent"
              >
                {currentTeam.teamNameJa ?? currentTeam.teamNameEn}
              </Link>
            ) : (
              "—"
            )}
          </Fact>
          <Fact label="ポジション">{player.position ?? "—"}</Fact>
          <Fact label="背番号">{player.jerseyNumber ?? "—"}</Fact>
          <Fact label="身長 / 体重">
            {player.heightCm ? `${player.heightCm}cm` : "—"} /{" "}
            {player.weightKg ? `${player.weightKg}kg` : "—"}
          </Fact>
          <Fact label="生年月日">{player.birthDate ?? "—"}</Fact>
          <Fact label="ドラフト">
            {player.draftYear
              ? `${player.draftYear}年 ${player.draftRound ?? "?"}巡 ${player.draftPick ?? "?"}位`
              : "—"}
          </Fact>
          <Fact label="状態">{player.isActive ? "現役" : "引退"}</Fact>
        </dl>

        {player.hasManualOverride && (
          // 手動で直した値が混ざっていることを隠さない。
          <p className="text-ink-muted mt-4 text-xs">
            ※ 一部の項目は運営者が確認して修正しています。
          </p>
        )}
      </header>

      {careerRegular && (
        <section className="mt-10">
          <h2 className="text-xl">キャリア通算</h2>
          <p className="text-ink-muted mt-1 text-xs">
            率は各シーズンの率を平均したものではなく、通算の実数から計算しています。
          </p>
          <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
            <Summary label="シーズン数" value={careerRegular.seasonsPlayed} digits={0} />
            <Summary label="出場試合" value={careerRegular.gamesPlayed} digits={0} />
            <Summary label="平均得点" value={careerRegular.pointsPerGame} />
            <Summary label="平均リバウンド" value={careerRegular.reboundsPerGame} />
            <Summary label="平均アシスト" value={careerRegular.assistsPerGame} />
            <Summary label="通算FG%" value={careerRegular.fieldGoalPct} percent />
          </div>

          {careerPlayoff ? (
            <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
              <Summary label="PO 出場試合" value={careerPlayoff.gamesPlayed} digits={0} />
              <Summary label="PO 平均得点" value={careerPlayoff.pointsPerGame} />
              <Summary label="PO 平均リバウンド" value={careerPlayoff.reboundsPerGame} />
              <Summary label="PO 平均アシスト" value={careerPlayoff.assistsPerGame} />
              <Summary label="PO 通算FG%" value={careerPlayoff.fieldGoalPct} percent />
            </div>
          ) : (
            <p className="text-ink-muted mt-4 text-xs">
              プレーオフの出場記録はありません（データ未取得ではありません）。
            </p>
          )}
        </section>
      )}

      <section className="mt-12">
        <h2 className="text-xl">シーズン別成績</h2>
        <p className="text-ink-muted mt-1 text-xs leading-relaxed">
          年齢は<strong className="text-ink">そのシーズンの開幕日</strong>を基準にしています。
          他サイトは2月1日を基準にすることが多く、1歳ずれて見える場合があります。
          開幕日が未取得のシーズンは年齢を表示しません。
        </p>
        <div className="mt-4">
          <SeasonStatsTable rows={seasons} seasonType="regular" />
        </div>
      </section>

      <section className="mt-12">
        <h2 className="text-xl">プレーオフ</h2>
        <div className="mt-4">
          <SeasonStatsTable rows={seasons} seasonType="playoff" />
        </div>
      </section>

      {latestSeason && (
        <section className="mt-12">
          <h2 className="text-xl">リーグ内での位置</h2>
          <div className="mt-4">
            <PercentilePanel rows={percentiles} seasonId={latestSeason} />
          </div>
        </section>
      )}

      <section className="mt-12">
        <h2 className="text-xl">所属履歴</h2>
        <ul className="border-line mt-4 divide-y border-t border-b">
          {teamHistory.map((h) => (
            <li
              key={`${h.seasonId}-${h.stintOrder}`}
              className="flex items-center justify-between py-2.5 text-sm"
            >
              <span className="text-ink-muted">{h.seasonId}</span>
              <span>
                {h.teamNameJa ?? h.teamNameEn}
                {h.startedOn && h.endedOn && (
                  <span className="text-ink-muted ml-2 text-xs">
                    {h.startedOn} 〜 {h.endedOn}
                  </span>
                )}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-12">
        <h2 className="text-xl">受賞歴</h2>
        {awards.length === 0 ? (
          <p className="text-ink-muted mt-3 text-sm">登録されている受賞歴はありません。</p>
        ) : (
          <ul className="mt-3 space-y-1 text-sm">
            {awards.map((a) => (
              <li key={`${a.seasonId}-${a.code}`}>
                <span className="text-ink-muted mr-3">{a.seasonId}</span>
                {a.nameJa}
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="border-line mt-12 border-t pt-6">
        <Link
          href={routes.compare([player.slug])}
          className="text-accent hover:text-accent-hover text-sm"
        >
          この選手を比較に追加 →
        </Link>
      </div>
    </div>
  );
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-ink-muted text-xs">{label}</dt>
      <dd className="mt-0.5">{children}</dd>
    </div>
  );
}

function Summary({
  label,
  value,
  digits,
  percent,
}: {
  label: string;
  value: number | null;
  digits?: number;
  percent?: boolean;
}) {
  return (
    <div className="border-line bg-surface border p-3">
      <div className="text-ink-muted text-xs">{label}</div>
      <div className="mt-1 text-lg">
        <StatValue
          value={value}
          {...(digits !== undefined ? { digits } : {})}
          {...(percent ? { percent: true } : {})}
        />
      </div>
    </div>
  );
}
