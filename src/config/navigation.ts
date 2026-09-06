import { routes } from "./routes";

/**
 * ヘッダーとフッターの項目を1箇所にまとめる（W1-10）。
 *
 * Q7 の決定により、「コラム」は 10/4 では表示しない。
 * ただし公開後に出せるよう、定義はここに置き `visible` を false にしてある。
 * **公開したくなったら1行 `visible: true` にするだけで出る。**
 * 画面のあちこちにナビを書くと、この切り替えができなくなる。
 */

export type NavItem = {
  label: string;
  href: string;
  /** 10/4 の公開で表示するか */
  visible: boolean;
  /** 表示しない理由。あとから見て「決め忘れ」と区別するために書く */
  note?: string;
};

export const mainNavigation: readonly NavItem[] = [
  { label: "選手", href: routes.players(), visible: true },
  { label: "チーム", href: routes.teams(), visible: true },
  { label: "比較", href: routes.compare(), visible: true },
  { label: "ランキング", href: routes.rankings(), visible: true },
  {
    label: "コラム",
    href: routes.columns(),
    visible: false,
    note: "Q7の決定により10/4は非表示。WordPress統合が済んだら true にする。",
  },
];

/** フッターの法務リンク。公開の必須条件なので、全ページから常時たどれるようにする。 */
export const legalNavigation: readonly NavItem[] = [
  { label: "ご利用について", href: routes.terms(), visible: true },
  { label: "プライバシーポリシー", href: routes.privacy(), visible: true },
  { label: "データ出典", href: routes.dataSources(), visible: true },
  { label: "画像クレジット", href: routes.imageCredits(), visible: true },
  { label: "免責事項", href: routes.disclaimer(), visible: true },
  { label: "訂正方針", href: routes.corrections(), visible: true },
  { label: "お問い合わせ", href: routes.contact(), visible: true },
];

export function visibleItems(items: readonly NavItem[]): NavItem[] {
  return items.filter((item) => item.visible);
}
