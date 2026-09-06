import type { Metadata } from "next";

import { PagePlaceholder } from "@/components/layout/PagePlaceholder";

export const metadata: Metadata = {
  title: "画像クレジット",
  description: "選手画像の権利表記と、ライセンスの一覧。",
};

export default function Page() {
  return (
    <PagePlaceholder
      title="画像クレジット"
      description="選手画像の権利表記と、ライセンスの一覧。"
      plannedIn="W5-6"
    />
  );
}
