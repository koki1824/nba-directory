import type { Metadata } from "next";

import { PagePlaceholder } from "@/components/layout/PagePlaceholder";

export const metadata: Metadata = {
  title: "免責事項",
  description: "データの正確性と本サイトの位置づけについて。",
};

export default function Page() {
  return (
    <PagePlaceholder
      title="免責事項"
      description="データの正確性と本サイトの位置づけについて。"
      plannedIn="W5-6"
    />
  );
}
