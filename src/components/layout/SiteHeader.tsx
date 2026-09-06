import Link from "next/link";

import { LogoLockup } from "@/components/brand/Logo";
import { mainNavigation, visibleItems } from "@/config/navigation";
import { routes } from "@/config/routes";

/**
 * 全ページ共通のヘッダー（W1-10）。
 * モック 01_top.jpg / 02_compare.jpg のヘッダーに対応する。
 * 検索欄は W2-5（選手一覧）で実装する。
 */
export function SiteHeader() {
  return (
    <header className="border-line bg-canvas border-b">
      {/* 狭い画面ではロゴとメニューを2段に折り返す。
          1行に収めようとすると、サイト名を大きくした分メニューがはみ出して
          横スクロールが出る（E2Eで見張っている）。 */}
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-3 px-6 py-4">
        <Link href={routes.home()} className="text-ink shrink-0">
          <LogoLockup />
        </Link>

        <nav aria-label="主要メニュー" className="sm:ml-auto">
          <ul className="flex items-center gap-5 sm:gap-6">
            {visibleItems(mainNavigation).map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="text-ink hover:text-accent text-[15px] font-medium transition-colors"
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </header>
  );
}
