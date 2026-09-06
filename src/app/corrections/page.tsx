import type { Metadata } from "next";

import { PagePlaceholder } from "@/components/layout/PagePlaceholder";

export const metadata: Metadata = {
  title: "訂正方針",
  description: "誤りを見つけたときの連絡方法と、訂正の手順。",
};

export default function Page() {
  return (
    <PagePlaceholder
      title="訂正方針"
      description="誤りを見つけたときの連絡方法と、訂正の手順。"
      plannedIn="W5-6"
    />
  );
}
