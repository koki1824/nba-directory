import type { ReactNode } from "react";

import { factValue, missingRequiredFacts } from "@/config/legal";

/**
 * 法務ページの共通の枠（W5-6）。
 *
 * 【草案であることを隠さない】
 * 法務ページは公開の必須条件だが、中身はAIが書いた草案で、
 * 運営者の確認と、必要なら専門家の確認を受けていない。
 * 確認が済むまでは画面にそう書く。書かずに出すと、
 * 「確認済みの規約」として読まれてしまう。
 *
 * 確認が済んだら `reviewed` を true にする。バナーが消える。
 */

type Props = {
  title: string;
  /** 何のページかを1〜2文で */
  lead: string;
  /** 運営者の確認が済んでいるか。済むまでは草案バナーを出す */
  reviewed?: boolean;
  children: ReactNode;
};

export function LegalPage({ title, lead, reviewed = false, children }: Props) {
  const effective = factValue("effectiveDate");
  const missing = missingRequiredFacts();

  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <h1 className="text-3xl">{title}</h1>
      <p className="text-ink-muted mt-3 text-sm leading-relaxed">{lead}</p>

      {!reviewed && (
        <div className="border-accent bg-surface mt-6 border-l-2 p-4">
          <p className="text-ink text-sm">この文章は草案です。</p>
          <p className="text-ink-muted mt-2 text-xs leading-relaxed">
            運営者の確認がまだ済んでいません。内容は公開までに変わることがあります。
            {missing.length > 0 && (
              <>
                <br />
                未記入の項目が {missing.length} 件あります（
                {missing.map((f) => f.label).join(" / ")}）。
              </>
            )}
          </p>
        </div>
      )}

      <div className="legal-body mt-8">{children}</div>

      <p className="border-line text-ink-muted mt-12 border-t pt-6 text-xs">
        施行日: {effective.text}
      </p>
    </div>
  );
}

/** 条見出しと本文。ページ間で見た目を揃えるために用意する。 */
export function Article({ heading, children }: { heading: string; children: ReactNode }) {
  return (
    <section className="mt-8 first:mt-0">
      <h2 className="text-lg">{heading}</h2>
      <div className="text-ink mt-3 space-y-3 text-sm leading-relaxed">{children}</div>
    </section>
  );
}

/** 箇条書き。 */
export function List({ items }: { items: ReactNode[] }) {
  return (
    <ul className="list-disc space-y-1.5 pl-5">
      {items.map((item, i) => (
        <li key={i}>{item}</li>
      ))}
    </ul>
  );
}

/** 運営者が埋める値。未記入なら目立つ形で出す。 */
export function Fact({ factKey }: { factKey: string }) {
  const fact = factValue(factKey);
  if (fact.filled) return <span>{fact.text}</span>;

  return (
    <span
      className="text-accent border-accent border-b border-dotted"
      title={`${fact.label}が未記入です`}
    >
      {fact.text}
    </span>
  );
}
