/**
 * サイト内のURLを1箇所に集約する（W1-10）。
 *
 * URLを文字列で直接書くと、変更したときに直し漏れが出る。
 * ここの関数を通せば、変更が1箇所で済み、打ち間違いも型で防げる。
 *
 * 正式ドメインは未定なので、すべてサイト内の相対パスで持つ。
 */

export const routes = {
  home: () => "/",

  players: () => "/players",
  player: (slug: string) => `/players/${encodeURIComponent(slug)}`,

  /**
   * 選手比較。比較する選手は `?p=` の繰り返しで表す。
   * 上限は4人（docs/DECISIONS.md §2）。5つ以上はエラーにせず先頭4件に丸める。
   */
  compare: (playerSlugs: readonly string[] = []) => {
    const slugs = playerSlugs.slice(0, MAX_COMPARE_PLAYERS);
    if (slugs.length === 0) return "/compare";
    const query = slugs.map((s) => `p=${encodeURIComponent(s)}`).join("&");
    return `/compare?${query}`;
  },

  teams: () => "/teams",
  team: (slug: string) => `/teams/${encodeURIComponent(slug)}`,
  teamRoster: (slug: string, seasonId: string) =>
    `/teams/${encodeURIComponent(slug)}/${encodeURIComponent(seasonId)}`,
  teamCompare: () => "/teams/compare",

  rankings: () => "/rankings",

  // 法務6ページ（W3-11 で草案、W5-6 で実装）。公開の必須条件。
  terms: () => "/terms",
  privacy: () => "/privacy",
  dataSources: () => "/data-sources",
  imageCredits: () => "/image-credits",
  disclaimer: () => "/disclaimer",
  corrections: () => "/corrections",

  contact: () => "/contact",

  // 公開後に追加する（Q7）。ナビへの追加は navigation.ts の1行で済む。
  columns: () => "/columns",

  // 開発用。検索エンジンには出さない。
  styleguide: () => "/styleguide",
} as const;

/**
 * 比較できる人数の上限（docs/DECISIONS.md §2）。
 * 表示層の定数として持つ。データ層は人数に依存しない作りにしてある。
 */
export const MAX_COMPARE_PLAYERS = 4;

/** URLクエリから比較対象の選手を取り出す。5つ以上は先頭4件に丸める（エラーにしない）。 */
export function parseComparePlayers(raw: string | string[] | undefined): string[] {
  if (raw === undefined) return [];
  const list = Array.isArray(raw) ? raw : [raw];
  return list
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    .slice(0, MAX_COMPARE_PLAYERS);
}
