import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { DatabaseNotice } from "@/components/layout/DatabaseNotice";
import { RosterTable } from "@/components/teams/RosterTable";
import { StatValue } from "@/components/ui/StatValue";
import { routes } from "@/config/routes";
import { MissingDatabaseUrlError } from "@/db/client";
import { getTeamBySlug, getTeamRoster, rosterPointsSum, teamSeasons } from "@/db/teams";

/**
 * チームページ（W2-8）。
 *
 * 【チーム成績と選手の合計を並べて出す】
 * 「チーム成績を個人成績の合計で代用しない」はこのプロジェクトの禁止事項
 * （オーバーライド v3 §8）。守っていることを画面で確かめられるように、
 * 公式値と合計の両方を出して、一致しないことを明示する。
 */
export const dynamic = "force-dynamic";

type Params = Promise<{ slug: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params;
  try {
    const team = await getTeamBySlug(decodeURIComponent(slug));
    if (!team) return { title: "チームが見つかりません" };
    const name = team.nameJa ?? team.nameEn;
    return { title: name, description: `${name}の成績と所属選手。` };
  } catch {
    return { title: "チーム" };
  }
}

export default async function Page({ params }: { params: Params }) {
  const { slug } = await params;
  const decoded = decodeURIComponent(slug);

  // 年代別は /teams/<slug>/<シーズン> に一本化する。
  // 同じ内容に2つのURLがあると、検索エンジンにも読む人にも紛らわしい。
  let team;
  try {
    team = await getTeamBySlug(decoded);
  } catch (error) {
    if (error instanceof MissingDatabaseUrlError) {
      return (
        <div className="mx-auto max-w-5xl px-6 py-12">
          <h1 className="text-3xl">チーム</h1>
          <div className="mt-8">
            <DatabaseNotice />
          </div>
        </div>
      );
    }
    throw error;
  }

  if (!team) notFound();

  const seasonId = team.seasonId;
  const [seasons, roster, playersSum] = await Promise.all([
    teamSeasons(decoded),
    seasonId ? getTeamRoster(team.id, seasonId) : Promise.resolve([]),
    seasonId ? rosterPointsSum(team.id, seasonId) : Promise.resolve(null),
  ]);

  const name = team.nameJa ?? team.nameEn;

  return (
    <div className="mx-auto max-w-5xl px-6 py-12">
      <nav className="text-ink-muted mb-6 text-xs" aria-label="パンくず">
        <Link href={routes.teams()} className="hover:text-accent">
          チーム一覧
        </Link>
        <span className="mx-2">/</span>
        <span>{name}</span>
      </nav>

      <header className="border-line border-b pb-6">
        <h1 className="text-4xl">{name}</h1>
        <p className="text-ink-muted mt-1 text-sm">
          {team.nameEn}
          {team.conference ? ` ・ ${team.conference}` : ""}
          {team.division ? ` ${team.division}` : ""}
        </p>
      </header>

      {seasons.length > 0 && (
        <nav className="mt-6" aria-label="シーズンの切り替え">
          <ul className="flex flex-wrap gap-2">
            {seasons.map((s) => (
              <li key={s}>
                <Link
                  href={routes.teamRoster(decoded, s)}
                  aria-current={s === seasonId ? "true" : undefined}
                  className={
                    s === seasonId
                      ? "border-accent text-accent inline-block border-b-2 px-2 pb-1 text-sm font-medium"
                      : "text-ink-muted hover:text-ink inline-block border-b-2 border-transparent px-2 pb-1 text-sm"
                  }
                >
                  {s}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      )}

      <section className="mt-8">
        <h2 className="text-xl">{seasonId ?? "—"} シーズンの成績</h2>
        {team.wins === null ? (
          <p className="text-ink-muted mt-3 text-sm">
            このシーズンのチーム成績は登録されていません（チームが存在しないという意味ではありません）。
          </p>
        ) : (
          <>
            <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
              <Summary label="勝" value={team.wins} digits={0} />
              <Summary label="敗" value={team.losses} digits={0} />
              <Summary label="平均得点" value={team.pointsForPerGame} />
              <Summary label="平均失点" value={team.pointsAgainstPerGame} />
              <Summary label="FG%" value={team.fieldGoalPct} percent />
              <Summary label="3P%" value={team.threePointPct} percent />
            </div>

            <div className="border-line mt-6 border-l-2 pl-4">
              <p className="text-ink-muted text-xs leading-relaxed">
                <strong className="text-ink">チーム成績は公式の記録です。</strong>
                所属選手の成績を合計したものではありません。
                {playersSum !== null && team.pointsFor !== null && (
                  <>
                    <br />
                    このシーズンの公式チーム得点は{" "}
                    <span className="text-ink" data-numeric>
                      {team.pointsFor}
                    </span>{" "}
                    点、掲載している所属選手の得点を足すと{" "}
                    <span className="text-ink" data-numeric>
                      {playersSum}
                    </span>{" "}
                    点で、<strong className="text-ink">一致しません</strong>。
                    移籍や記録の粒度が違うため、合計は公式記録の代わりになりません。
                  </>
                )}
              </p>
            </div>
          </>
        )}
      </section>

      <section className="mt-12">
        <h2 className="text-xl">所属選手</h2>
        <div className="mt-4">
          <RosterTable rows={roster} seasonId={seasonId ?? "—"} />
        </div>
      </section>
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
