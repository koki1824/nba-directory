import type { Metadata } from "next";

import { Article, Fact, LegalPage, List } from "@/components/legal/LegalPage";
import { UNOFFICIAL_NOTICE } from "@/config/legal";

export const metadata: Metadata = {
  title: "ご利用について",
  description:
    "本サイトの利用条件です。非公式サイトであること、データの扱い、免責の範囲を定めています。",
};

export default function Page() {
  return (
    <LegalPage
      title="ご利用について"
      lead="このページは、本サイトを使うときの取り決めです。ご利用の前にお読みください。"
    >
      <Article heading="1. このサイトについて">
        <p>{UNOFFICIAL_NOTICE}</p>
        <p>
          本サイトは <Fact factKey="operatorName" /> が個人として運営しています。
        </p>
      </Article>

      <Article heading="2. 掲載している情報">
        <p>
          選手・チームの成績は、出典を明記したうえで掲載しています（
          <a href="/data-sources" className="text-accent hover:text-accent-hover">
            データ出典
          </a>
          をご覧ください）。
        </p>
        <p>
          <strong>数値の正確性を保証するものではありません。</strong>
          取得元の更新の遅れ、集計方法の違い、こちらの不具合により、
          公式記録と異なる値が表示されることがあります。
          正確な記録が必要な場合は、必ず公式の発表をご確認ください。
        </p>
      </Article>

      <Article heading="3. 使い方の制限">
        <p>次の行為はご遠慮ください。</p>
        <List
          items={[
            "掲載内容を、出典を示さずに転載すること",
            "自動化された手段で大量に取得すること（サーバーへの負荷になります）",
            "本サイトが公式であるかのように見せて利用すること",
            "法令に違反する目的での利用",
          ]}
        />
      </Article>

      <Article heading="4. 免責">
        <p>
          本サイトの利用によって生じた損害について、運営者は責任を負いかねます。 詳しくは{" "}
          <a href="/disclaimer" className="text-accent hover:text-accent-hover">
            免責事項
          </a>{" "}
          をご覧ください。
        </p>
        <p>本サイトは予告なく内容の変更・中断・終了を行うことがあります。</p>
      </Article>

      <Article heading="5. 権利についてのご連絡">
        <p>
          掲載内容に権利上の問題がある場合は、
          <a href="/contact" className="text-accent hover:text-accent-hover">
            お問い合わせ
          </a>
          の「権利・訂正」窓口からご連絡ください。確認のうえ速やかに対応します。
        </p>
      </Article>

      <Article heading="6. 本ページの変更">
        <p>
          内容を変更する場合は、このページを更新し、施行日を書き換えます。
          重要な変更のときは、サイト上でお知らせします。
        </p>
      </Article>
    </LegalPage>
  );
}
