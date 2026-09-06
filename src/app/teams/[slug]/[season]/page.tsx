import type { Metadata } from "next";

import { PagePlaceholder } from "@/components/layout/PagePlaceholder";

type Props = { params: Promise<{ slug: string; season: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug, season } = await params;
  return { title: `${season} シーズンのロスター: ${slug}` };
}

export default async function TeamRosterPage({ params }: Props) {
  const { slug, season } = await params;
  return (
    <PagePlaceholder
      title="年代別ロスター"
      description={`そのシーズンに在籍していた選手の一覧です。年齢はシーズン開幕日時点で表示します。（${slug} / ${season}）`}
      plannedIn="W2-8"
    />
  );
}
