import type { Metadata } from "next";

import { PagePlaceholder } from "@/components/layout/PagePlaceholder";

export const metadata: Metadata = {
  title: "ご利用について",
  description: "本サイトの利用条件です。",
};

export default function Page() {
  return (
    <PagePlaceholder
      title="ご利用について"
      description="本サイトの利用条件です。"
      plannedIn="W5-6"
    />
  );
}
