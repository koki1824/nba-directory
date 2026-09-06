import type { Metadata } from "next";
import Link from "next/link";

import { DatabaseNotice } from "@/components/layout/DatabaseNotice";
import { StatValue } from "@/components/ui/StatValue";
import { Table, Td, Th } from "@/components/ui/Table";
import { routes } from "@/config/routes";
import { MissingDatabaseUrlError } from "@/db/client";
import { listTeams } from "@/db/teams";

export const metadata: Metadata = {
  title: "チーム一覧",
  description: "NBA全チームの成績と所属選手を見られます。",
};

export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function Page({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const seasonParam = Array.isArray(params.season) ? params.season[0] : params.season;

  let data;
  try {
    data = await listTeams(seasonParam);
  } catch (error) {
    if (error instanceof MissingDatabaseUrlError) {
      return (
        <div className="mx-auto max-w-5xl px-6 py-12">
          <h1 className="text-3xl">チーム一覧</h1>
          <div className="mt-8">
            <DatabaseNotice />
          </div>
        </div>
      );
    }
    throw error;
  }

  // カンファレンスごとに分ける。リーグの見方に合わせるため。
  // 未設定のチームは「その他」にまとめ、落とさない。
  const groups = new Map<string, typeof data.teams>();
  for (const team of data.teams) {
    const key = team.conference ?? "その他";
    groups.set(key, [...(groups.get(key) ?? []), team]);
  }

  return (
    <div className="mx-auto max-w-5xl px-6 py-12">
      <h1 className="text-3xl">チーム一覧</h1>
      <p className="text-ink-muted mt-3 text-sm">
        {data.seasonId
          ? `${data.seasonId} シーズンの成績で並べています。`
          : "成績はまだありません。"}
      </p>

      {data.teams.length === 0 ? (
        <p className="border-line bg-surface mt-8 border p-8 text-center text-sm">
          チームが登録されていません。
        </p>
      ) : (
        [...groups.entries()].map(([conference, teams]) => (
          <section key={conference} className="mt-10">
            <h2 className="text-xl">{conference}</h2>
            <div className="mt-3">
              <Table caption={`${conference} のチーム成績`}>
                <thead>
                  <tr>
                    <Th>チーム</Th>
                    <Th align="center">ディビジョン</Th>
                    <Th align="right">勝</Th>
                    <Th align="right">敗</Th>
                    <Th align="right">得点</Th>
                    <Th align="right">失点</Th>
                  </tr>
                </thead>
                <tbody>
                  {teams.map((team) => (
                    <tr key={team.id}>
                      <Td>
                        <Link
                          href={routes.team(team.franchiseSlug)}
                          className="text-ink hover:text-accent"
                        >
                          {team.nameJa ?? team.nameEn}
                        </Link>
                        <span className="text-ink-muted ml-2 text-xs">{team.abbreviation}</span>
                      </Td>
                      <Td align="center">
                        <span className="text-ink-muted text-xs">{team.division ?? "—"}</span>
                      </Td>
                      <Td align="right">
                        <StatValue value={team.wins} digits={0} />
                      </Td>
                      <Td align="right">
                        <StatValue value={team.losses} digits={0} />
                      </Td>
                      <Td align="right">
                        <StatValue value={team.pointsFor} digits={0} />
                      </Td>
                      <Td align="right">
                        <StatValue value={team.pointsAgainst} digits={0} />
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>
          </section>
        ))
      )}
    </div>
  );
}
