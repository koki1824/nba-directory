import type { Metadata } from "next";

import { PagePlaceholder } from "@/components/layout/PagePlaceholder";

export const metadata: Metadata = {
  title: "データ出典",
  description: "本サイトが表示しているデータの出典と、最終更新日時。",
};

export default function Page() {
  return (
    <PagePlaceholder
      title="データ出典"
      description="本サイトが表示しているデータの出典と、最終更新日時。"
      plannedIn="W5-6"
    />
  );
}
