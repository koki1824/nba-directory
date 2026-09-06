import { expect, test } from "@playwright/test";

/**
 * 法務ページ（W3-11 草案 / W5-6 実装 / W5-7 問い合わせ）。
 *
 * これらは**公開の必須条件**。抜けたまま公開すると取り返しがつかないので、
 * 存在と、書いてあるべきことを機械で見張る。
 */

const PAGES = [
  ["/terms", "ご利用について"],
  ["/privacy", "プライバシーポリシー"],
  ["/data-sources", "データ出典"],
  ["/image-credits", "画像クレジット"],
  ["/disclaimer", "免責事項"],
  ["/corrections", "訂正の方針"],
  ["/contact", "お問い合わせ"],
] as const;

test.describe("法務ページ", () => {
  for (const [path, title] of PAGES) {
    test(`${path} が中身のあるページとして開く`, async ({ page }) => {
      const response = await page.goto(path);

      expect(response?.status()).toBe(200);
      await expect(page.getByRole("heading", { level: 1, name: title })).toBeVisible();
      // 見出しだけの空ページになっていないこと
      await expect(page.getByRole("heading", { level: 2 }).first()).toBeVisible();
    });
  }

  test("全ページのフッターから法務ページへ行ける（公開の必須条件）", async ({ page }) => {
    await page.goto("/rankings");

    const footer = page.getByRole("navigation", { name: "サイト情報" });
    for (const label of ["ご利用について", "プライバシーポリシー", "データ出典"]) {
      await expect(footer.getByRole("link", { name: label })).toBeVisible();
    }
  });

  test("非公式サイトであることを明示している", async ({ page }) => {
    // 要件定義書とオーバーライド v3 が求めている表明。
    // 本文とフッターの両方に出るので、少なくとも1つ見えていればよい。
    for (const path of ["/terms", "/disclaimer", "/data-sources"]) {
      await page.goto(path);
      await expect(page.getByText(/非公式サイト/).first()).toBeVisible();
    }
  });

  test("非公式であることの文言が全ページで同じ", async ({ page }) => {
    // 言い回しが場所ごとに違うと、どれが正式な表明なのか分からなくなる。
    // src/config/legal.ts の1か所から出していることを確かめる。
    //
    // 見出しの「非公式サイトです」まで拾わないよう、
    // 表明そのものの書き出しで絞る。
    const statement = /本サイトはNBA.*非公式サイトです/;
    const texts: string[] = [];
    for (const path of ["/terms", "/disclaimer", "/players"]) {
      await page.goto(path);
      const all = await page.getByText(statement).allTextContents();
      texts.push(...all.map((s) => s.replace(/\s+/g, "")));
    }

    expect(texts.length).toBeGreaterThan(1);
    expect(new Set(texts).size).toBe(1);
  });

  test("数値の扱い方をデータ出典に書いている", async ({ page }) => {
    // 「0と欠損を区別する」「通算率はシーズン率の平均ではない」など、
    // このサイトが守っている決めごとを読む人に伝える。
    await page.goto("/data-sources");

    await expect(page.getByText(/記録が無い値を0として扱いません/)).toBeVisible();
    await expect(page.getByText(/各シーズンの率を平均したものではありません/)).toBeVisible();
    await expect(page.getByText(/所属選手の成績を合計したものではありません/)).toBeVisible();
  });

  test("確認が済むまで草案だと明示する", async ({ page }) => {
    // 確認前の文章を「確認済みの規約」として読まれないようにする。
    await page.goto("/terms");

    await expect(page.getByText("この文章は草案です")).toBeVisible();
  });

  test("運営者が埋める箇所は「未記入」と分かる（空欄で誤魔化さない）", async ({ page }) => {
    await page.goto("/terms");

    await expect(page.getByText("（未記入）").first()).toBeVisible();
  });
});

test.describe("お問い合わせ", () => {
  test("4つの窓口が並ぶ", async ({ page }) => {
    await page.goto("/contact");

    for (const name of ["広告・PR・協賛", "一般のお問い合わせ", "不具合の報告", "権利・訂正"]) {
      await expect(page.getByRole("heading", { name })).toBeVisible();
    }
  });

  test("権利・訂正は表示を止めると明記する", async ({ page }) => {
    await page.goto("/contact");

    await expect(page.getByText(/確認できるまで該当の表示を止めます/)).toBeVisible();
  });

  test("アドレスが未記入のうちはメールのリンクを出さない", async ({ page }) => {
    // 空の mailto: は押しても何も起きず、壊れて見える。
    await page.goto("/contact");

    const filled = await page.getByText("（未記入）").count();
    if (filled > 0) {
      await expect(page.getByRole("link", { name: /この窓口にメールする/ })).toHaveCount(0);
    }
  });
});
