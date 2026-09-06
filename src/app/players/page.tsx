import type { Metadata } from "next";

import { PagePlaceholder } from "@/components/layout/PagePlaceholder";

export const metadata: Metadata = {
  title: "選手一覧",
  description: "現役NBA選手を検索・絞り込み・並び替えできます。比較したい選手をここから選びます。",
};

export default function Page() {
  return (
    <PagePlaceholder
      title="選手一覧"
      description="現役NBA選手を検索・絞り込み・並び替えできます。比較したい選手をここから選びます。"
      plannedIn="W2-5"
    />
  );
}
