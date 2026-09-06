import type { Metadata } from "next";

import { Article, Fact, LegalPage, List } from "@/components/legal/LegalPage";

export const metadata: Metadata = {
  title: "プライバシーポリシー",
  description: "本サイトが取得する情報と、その扱いについて説明します。",
};

export default function Page() {
  return (
    <LegalPage
      title="プライバシーポリシー"
      lead="本サイトが何を受け取り、何を受け取らないかを説明します。"
    >
      <Article heading="1. 取得しない情報">
        <p>
          本サイトは<strong>会員登録の仕組みを持っていません。</strong>
          氏名・メールアドレス・パスワードなどを入力していただく場面はありません
          （お問い合わせのときを除きます）。
        </p>
      </Article>

      <Article heading="2. 取得する情報">
        <List
          items={[
            "アクセスの記録（閲覧されたページ、日時、ブラウザの種類など）。サーバーが自動的に記録します",
            "お問い合わせの内容と、返信のためにご記入いただいた連絡先",
          ]}
        />
        <p>
          アクセスの記録は、不具合の調査とサイトの改善のためだけに使います。
          個人を特定する目的では利用しません。
        </p>
      </Article>

      <Article heading="3. お問い合わせでいただいた情報">
        <p>
          お問い合わせはメールで受け取ります。
          <strong>本サイトのデータベースには保存しません。</strong>
          いただいた内容と連絡先は、返信と、必要な場合の記録の訂正にのみ使います。
        </p>
      </Article>

      <Article heading="4. 第三者への提供">
        <p>法令に基づく場合を除き、いただいた情報を第三者へ渡すことはありません。</p>
      </Article>

      <Article heading="5. 外部サービスの利用">
        <p>本サイトは次の外部サービスを利用しています。</p>
        <List
          items={[
            "Vercel（サイトの配信）— アクセスの記録が保存されます",
            "Supabase（データの保管）— 選手・チームのデータを保管しています",
          ]}
        />
        <p>いずれも本サイトの表示に必要なもので、閲覧者の個人情報を渡すために使ってはいません。</p>
        <p className="text-ink-muted text-xs">
          ※ アクセス解析や広告の仕組みを導入する場合は、
          導入前にこのページへ追記し、何が記録されるかを明示します。
        </p>
      </Article>

      <Article heading="6. お問い合わせ先">
        <p>
          本ページの内容についてのご連絡は <Fact factKey="contactEmail" /> までお願いします。
        </p>
      </Article>
    </LegalPage>
  );
}
