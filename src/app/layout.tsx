import type { Metadata } from "next";

import { resolveSiteUrl } from "@/lib/site";
import "./globals.css";

// 環境変数が空文字や壊れた値でもビルドを止めないこと。
// 直接 new URL(process.env...) を書かない（一度それでVercelのビルドが落ちた）。
export const metadata: Metadata = {
  metadataBase: new URL(resolveSiteUrl()),
  title: "NBA選手名鑑（仮）",
  description: "現役NBA選手のシーズン別成績を、条件を揃えて比較できる日本語の選手名鑑です。",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body className="antialiased">{children}</body>
    </html>
  );
}
