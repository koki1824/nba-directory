import type { Metadata } from "next";

import { PagePlaceholder } from "@/components/layout/PagePlaceholder";

export const metadata: Metadata = {
  title: "プライバシーポリシー",
  description: "個人情報の取り扱いについて。",
};

export default function Page() {
  return (
    <PagePlaceholder
      title="プライバシーポリシー"
      description="個人情報の取り扱いについて。"
      plannedIn="W5-6"
    />
  );
}
