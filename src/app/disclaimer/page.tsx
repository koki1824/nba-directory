import type { Metadata } from "next";

import { Article, LegalPage, List } from "@/components/legal/LegalPage";
import { UNOFFICIAL_NOTICE } from "@/config/legal";

export const metadata: Metadata = {
  title: "免責事項",
  description: "本サイトの情報の正確性と、利用にともなう責任の範囲について。",
};

export default function Page() {
  return (
    <LegalPage title="免責事項" lead="本サイトの情報をどう受け取っていただきたいかの説明です。">
      <Article heading="1. 非公式サイトです">
        <p>{UNOFFICIAL_NOTICE}</p>
      </Article>

      <Article heading="2. 情報の正確性">
        <p>
          掲載している数値は、取得元のデータと本サイトの計算に基づいています。
          <strong>正確性・完全性・最新性を保証するものではありません。</strong>
        </p>
        <p>差異が生じる主な原因は次のとおりです。</p>
        <List
          items={[
            "取得元の更新が反映されるまでの時間差",
            "集計方法や基準日の違い（年齢の基準日など）",
            "本サイトの不具合",
          ]}
        />
        <p>
          <strong>正確な記録が必要な場合は、必ず公式の発表をご確認ください。</strong>
        </p>
      </Article>

      <Article heading="3. 責任の範囲">
        <p>
          本サイトの利用、または利用できなかったことによって生じた損害について、
          運営者は責任を負いかねます。
        </p>
        <p>
          本サイトから他のサイトへのリンクがある場合、そのリンク先の内容について
          運営者は責任を負いません。
        </p>
      </Article>

      <Article heading="4. 提供の継続について">
        <p>本サイトは個人が運営しています。予告なく内容の変更・中断・終了を行うことがあります。</p>
      </Article>
    </LegalPage>
  );
}
