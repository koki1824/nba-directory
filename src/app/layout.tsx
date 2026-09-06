import type { Metadata } from "next";

import { SiteFooter } from "@/components/layout/SiteFooter";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { SITE_DISPLAY_NAME } from "@/components/brand/Logo";
import { resolveSiteUrl } from "@/lib/site";
import "./globals.css";

// 環境変数が空文字や壊れた値でもビルドを止めないこと。
// 直接 new URL(process.env...) を書かない（一度それでVercelのビルドが落ちた）。
export const metadata: Metadata = {
  metadataBase: new URL(resolveSiteUrl()),
  title: {
    default: `${SITE_DISPLAY_NAME}（仮）`,
    // 各ページの title に付く共通の接尾辞。1箇所で決める。
    template: `%s | ${SITE_DISPLAY_NAME}（仮）`,
  },
  description: "現役NBA選手のシーズン別成績を、条件を揃えて比較できる日本語の選手名鑑です。",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body className="flex min-h-screen flex-col antialiased">
        <SiteHeader />
        {/* main を伸ばして、内容が短くてもフッターが画面下に来るようにする。 */}
        <main className="flex-1">{children}</main>
        <SiteFooter />
      </body>
    </html>
  );
}
