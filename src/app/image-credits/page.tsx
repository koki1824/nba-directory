import type { Metadata } from "next";

import { Article, LegalPage, List } from "@/components/legal/LegalPage";

export const metadata: Metadata = {
  title: "画像クレジット",
  description: "画像の取り扱い方針と、表示している画像の出典です。",
};

export default function Page() {
  return (
    <LegalPage title="画像クレジット" lead="画像をどう扱うかの方針と、その出典です。">
      <Article heading="1. 現在の状況">
        <p>
          <strong>現在、選手の写真は掲載していません。</strong>
          使用してよいライセンスの画像を確認する仕組みが整うまで、
          背番号とイニシャル、チームカラーによる代替表示を使います。
        </p>
        <p className="text-ink-muted text-xs">
          それらしい画像を仮に置くことはしません。権利の確認が済んでいない画像を
          載せると、後から差し替えるまでのあいだ権利者の利益を損ないます。
        </p>
      </Article>

      <Article heading="2. 掲載するときの基準">
        <p>画像を掲載する場合は、次の条件をすべて満たすものだけを使います。</p>
        <List
          items={[
            "ライセンスが明示されており、商用利用と改変（サムネイル生成）が許されていること",
            "クレジット表示が必要な場合は、その表示を行うこと",
            "写っている人物が、掲載しようとしている選手本人であることを運営者が確認していること",
          ]}
        />
        <p>
          非商用限定（NC）・改変不可（ND）・ライセンス不明の画像は使用しません。
          判断に迷うものは掲載しない側に倒します。
        </p>
      </Article>

      <Article heading="3. 出典の一覧">
        <p>
          画像を掲載した時点で、この場所に「画像 / 撮影者 / ライセンス / 取得元」の
          一覧を出します。現在は掲載画像がないため空です。
        </p>
      </Article>

      <Article heading="4. 権利についてのご連絡">
        <p>
          掲載した画像に権利上の問題がある場合は、お問い合わせの「権利・訂正」窓口から
          ご連絡ください。<strong>確認できるまでの間、該当の画像は非表示にします。</strong>
        </p>
      </Article>
    </LegalPage>
  );
}
