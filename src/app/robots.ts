import type { MetadataRoute } from "next";

import { routes } from "@/config/routes";
import { resolveSiteUrl } from "@/lib/site";

/**
 * 検索エンジン向けの指示（W1-10）。
 *
 * 初回は最小限にする（要件定義書 §SEO「初回はcanonical + 自動比較noindexのみ」）。
 * 作り込みは公開後。
 */
export default function robots(): MetadataRoute.Robots {
  const siteUrl = resolveSiteUrl();

  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        // 比較は選手の組み合わせが膨大で、中身の薄いページが大量に並ぶ。
        routes.compare(),
        // 管理画面（W3-1）。認証も掛けるが、robotsでも塞いでおく。
        "/admin",
        // 開発用の見本帳。
        routes.styleguide(),
      ],
    },
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
