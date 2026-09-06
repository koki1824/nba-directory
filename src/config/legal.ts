/**
 * 法務ページに出る「運営者が決める事実」（W3-11 / W5-6）。
 *
 * 【空のままにしてある理由】
 * 運営者名・連絡先・施行日は**このサイトの運営者にしか分からない事実**です。
 * AIが埋めると、実在しない連絡先や誤った運営者名を法的な文書に載せることになります。
 * 空のまま置き、画面には「未記入」と出します。
 *
 * 埋め方: この配列の値を書き換えてコミットするだけです。
 * 未記入のまま公開しないよう `npm run check:launch` が知らせます。
 */

export type LegalFact = {
  key: string;
  /** 画面と点検リストに出す名前 */
  label: string;
  /** 運営者が入れる値。空文字なら未記入 */
  value: string;
  /** 何を入れればよいかの説明 */
  hint: string;
  /** 公開前に必ず必要か */
  requiredForLaunch: boolean;
};

export const LEGAL_FACTS: LegalFact[] = [
  {
    key: "operatorName",
    label: "運営者名",
    value: "",
    hint: "個人名または屋号。特定商取引法や広告掲載の問い合わせで必要になります。",
    requiredForLaunch: true,
  },
  {
    key: "contactEmail",
    label: "問い合わせ先メールアドレス",
    value: "",
    hint: "4つの窓口をまとめて受ける場合は1つで足ります。実在するアドレスを入れてください。",
    requiredForLaunch: true,
  },
  {
    key: "effectiveDate",
    label: "規約の施行日",
    value: "",
    hint: "公開日を入れます（例: 2026年10月4日）。",
    requiredForLaunch: true,
  },
  {
    key: "operatorAddress",
    label: "所在地",
    value: "",
    hint: "広告掲載を受ける場合に必要になることがあります。公開時点で広告を扱わないなら空でも構いません。",
    requiredForLaunch: false,
  },
];

export function legalFact(key: string): LegalFact | undefined {
  return LEGAL_FACTS.find((f) => f.key === key);
}

/** 未記入の値。画面では「（未記入）」と出し、空欄で誤魔化さない。 */
export function factValue(key: string): { filled: boolean; text: string; label: string } {
  const fact = legalFact(key);
  if (!fact) return { filled: false, text: "（未定義）", label: key };
  const trimmed = fact.value.trim();
  return {
    filled: trimmed.length > 0,
    text: trimmed.length > 0 ? trimmed : "（未記入）",
    label: fact.label,
  };
}

/** 公開前に埋まっていなければならない項目のうち、まだ空のもの。 */
export function missingRequiredFacts(): LegalFact[] {
  return LEGAL_FACTS.filter((f) => f.requiredForLaunch && f.value.trim().length === 0);
}

/**
 * このサイトが公式ではないことの表明。
 *
 * 要件定義書とオーバーライド v3 が「非公式であることを明示する」と定めている。
 * 1か所に書いて全ページから参照する。文言がページごとに違うと、
 * どれが正式な表明なのか分からなくなる。
 */
export const UNOFFICIAL_NOTICE =
  "本サイトはNBAおよび各チーム・選手・関連団体とは一切関係のない非公式サイトです。" +
  "リーグ・チーム・選手からの承認や提携を受けているものではありません。";
