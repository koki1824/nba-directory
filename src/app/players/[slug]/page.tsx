import type { Metadata } from "next";

import { PagePlaceholder } from "@/components/layout/PagePlaceholder";

type Props = { params: Promise<{ slug: string }> };

// 選手名が入ってから正式なタイトルにする（W2-6）。
// いまはURLのslugをそのまま出し、ルーティングが通っていることを示す。
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  return { title: `選手詳細: ${slug}` };
}

export default async function PlayerPage({ params }: Props) {
  const { slug } = await params;
  return (
    <PagePlaceholder
      title="選手詳細"
      description={`概要・シーズン別成績・キャリア通算・プレーオフ・受賞歴・所属履歴・リーグ内パーセンタイルを表示します。（URL: ${slug}）`}
      plannedIn="W2-6"
    />
  );
}
