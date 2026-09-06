import type { Metadata } from "next";

import { Fact, LegalPage } from "@/components/legal/LegalPage";
import { factValue } from "@/config/legal";

export const metadata: Metadata = {
  title: "お問い合わせ",
  description: "広告・PR・協賛／一般／不具合／権利の訂正、4つの窓口があります。",
};

/**
 * お問い合わせ（W5-7）。
 *
 * 【フォームを置かない理由】
 * Q9 の決定で「メール転送のみ。inquiries テーブルはスキーマだけ」と決めた。
 * フォームを作ると、送信内容をどこかに保存することになり、
 * 個人情報を預かる話が増える。メールなら運営者の受信箱に届くだけで済む。
 *
 * 【4つの窓口を分ける理由】
 * 用件によって急ぎ具合が違う。特に「権利・訂正」は、
 * 確認できるまで表示を止める必要があるため、埋もれさせてはいけない。
 * 件名をあらかじめ入れておくと、受け取る側で仕分けられる。
 */

const WINDOWS = [
  {
    title: "広告・PR・協賛",
    description: "掲載のご相談、取材のご依頼など。",
    subject: "【広告・PR・協賛】",
  },
  {
    title: "一般のお問い合わせ",
    description: "サイトの使い方、ご要望、ご感想など。",
    subject: "【一般】",
  },
  {
    title: "不具合の報告",
    description:
      "表示が崩れている、押しても反応しない、など。ご利用の端末とブラウザ、該当ページのURLを添えていただけると助かります。",
    subject: "【不具合】",
  },
  {
    title: "権利・訂正",
    description:
      "掲載内容の誤り、権利上の問題のご指摘。権利に関わるご指摘は、確認できるまで該当の表示を止めます。",
    subject: "【権利・訂正】",
    urgent: true,
  },
];

export default function Page() {
  const email = factValue("contactEmail");

  return (
    <LegalPage
      title="お問い合わせ"
      lead="用件に近い窓口からご連絡ください。いずれもメールで受け付けています。"
    >
      <p className="text-ink text-sm leading-relaxed">
        宛先はいずれも <Fact factKey="contactEmail" /> です。
        件名の頭に窓口名を入れていただけると、確認が早くなります。
      </p>

      <ul className="mt-6 space-y-4">
        {WINDOWS.map((w) => (
          <li
            key={w.title}
            className={
              w.urgent
                ? "border-accent bg-surface border-l-2 p-4"
                : "border-line bg-surface border-l-2 p-4"
            }
          >
            <h2 className="text-base">{w.title}</h2>
            <p className="text-ink-muted mt-1.5 text-sm leading-relaxed">{w.description}</p>
            <p className="text-ink-muted mt-2 text-xs">
              件名の例: <span className="text-ink">{w.subject}〜について</span>
            </p>
            {email.filled && (
              // アドレスが入っていないうちはリンクを作らない。
              // 空の mailto: は押しても何も起きず、壊れて見える。
              <a
                href={`mailto:${email.text}?subject=${encodeURIComponent(w.subject)}`}
                className="text-accent hover:text-accent-hover mt-3 inline-block text-sm"
              >
                この窓口にメールする →
              </a>
            )}
          </li>
        ))}
      </ul>

      <p className="text-ink-muted mt-8 text-xs leading-relaxed">
        個人で運営しているため、返信までにお時間をいただくことがあります。
        いただいた内容と連絡先は、返信と記録の訂正にのみ使います（
        <a href="/privacy" className="text-accent hover:text-accent-hover">
          プライバシーポリシー
        </a>
        ）。
      </p>
    </LegalPage>
  );
}
