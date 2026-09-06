import type { Metadata } from "next";

import { PagePlaceholder } from "@/components/layout/PagePlaceholder";

export const metadata: Metadata = {
  title: "ランキング",
  description: "シーズンごとの指標別ランキング。規定到達の条件を画面に明示します。",
};

export default function Page() {
  return (
    <PagePlaceholder
      title="ランキング"
      description="シーズンごとの指標別ランキング。規定到達の条件を画面に明示します。"
      plannedIn="W2-10"
    />
  );
}
