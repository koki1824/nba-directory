import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { DatabaseNotice } from "@/components/layout/DatabaseNotice";
import { CompareTray } from "@/components/players/CompareTray";
import { PlayerFilters } from "@/components/players/PlayerFilters";
import { PlayerTable } from "@/components/players/PlayerTable";
import { MissingDatabaseUrlError } from "@/db/client";
import { isPlayerSortKey, listPlayers, playerFilterOptions } from "@/db/players";

export const metadata: Metadata = {
  title: "選手一覧",
  description: "現役NBA選手を検索・絞り込み・並び替えできます。比較したい選手をここから選びます。",
};

/**
 * 選手一覧（W2-5）。
 *
 * 【毎回サーバーで作る理由】
 * 検索や絞り込みの条件がURLごとに違うので、あらかじめ作り置きできない。
 * また、作り置きにするとビルド時にDBへつなぎに行くため、
 * 接続先が未設定だとビルドそのものが失敗する。
 * 公開の手前で止まるより、画面に「未設定です」と出せるほうがよい。
 */
export const dynamic = "force-dynamic";

const PAGE_SIZE = 25;

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function firstValue(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

export default async function Page({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;

  const sortParam = firstValue(params.sort);
  const pageParam = Number(firstValue(params.page) ?? "1");
  // URLの ?page= に文字列や負の数が入っていても落とさない。
  // 共有されたURLでエラー画面を見せないため。
  const page = Number.isFinite(pageParam) && pageParam >= 1 ? Math.floor(pageParam) : 1;

  let data;
  let options;
  try {
    [data, options] = await Promise.all([
      listPlayers({
        q: firstValue(params.q),
        team: firstValue(params.team),
        position: firstValue(params.position),
        season: firstValue(params.season),
        sort: isPlayerSortKey(sortParam) ? sortParam : undefined,
        limit: PAGE_SIZE,
        offset: (page - 1) * PAGE_SIZE,
      }),
      playerFilterOptions(),
    ]);
  } catch (error) {
    if (error instanceof MissingDatabaseUrlError) {
      return (
        <div className="mx-auto max-w-6xl px-6 py-12">
          <h1 className="text-3xl">選手一覧</h1>
          <div className="mt-8">
            <DatabaseNotice />
          </div>
        </div>
      );
    }
    throw error;
  }

  const totalPages = Math.max(Math.ceil(data.total / PAGE_SIZE), 1);
  const names = Object.fromEntries(
    data.items.map((p) => [p.slug, p.fullNameJa ?? p.fullNameEn] as const),
  );

  return (
    // 下の比較トレーに隠れないよう、その高さぶん余白を空ける。
    <div className="mx-auto max-w-6xl px-6 py-12 pb-28">
      <h1 className="text-3xl">選手一覧</h1>
      <p className="text-ink-muted mt-3 text-sm">
        比較したい選手を選んで、下の「比較する」へ進みます。最大4人まで選べます。
      </p>

      {/* useSearchParams を使う部分は Suspense で包む必要がある */}
      <Suspense fallback={<div className="mt-6 h-32" />}>
        <div className="mt-6">
          <PlayerFilters
            teams={options.teams}
            positions={options.positions}
            seasons={options.seasons}
          />
        </div>
      </Suspense>

      <p className="text-ink-muted mb-3 text-xs">
        {data.total} 名{data.seasonId ? `・${data.seasonId} シーズンの成績` : ""}
      </p>

      {data.items.length === 0 ? (
        <div className="border-line bg-surface border p-8 text-center">
          <p className="text-ink text-sm">条件に合う選手が見つかりませんでした。</p>
          <p className="text-ink-muted mt-2 text-xs">
            名前の一部だけで探すか、絞り込みを外してみてください。
          </p>
        </div>
      ) : (
        <Suspense fallback={<div className="h-96" />}>
          <PlayerTable players={data.items} seasonId={data.seasonId} />
        </Suspense>
      )}

      {totalPages > 1 && (
        <nav className="mt-6 flex items-center justify-between text-sm" aria-label="ページ送り">
          <PageLink page={page - 1} disabled={page <= 1} params={params}>
            ← 前のページ
          </PageLink>
          <span className="text-ink-muted text-xs">
            {page} / {totalPages} ページ
          </span>
          <PageLink page={page + 1} disabled={page >= totalPages} params={params}>
            次のページ →
          </PageLink>
        </nav>
      )}

      <Suspense fallback={null}>
        <CompareTray names={names} />
      </Suspense>
    </div>
  );
}

/**
 * ページ送りのリンク。いまの絞り込み条件を保ったまま page だけ差し替える。
 * 条件を落とすと、2ページ目へ進んだ瞬間に絞り込みが外れる。
 */
function PageLink({
  page,
  disabled,
  params,
  children,
}: {
  page: number;
  disabled: boolean;
  params: Record<string, string | string[] | undefined>;
  children: React.ReactNode;
}) {
  if (disabled) {
    return <span className="text-ink-muted text-xs opacity-50">{children}</span>;
  }

  const next = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (key === "page" || value === undefined) continue;
    for (const v of Array.isArray(value) ? value : [value]) next.append(key, v);
  }
  next.set("page", String(page));

  return (
    <Link
      href={`/players?${next.toString()}`}
      className="text-accent hover:text-accent-hover text-xs"
    >
      {children}
    </Link>
  );
}
