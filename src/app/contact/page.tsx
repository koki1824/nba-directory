import type { Metadata } from "next";

import { PagePlaceholder } from "@/components/layout/PagePlaceholder";

export const metadata: Metadata = {
  title: "お問い合わせ",
  description: "広告・PR・協賛／一般／不具合／権利の訂正、4つの窓口があります。",
};

export default function Page() {
  return (
    <PagePlaceholder
      title="お問い合わせ"
      description="広告・PR・協賛／一般／不具合／権利の訂正、4つの窓口があります。"
      plannedIn="W5-7"
    />
  );
}
