import type { Metadata } from "next";

import { PagePlaceholder } from "@/components/layout/PagePlaceholder";

export const metadata: Metadata = {
  title: "チーム一覧",
  description: "NBAの各チームと、年代別のロスターを見られます。",
};

export default function Page() {
  return (
    <PagePlaceholder
      title="チーム一覧"
      description="NBAの各チームと、年代別のロスターを見られます。"
      plannedIn="W2-8"
    />
  );
}
