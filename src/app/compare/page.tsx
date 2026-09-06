import type { Metadata } from "next";
import Link from "next/link";

import { FacingCompare } from "@/components/compare/FacingCompare";
import { TableCompare } from "@/components/compare/TableCompare";
import { DatabaseNotice } from "@/components/layout/DatabaseNotice";
import { MAX_COMPARE_PLAYERS, parseComparePlayers, routes } from "@/config/routes";
import { MissingDatabaseUrlError } from "@/db/client";
import { COMPARE_METRICS, getCompareData, type CompareMode } from "@/db/compare";

/**
 * 選手比較（W2-7）。**このサイトの中核機能。**
 *
 * 【URLで状態を持つ】
 * 誰と誰を比べているかがURLに入っているので、そのまま人に送れる。
 * 「この2人を比べてみて」と共有できることが、この機能の価値の半分を占める。
 *
 * 【検索エンジンには載せない】
 * 選手の組み合わせは膨大で、中身の薄いページが大量に並ぶとサイト全体の
 * 評価が下がる。robots.txt と合わせて noindex にする（W1-10 の決定）。
 */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "選手を比較する",
  description: "最大4人の選手を並べて比較できます。",
  robots: { index: false, follow: true },
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function Page({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const slugs = parseComparePlayers(params.p);
  const mode: CompareMode = firstValue(params.mode) === "career" ? "career" : "season";
  const seasonParam = firstValue(params.season);

  if (slugs.length === 0) {
    return <EmptyState />;
  }

  let data;
  try {
    data = await getCompareData(slugs, { mode, seasonId: seasonParam });
  } catch (error) {
    if (error instanceof MissingDatabaseUrlError) {
      return (
        <div className="mx-auto max-w-5xl px-6 py-12">
          <h1 className="text-3xl">選手を比較する</h1>
          <div className="mt-8">
            <DatabaseNotice />
          </div>
        </div>
      );
    }
    throw error;
  }

  const { players, seasonId } = data;

  if (players.length === 0) {
    return <EmptyState notFound />;
  }

  return (
    <div className="mx-auto max-w-5xl px-6 py-12">
      <h1 className="text-3xl">選手を比較する</h1>
      <p className="text-ink-muted mt-2 text-sm">
        {mode === "career"
          ? "キャリア通算で比べています。率は各シーズンの平均ではなく、通算の実数から計算しています。"
          : `${seasonId ?? "—"} シーズン（レギュラーシーズン）で比べています。`}
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-3 text-xs">
        <ModeLink slugs={slugs} mode="season" current={mode} season={seasonParam}>
          シーズン成績
        </ModeLink>
        <ModeLink slugs={slugs} mode="career" current={mode} season={seasonParam}>
          キャリア通算
        </ModeLink>
        <Link href={routes.players()} className="text-accent hover:text-accent-hover ml-auto">
          選手を追加・変更する →
        </Link>
      </div>

      <div className="mt-10">
        {players.length === 1 ? (
          <OnlyOne name={players[0]!.profile.fullNameJa ?? players[0]!.profile.fullNameEn} />
        ) : players.length === 2 ? (
          <FacingCompare players={[players[0]!, players[1]!]} metrics={COMPARE_METRICS} />
        ) : (
          <TableCompare players={players} metrics={COMPARE_METRICS} />
        )}
      </div>

      <p className="border-line text-ink-muted mt-12 border-l-2 pl-4 text-xs leading-relaxed">
        比べられない項目は空欄にしています。0 として扱うと、
        記録が無いだけの選手が劣って見えるためです。
        <br />
        A・B の色は補助です。色だけで区別せず、名前とラベルを併記しています。
      </p>
    </div>
  );
}

function ModeLink({
  slugs,
  mode,
  current,
  season,
  children,
}: {
  slugs: string[];
  mode: CompareMode;
  current: CompareMode;
  season: string | undefined;
  children: React.ReactNode;
}) {
  const params = new URLSearchParams();
  for (const slug of slugs) params.append("p", slug);
  if (mode === "career") params.set("mode", "career");
  if (season && mode === "season") params.set("season", season);

  const isActive = mode === current;
  return (
    <Link
      href={`/compare?${params.toString()}`}
      aria-current={isActive ? "true" : undefined}
      className={
        isActive
          ? "border-accent text-accent border-b-2 pb-0.5 font-medium"
          : "text-ink-muted hover:text-ink border-b-2 border-transparent pb-0.5"
      }
    >
      {children}
    </Link>
  );
}

function OnlyOne({ name }: { name: string }) {
  return (
    <div className="border-line bg-surface border p-8 text-center">
      <p className="text-ink text-sm">
        いま選ばれているのは <strong>{name}</strong> の1人だけです。
      </p>
      <p className="text-ink-muted mt-2 text-xs">
        比較するにはもう1人選んでください（最大{MAX_COMPARE_PLAYERS}人）。
      </p>
      <Link
        href={routes.players()}
        className="text-accent hover:text-accent-hover mt-4 inline-block text-sm"
      >
        選手一覧から選ぶ →
      </Link>
    </div>
  );
}

function EmptyState({ notFound = false }: { notFound?: boolean }) {
  return (
    <div className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="text-3xl">選手を比較する</h1>
      <p className="text-ink-muted mt-3 text-sm leading-relaxed">
        {notFound
          ? "指定された選手が見つかりませんでした。名前が変わったか、URLが古い可能性があります。"
          : `比べたい選手を選んでください。最大${MAX_COMPARE_PLAYERS}人まで並べられます。`}
      </p>
      <Link
        href={routes.players()}
        className="text-accent hover:text-accent-hover mt-6 inline-block text-sm"
      >
        選手一覧から選ぶ →
      </Link>
    </div>
  );
}
