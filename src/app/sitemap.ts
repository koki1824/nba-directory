import type { MetadataRoute } from "next";

import { routes } from "@/config/routes";
import { resolveSiteUrl } from "@/lib/site";

/**
 * sitemap（W1-10）。
 *
 * いまは固定ページのみ。選手・チームの個別ページは、
 * データが入る W2-1 以降で追加する（件数が増えるので動的に生成する）。
 *
 * 比較ページと見本帳は載せない。robots.ts で除外しているものと揃える。
 * 片方だけ直すと食い違うので、除外の理由は robots.ts のコメントを参照。
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const siteUrl = resolveSiteUrl();
  const lastModified = new Date();

  const paths = [
    { path: routes.home(), priority: 1.0 },
    { path: routes.players(), priority: 0.9 },
    { path: routes.teams(), priority: 0.8 },
    { path: routes.rankings(), priority: 0.8 },
    { path: routes.teamCompare(), priority: 0.6 },
    { path: routes.terms(), priority: 0.3 },
    { path: routes.privacy(), priority: 0.3 },
    { path: routes.dataSources(), priority: 0.4 },
    { path: routes.imageCredits(), priority: 0.3 },
    { path: routes.disclaimer(), priority: 0.3 },
    { path: routes.corrections(), priority: 0.3 },
    { path: routes.contact(), priority: 0.4 },
  ];

  return paths.map(({ path, priority }) => ({
    url: `${siteUrl}${path}`,
    lastModified,
    priority,
  }));
}
