import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { DatabaseNotice } from "@/components/layout/DatabaseNotice";
import { RosterTable } from "@/components/teams/RosterTable";
import { StatValue } from "@/components/ui/StatValue";
import { routes } from "@/config/routes";
import { MissingDatabaseUrlError } from "@/db/client";
import { getTeamBySlug, getTeamRoster, teamSeasons } from "@/db/teams";

/**
 * 年代別ロスター（W2-8）。`/teams/<slug>/<シーズン>`
 *
 * 「そのチームのその年の顔ぶれ」を見るページ。
 * シーズンごとに固有のURLを持たせているので、
 * 「2024-25のこのチーム」をそのまま人に送れる。
 */
export const dynamic = "force-dynamic";

type Params = Promise<{ slug: string; season: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug, season } = await params;
  try {
    const team = await getTeamBySlug(decodeURIComponent(slug), decodeURIComponent(season));
    if (!team) return { title: "チームが見つかりません" };
    const name = team.nameJa ?? team.nameEn;
    return {
      title: `${name} ${decodeURIComponent(season)}`,
      description: `${name} の ${decodeURIComponent(season)} シーズンの所属選手と成績。`,
    };
  } catch {
    return { title: "ロスター" };
  }
}

export default async function Page({ params }: { params: Params }) {
  const { slug, season } = await params;
  const decodedSlug = decodeURIComponent(slug);
  const decodedSeason = decodeURIComponent(season);

  let team;
  try {
    team = await getTeamBySlug(decodedSlug, decodedSeason);
  } catch (error) {
    if (error instanceof MissingDatabaseUrlError) {
      return (
        <div className="mx-auto max-w-5xl px-6 py-12">
          <h1 className="text-3xl">ロスター</h1>
          <div className="mt-8">
            <DatabaseNotice />
          </div>
        </div>
      );
    }
    throw error;
  }

  if (!team) notFound();

  const [seasons, roster] = await Promise.all([
    teamSeasons(decodedSlug),
    getTeamRoster(team.id, decodedSeason),
  ]);

  const name = team.nameJa ?? team.nameEn;

  return (
    <div className="mx-auto max-w-5xl px-6 py-12">
      <nav className="text-ink-muted mb-6 text-xs" aria-label="パンくず">
        <Link href={routes.teams()} className="hover:text-accent">
          チーム一覧
        </Link>
        <span className="mx-2">/</span>
        <Link href={routes.team(decodedSlug)} className="hover:text-accent">
          {name}
        </Link>
        <span className="mx-2">/</span>
        <span>{decodedSeason}</span>
      </nav>

      <header className="border-line border-b pb-6">
        <h1 className="text-4xl">
          {name} <span className="text-ink-muted text-2xl">{decodedSeason}</span>
        </h1>
      </header>

      {seasons.length > 0 && (
        <nav className="mt-6" aria-label="シーズンの切り替え">
          <ul className="flex flex-wrap gap-2">
            {seasons.map((s) => (
              <li key={s}>
                <Link
                  href={routes.teamRoster(decodedSlug, s)}
                  aria-current={s === decodedSeason ? "true" : undefined}
                  className={
                    s === decodedSeason
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

      {team.wins !== null && (
        <section className="mt-8">
          <h2 className="text-xl">このシーズンの成績</h2>
          <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Summary label="勝" value={team.wins} digits={0} />
            <Summary label="敗" value={team.losses} digits={0} />
            <Summary label="平均得点" value={team.pointsForPerGame} />
            <Summary label="平均失点" value={team.pointsAgainstPerGame} />
          </div>
          <p className="text-ink-muted mt-3 text-xs">
            チーム成績は公式の記録です。所属選手の成績を合計したものではありません。
          </p>
        </section>
      )}

      <section className="mt-12">
        <h2 className="text-xl">所属選手</h2>
        <div className="mt-4">
          <RosterTable rows={roster} seasonId={decodedSeason} />
        </div>
      </section>
    </div>
  );
}

function Summary({
  label,
  value,
  digits,
}: {
  label: string;
  value: number | null;
  digits?: number;
}) {
  return (
    <div className="border-line bg-surface border p-3">
      <div className="text-ink-muted text-xs">{label}</div>
      <div className="mt-1 text-lg">
        <StatValue value={value} {...(digits !== undefined ? { digits } : {})} />
      </div>
    </div>
  );
}
