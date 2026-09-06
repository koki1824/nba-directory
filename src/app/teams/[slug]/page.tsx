import type { Metadata } from "next";

import { PagePlaceholder } from "@/components/layout/PagePlaceholder";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  return { title: `チーム詳細: ${slug}` };
}

export default async function TeamPage({ params }: Props) {
  const { slug } = await params;
  return (
    <PagePlaceholder
      title="チーム詳細"
      description={`チームの公式成績と、シーズンごとのロスターを表示します。チーム成績は公式値であり、個人成績の合計ではありません。（URL: ${slug}）`}
      plannedIn="W2-8"
    />
  );
}
