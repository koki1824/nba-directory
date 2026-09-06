import Link from "next/link";
import { Suspense } from "react";

import { SeasonLeaders } from "@/components/home/SeasonLeaders";
import { SiteSearch } from "@/components/layout/SiteSearch";
import { routes } from "@/config/routes";
import { getRanking, getRankingMeta, rankingSeasons } from "@/db/rankings";
import { listTeams } from "@/db/teams";

/**
 * トップページ（W2-4）。モック 01_top.jpg に対応する。
 *
 * 【モックとの違いと理由】
 * ・選手の写真は入れていない。画像の取り扱い（W5-1〜）は公開後に回しており、
 *   使ってよいライセンスの画像がまだ無い。それらしい画像を置くことはできない
 * ・「コラム」は出さない（Q7の決定）。定義だけ残して非表示にしてある
 * ・比較の上限は4人。モックには5人とあるが、DECISIONS §2 の決定が優先する
 *
 * 【DBが無くても開ける】
 * ランキングやチームの欄はデータが要るが、取れなければその欄を出さない。
 * トップページが真っ白になるより、入口だけでも見えるほうがよい。
 */
export const dynamic = "force-dynamic";

const ENTRY_POINTS = [
  {
    title: "選手名鑑から探す",
    description: "プロフィール・スタッツ・キャリアデータを収録。選手のすべてを深く知る。",
    href: routes.players(),
    linkLabel: "選手一覧ページへ",
  },
  {
    title: "比較をはじめる",
    description: "最大4人の選手を自由に比較。スタッツの違いや強みが一目でわかる。",
    href: routes.compare(),
    linkLabel: "比較ページへ",
  },
];

/** 注目ワード。よく見られる切り口への近道。 */
const HIGHLIGHTS = [
  { label: "スコアリーダー", href: `${routes.rankings()}?metric=pts_per_game` },
  { label: "アシストリーダー", href: `${routes.rankings()}?metric=ast_per_game` },
  { label: "リバウンドリーダー", href: `${routes.rankings()}?metric=reb_per_game` },
  { label: "ブロックリーダー", href: `${routes.rankings()}?metric=blk_per_game` },
];

async function loadHomeData() {
  const empty = {
    teams: [] as Awaited<ReturnType<typeof listTeams>>["teams"],
    seasonId: null as string | null,
    seasons: [] as string[],
    leaders: [] as Awaited<ReturnType<typeof getRanking>>,
    leaderMeta: null as Awaited<ReturnType<typeof getRankingMeta>>,
  };

  try {
    // 「今季」は成績が入っている最新シーズン。
    // 定数で持つと毎年直すことになるので、データから決める。
    const { teams, seasonId } = await listTeams();
    if (!seasonId) return { ...empty, teams };

    const [leaderMeta, leaders, seasons] = await Promise.all([
      getRankingMeta("pts_per_game", seasonId, "regular"),
      getRanking("pts_per_game", seasonId, "regular", 5),
      rankingSeasons(),
    ]);

    return { teams, seasonId, seasons, leaders, leaderMeta };
  } catch {
    // DBが無い・つながらないときは入口だけ出す。
    // トップページが真っ白になるより、入口が見えるほうがよい。
    return empty;
  }
}

export default async function Home() {
  const { teams, seasonId, seasons, leaders, leaderMeta } = await loadHomeData();

  return (
    <div className="mx-auto max-w-6xl px-6 py-12">
      <section className="max-w-2xl">
        <h1 className="text-4xl leading-tight sm:text-5xl">
          選手を探す・<span className="text-accent">比べる</span>
        </h1>
        <p className="text-ink-muted mt-4 text-sm leading-relaxed">
          最新のスタッツ、詳細なデータ、タイポグラフィでNBAのすべてを。
          <br />
          選手の今を深く知り、比べてわかる。
        </p>

        <div className="mt-6 max-w-md">
          <Suspense fallback={<div className="h-12" />}>
            <SiteSearch size="lg" label="選手・チームを名前で探す" />
          </Suspense>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span className="text-ink-muted text-xs">注目ワード</span>
          {HIGHLIGHTS.map((item) => (
            <Link
              key={item.label}
              href={item.href}
              className="border-line-strong text-ink hover:border-accent hover:text-accent rounded-sm border px-2.5 py-1 text-xs transition-colors"
            >
              {item.label}
            </Link>
          ))}
        </div>
      </section>

      <div className="mt-12 grid gap-6 lg:grid-cols-[1fr_22rem]">
        {/* カード全体を1つのリンクにしている。
            リンクが文字だけだと、指で押せる範囲が狭く、押し外しやすい。 */}
        <section className="grid gap-4 sm:grid-cols-2">
          {ENTRY_POINTS.map((entry) => (
            <Link
              key={entry.href}
              href={entry.href}
              aria-label={entry.linkLabel}
              className="card-lift border-line bg-surface group block border p-6"
            >
              <h2 className="text-xl">{entry.title}</h2>
              <p className="text-ink-muted mt-2 text-sm leading-relaxed">{entry.description}</p>
              {/* 矢印だけを少し右へ動かす。押せることを動きで伝えるため。
                  色の変化も併せて付ける。動きが見えない環境（視差効果を減らす設定）
                  でも分かるようにするため、動きだけに頼らない。 */}
              <span className="text-accent group-hover:text-accent-hover mt-4 inline-flex items-center gap-1 text-sm">
                {entry.linkLabel}
                <span
                  aria-hidden="true"
                  className="transition-transform duration-150 group-hover:translate-x-1"
                >
                  →
                </span>
              </span>
            </Link>
          ))}
        </section>

        {seasonId && leaderMeta && leaders.length > 0 && (
          <SeasonLeaders
            seasonId={seasonId}
            metricNameJa={leaderMeta.metricNameJa}
            metricCode={leaderMeta.metricCode}
            rows={leaders}
          />
        )}
      </div>

      {teams.length > 0 && (
        <section className="mt-12">
          <div className="flex items-baseline justify-between gap-4">
            <h2 className="border-accent border-l-2 pl-3 text-xl">チームから探す</h2>
            <Link href={routes.teams()} className="text-accent hover:text-accent-hover text-xs">
              チーム一覧へ →
            </Link>
          </div>
          <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {teams.map((team) => (
              <li key={team.id}>
                <Link
                  href={routes.team(team.franchiseSlug)}
                  className="card-lift border-line bg-surface block border p-3"
                >
                  <span className="text-ink block text-sm">{team.nameJa ?? team.nameEn}</span>
                  <span className="text-ink-muted mt-0.5 block text-xs">
                    {team.abbreviation}
                    {team.wins !== null && ` ・ ${team.wins}勝${team.losses}敗`}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {seasons.length > 0 && (
        <section className="mt-12">
          <div className="flex items-baseline justify-between gap-4">
            <h2 className="border-accent border-l-2 pl-3 text-xl">年代から探す</h2>
          </div>
          <p className="text-ink-muted mt-2 text-xs">その年のチーム成績と顔ぶれを見られます。</p>
          <ul className="mt-4 flex flex-wrap gap-2">
            {seasons.map((season) => (
              <li key={season}>
                <Link
                  href={`${routes.teams()}?season=${season}`}
                  className="border-line-strong text-ink hover:border-accent hover:text-accent rounded-sm border px-3 py-1.5 text-sm transition-colors"
                >
                  {season}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {teams.length === 0 && (
        <p className="border-line text-ink-muted mt-12 border-l-2 pl-4 text-xs">
          選手・チームのデータはまだ表示できていません。
          データベースの接続先が設定されると、ここに一覧が並びます。
        </p>
      )}
    </div>
  );
}
