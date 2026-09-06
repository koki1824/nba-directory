import type { Metadata } from "next";

import { Article, LegalPage, List } from "@/components/legal/LegalPage";
import { UNOFFICIAL_NOTICE } from "@/config/legal";

export const metadata: Metadata = {
  title: "データ出典",
  description: "掲載しているデータの取得元と、数値の扱い方について説明します。",
};

export default function Page() {
  return (
    <LegalPage
      title="データ出典"
      lead="どこから取得したデータを、どう計算して表示しているかを説明します。"
    >
      <Article heading="1. 取得元">
        <p>{UNOFFICIAL_NOTICE}</p>
        <p>
          成績データは外部のデータ提供サービスから取得しています。
          取得元と最終更新の日時は、各ページに表示します。
        </p>
        <p className="text-ink-muted text-xs">
          ※ 実データの取得を始めるまでは、開発用に作った<strong>架空の選手・チーム</strong>を
          表示しています。実在の人物や球団の記録ではありません。
        </p>
      </Article>

      <Article heading="2. 数値の計算について">
        <p>本サイトは次の方針で数値を出しています。</p>
        <List
          items={[
            <>
              <strong>記録が無い値を0として扱いません。</strong>
              「まだ取得していない」「その概念が当てはまらない」「計算できない」を
              それぞれ別の表示にしています
            </>,
            <>
              <strong>シュート成功率は、試投数が0のとき「算出不可」と表示します。</strong>
              0%ではありません。打っていないことと、打って決まらなかったことは違います
            </>,
            <>
              <strong>通算成績の成功率は、各シーズンの率を平均したものではありません。</strong>
              通算の成功数と試投数から計算しています
            </>,
            <>
              <strong>チーム成績は公式の記録です。</strong>
              所属選手の成績を合計したものではありません
            </>,
            <>
              <strong>シーズン当時の年齢は、そのシーズンの開幕日を基準にしています。</strong>
              他のサイトは2月1日を基準にすることが多く、1歳ずれて見える場合があります
            </>,
          ]}
        />
      </Article>

      <Article heading="3. 手動での修正">
        <p>
          明らかな誤りが見つかった場合、運営者が確認したうえで値を修正することがあります。
          修正した項目にはその旨を表示し、
          <strong>取得元のデータは書き換えずに残しています。</strong>
        </p>
      </Article>

      <Article heading="4. 誤りを見つけたら">
        <p>
          <a href="/corrections" className="text-accent hover:text-accent-hover">
            訂正の方針
          </a>{" "}
          をご覧のうえ、お問い合わせからご連絡ください。
        </p>
      </Article>
    </LegalPage>
  );
}
