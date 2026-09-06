import type { Metadata } from "next";

import { PagePlaceholder } from "@/components/layout/PagePlaceholder";
import { MAX_COMPARE_PLAYERS, parseComparePlayers } from "@/config/routes";

/**
 * 選手比較ページ（中核機能）。
 *
 * 【SEO】自動生成される比較ページは noindex にする。
 * 選手の組み合わせは膨大で、そのすべてが検索結果に出ると
 * 中身の薄いページが大量に並ぶ（要件定義書 §SEO の「自動比較noindex」）。
 * 初回は canonical と、この noindex だけを入れる。
 */
export const metadata: Metadata = {
  title: "選手比較",
  description: "2〜4名の選手を、同じ条件でスタッツ比較できます。",
  robots: { index: false, follow: true },
};

export default async function ComparePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  // 5人以上を指定されてもエラーにせず、先頭4件に丸める（docs/DECISIONS.md §2）。
  const players = parseComparePlayers(params["p"]);

  return (
    <>
      <PagePlaceholder
        title="選手比較"
        description={`最大${MAX_COMPARE_PLAYERS}名まで同時に比較できます。2名のときは左右対置のレイアウト、3〜4名のときは表形式に切り替わります。`}
        plannedIn="W2-7"
      />
      {players.length > 0 && (
        <p className="text-ink-muted mx-auto max-w-3xl px-6 text-xs">
          URLで指定された選手: {players.join(" / ")}
        </p>
      )}
    </>
  );
}
