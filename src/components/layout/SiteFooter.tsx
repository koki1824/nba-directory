import Link from "next/link";

import { Logo } from "@/components/brand/Logo";
import { legalNavigation, visibleItems } from "@/config/navigation";

/**
 * 全ページ共通のフッター（W1-10）。
 *
 * 法務6ページと問い合わせへのリンクは**全ページから常時たどれる**必要がある
 * （要件定義書・公開の必須条件）。ここに置くことでそれを保証する。
 *
 * 免責の一文もここに置く。要件定義書が
 * 「本サイトはNBAおよび各チーム、選手、関連団体とは一切関係ありません」の
 * 明示を求めているため、どのページからも見える位置に出す。
 */
export function SiteFooter() {
  return (
    <footer className="border-line mt-16 border-t">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-8">
        <nav aria-label="サイト情報">
          <ul className="flex flex-wrap gap-x-6 gap-y-2">
            {visibleItems(legalNavigation).map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="text-ink-muted hover:text-ink text-xs transition-colors"
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="flex items-start gap-3">
          <Logo size={24} className="text-ink-muted mt-0.5" />
          <p className="text-ink-muted text-xs leading-relaxed">
            本サイトはNBAおよび各チーム、選手、関連団体とは一切関係のない非公式サイトです。
            データは独自に収集・集計したものです。
          </p>
        </div>
      </div>
    </footer>
  );
}
