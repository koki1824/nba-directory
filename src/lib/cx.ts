/**
 * クラス名の連結。falsy を落として空白で繋ぐだけ。
 *
 * clsx / classnames と同じことをする5行なので、依存を増やさず自前で持ちます
 * （オーバーライド v3「依存追加前に目的・保守状況・ライセンスを説明する」）。
 * Tailwind のクラス衝突解決（tailwind-merge 相当）はしません。必要になったら導入を検討します。
 */
export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}
