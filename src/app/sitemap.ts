import type { MetadataRoute } from "next";

import { routes } from "@/config/routes";
import { listPlayers } from "@/db/players";
import { listTeams, teamSeasons } from "@/db/teams";
import { resolveSiteUrl } from "@/lib/site";

/**
 * sitemap（W1-10 → W2-8 で選手・チームを追加）。
 *
 * 比較ページと見本帳は載せない。robots.ts で除外しているものと揃える。
 * 片方だけ直すと食い違うので、除外の理由は robots.ts のコメントを参照。
 *
 * 【DBにつながらないときは固定ページだけ返す】
 * ここで例外を投げると sitemap.xml が 500 になる。
 * 検索エンジンから見て「サイトが壊れている」状態を作らないため、
 * 取れた範囲で返す。
 */
export const dynamic = "force-dynamic";

// 中身のあるページだけを載せる。作りかけのページを載せると、
// 検索から来た人が空のページに当たる。
const STATIC_PATHS = [
  { path: routes.home(), priority: 1.0 },
  { path: routes.players(), priority: 0.9 },
  { path: routes.teams(), priority: 0.8 },
  { path: routes.rankings(), priority: 0.8 },
  { path: routes.terms(), priority: 0.3 },
  { path: routes.privacy(), priority: 0.3 },
  { path: routes.dataSources(), priority: 0.4 },
  { path: routes.imageCredits(), priority: 0.3 },
  { path: routes.disclaimer(), priority: 0.3 },
  { path: routes.corrections(), priority: 0.3 },
  { path: routes.contact(), priority: 0.4 },
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const siteUrl = resolveSiteUrl();
  const lastModified = new Date();

  const entries: MetadataRoute.Sitemap = STATIC_PATHS.map(({ path, priority }) => ({
    url: `${siteUrl}${path}`,
    lastModified,
    priority,
  }));

  try {
    // 選手ページ。件数が増えても sitemap の上限（5万件）には遠い。
    const players = await listPlayers({ limit: 200 });
    for (const player of players.items) {
      entries.push({
        url: `${siteUrl}${routes.player(player.slug)}`,
        lastModified,
        priority: 0.7,
      });
    }

    // チームページと年代別ロスター。
    const { teams } = await listTeams();
    for (const team of teams) {
      entries.push({
        url: `${siteUrl}${routes.team(team.franchiseSlug)}`,
        lastModified,
        priority: 0.6,
      });

      for (const season of await teamSeasons(team.franchiseSlug)) {
        entries.push({
          url: `${siteUrl}${routes.teamRoster(team.franchiseSlug, season)}`,
          lastModified,
          priority: 0.5,
        });
      }
    }
  } catch {
    // DBが無い・つながらない場合は固定ページだけで返す。
    // sitemap.xml を 500 にするより、載る分だけ載せるほうが害が小さい。
  }

  return entries;
}
