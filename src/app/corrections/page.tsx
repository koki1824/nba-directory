import type { Metadata } from "next";

import { Article, LegalPage, List } from "@/components/legal/LegalPage";

export const metadata: Metadata = {
  title: "訂正の方針",
  description: "誤りが見つかったときに、どう直してどう記録するかの方針です。",
};

export default function Page() {
  return (
    <LegalPage
      title="訂正の方針"
      lead="誤りが見つかったときに、どう直し、何を残すかを決めています。"
    >
      <Article heading="1. 誤りを見つけたら">
        <p>
          <a href="/contact" className="text-accent hover:text-accent-hover">
            お問い合わせ
          </a>{" "}
          の「権利・訂正」窓口からご連絡ください。次の情報があると調査が早く進みます。
        </p>
        <List
          items={[
            "該当ページのURL",
            "どの数値・記述が誤っているか",
            "正しい内容と、その根拠（公式サイトのURLなど）",
          ]}
        />
      </Article>

      <Article heading="2. 対応の流れ">
        <List
          items={[
            "ご連絡を受けて内容を確認します",
            "誤りが確認できた場合は修正します",
            "権利に関わる指摘の場合は、確認が済むまで該当の表示を止めます",
            "確認できなかった場合も、その旨をご返信します",
          ]}
        />
      </Article>

      <Article heading="3. 修正したときに残すもの">
        <p>
          修正は<strong>取得元のデータを書き換えず、別の記録として重ねます。</strong>
          そのため、データを取り直しても修正が消えません。
        </p>
        <p>修正が入っている項目には、その旨をページ上に表示します。</p>
      </Article>

      <Article heading="4. 対応しかねる場合">
        <p>
          取得元のデータ自体が誤っている場合、本サイトで値を修正することはできますが、
          取得元の修正まではお約束できません。その場合はその旨をご返信します。
        </p>
      </Article>
    </LegalPage>
  );
}
