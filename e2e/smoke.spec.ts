import { expect, test } from "@playwright/test";

test.describe("公開URLの疎通", () => {
  test("トップページが表示され、日本語ページとして返る", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByRole("heading", { level: 1 })).toContainText("NBA選手名鑑");
    // 日本語サイトなので lang="ja" が落ちていないことを見張る。
    // スクリーンリーダーの読み上げ言語とブラウザの翻訳提案に効く。
    await expect(page.locator("html")).toHaveAttribute("lang", "ja");
  });

  test("存在しないURLは404ページになる", async ({ page }) => {
    const response = await page.goto("/this-page-does-not-exist");

    expect(response?.status()).toBe(404);
  });
});
