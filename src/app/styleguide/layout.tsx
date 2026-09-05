import type { Metadata } from "next";

// 開発用の見本帳なので検索結果に出さない。
export const metadata: Metadata = {
  title: "デザイントークン見本帳",
  robots: { index: false, follow: false },
};

export default function StyleguideLayout({ children }: { children: React.ReactNode }) {
  return children;
}
