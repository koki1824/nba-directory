import Link from "next/link";

import { routes } from "@/config/routes";

/**
 * トップページ（W1-10 の骨格）。
 * 本実装は W2-4。ここでは主要な導線が通っていることだけを示す。
 */

const ENTRY_POINTS = [
  {
    title: "選手名鑑から探す",
    description: "プロフィール・スタッツ・キャリアデータを収録。選手のすべてを深く知る。",
    href: routes.players(),
    linkLabel: "選手一覧ページへ",
  },
  {
    title: "比較をはじめる",
    description: "最大4人の選手を自由に比較。スタッツの違いや強みが一目でわかる。",
    href: routes.compare(),
    linkLabel: "比較ページへ",
  },
];

export default function Home() {
  return (
    <div className="mx-auto max-w-6xl px-6 py-12">
      <section className="max-w-2xl">
        <h1 className="text-4xl leading-tight">
          選手を探す・<span className="text-accent">比べる</span>
        </h1>
        <p className="text-ink-muted mt-4 text-sm leading-relaxed">
          最新のスタッツ、詳細なデータ、タイポグラフィでNBAのすべてを。
          <br />
          選手の今を深く知り、比べてわかる。
        </p>
      </section>

      {/* カード全体を1つのリンクにしている。
          リンクが文字だけだと、指で押せる範囲が狭く、押し外しやすい。
          カードごと押せるようにすると、狙わなくても届く。 */}
      <section className="mt-12 grid gap-4 sm:grid-cols-2">
        {ENTRY_POINTS.map((entry) => (
          <Link
            key={entry.href}
            href={entry.href}
            aria-label={entry.linkLabel}
            className="card-lift border-line bg-surface group block border p-6"
          >
            <h2 className="text-xl">{entry.title}</h2>
            <p className="text-ink-muted mt-2 text-sm leading-relaxed">{entry.description}</p>
            {/* 矢印だけを少し右へ動かす。押せることを動きで伝えるため。
                色の変化も併せて付ける。動きが見えない環境（視差効果を減らす設定）
                でも分かるようにするため、動きだけに頼らない。 */}
            <span className="text-accent group-hover:text-accent-hover mt-4 inline-flex items-center gap-1 text-sm">
              {entry.linkLabel}
              <span
                aria-hidden="true"
                className="transition-transform duration-150 group-hover:translate-x-1"
              >
                →
              </span>
            </span>
          </Link>
        ))}
      </section>

      <p className="border-line text-ink-muted mt-12 border-l-2 pl-4 text-xs">
        トップページの本実装は <span className="text-ink font-medium">W2-4</span> で行います。
        いまはURLの骨格と共通レイアウトが通っている状態です。
      </p>
    </div>
  );
}
