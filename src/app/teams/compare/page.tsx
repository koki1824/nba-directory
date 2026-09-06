import type { Metadata } from "next";

import { PagePlaceholder } from "@/components/layout/PagePlaceholder";

export const metadata: Metadata = {
  title: "チーム比較",
  description: "年代とチームを選んで、チーム同士の公式成績を比較します。",
};

export default function Page() {
  return (
    <PagePlaceholder
      title="チーム比較"
      description="年代とチームを選んで、チーム同士の公式成績を比較します。"
      plannedIn="W2-9"
    />
  );
}
