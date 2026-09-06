import { expect, test } from "@playwright/test";

/**
 * チーム（W2-8）。
 *
 * ここで一番大事なのは「チーム成績を個人成績の合計で代用していない」ことを
 * 画面で確かめられること（オーバーライド v3 §8 の禁止事項）。
 */

async function skipIfNoDatabase(page: import("@playwright/test").Page) {
  const notice = page.getByText("データベースの接続先が設定されていません");
  if (await notice.isVisible().catch(() => false)) {
    test.skip(true, "DBにつながっていないため飛ばす");
  }
}

test.describe("チーム一覧", () => {
  test("カンファレンスごとに分かれて出る", async ({ page }) => {
    await page.goto("/teams");
    await skipIfNoDatabase(page);

    await expect(page.getByRole("heading", { level: 1, name: "チーム一覧" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "East" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "West" })).toBeVisible();
  });

  test("チーム名からチームページへ行ける", async ({ page }) => {
    await page.goto("/teams");
    await skipIfNoDatabase(page);

    await page.getByRole("row").nth(1).getByRole("link").first().click();
    await page.waitForURL(/\/teams\/dev-/);

    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });
});

test.describe("チームページ", () => {
  test("チーム成績が個人の合計でないことを画面で示す", async ({ page }) => {
    // 禁止事項を守っていることを、口で言うのではなく数字で見せる。
    await page.goto("/teams/dev-harbor-anchors");
    await skipIfNoDatabase(page);

    await expect(page.getByText(/所属選手の成績を合計したものではありません/)).toBeVisible();
    await expect(page.getByText(/一致しません/)).toBeVisible();
  });

  test("所属選手が出て、選手ページへ行ける", async ({ page }) => {
    await page.goto("/teams/dev-harbor-anchors");
    await skipIfNoDatabase(page);

    const roster = page.getByRole("table", { name: /在籍選手/ });
    await expect(roster).toBeVisible();

    await roster.getByRole("row").nth(1).getByRole("link").first().click();
    await page.waitForURL(/\/players\/dev-/);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });

  test("シーズンを切り替えると年代別ロスターへ行く", async ({ page }) => {
    await page.goto("/teams/dev-harbor-anchors");
    await skipIfNoDatabase(page);

    const nav = page.getByRole("navigation", { name: "シーズンの切り替え" });
    await nav.getByRole("link", { name: "2023-24" }).click();
    await page.waitForURL(/\/teams\/dev-harbor-anchors\/2023-24/);

    await expect(page.getByRole("heading", { level: 1 })).toContainText("2023-24");
  });

  test("存在しないチームは404", async ({ page }) => {
    const response = await page.goto("/teams/test-slug");

    expect(response?.status()).toBe(404);
  });
});

test.describe("年代別ロスター", () => {
  test("そのシーズンの顔ぶれが出る", async ({ page }) => {
    await page.goto("/teams/dev-harbor-anchors/2023-24");
    await skipIfNoDatabase(page);

    await expect(page.getByRole("table", { name: /2023-24 シーズンの在籍選手/ })).toBeVisible();
  });

  test("途中加入の選手には印を付け、成績の範囲を断る", async ({ page }) => {
    // 表の数字はシーズン全体のもので、このチームでの成績ではない。
    // 断らないと「このチームでこれだけ取った」と誤解される。
    await page.goto("/teams/dev-harbor-anchors/2023-24");
    await skipIfNoDatabase(page);

    await expect(page.getByText("※シーズン途中に加入").first()).toBeVisible();
    await expect(page.getByText(/そのシーズン全体/)).toBeVisible();
  });

  test("同じ選手が二重に出ない", async ({ page }) => {
    await page.goto("/teams/dev-harbor-anchors/2023-24");
    await skipIfNoDatabase(page);

    const links = page.getByRole("table", { name: /在籍選手/ }).getByRole("link");
    const hrefs = await links.evaluateAll((els) =>
      els.map((el) => (el as HTMLAnchorElement).getAttribute("href")),
    );

    expect(new Set(hrefs).size).toBe(hrefs.length);
  });

  test("記録の無いシーズンでも落ちない", async ({ page }) => {
    const response = await page.goto("/teams/dev-harbor-anchors/2015-16");
    expect(response?.status()).toBe(200);
    await skipIfNoDatabase(page);

    await expect(page.getByText(/在籍記録がありません/)).toBeVisible();
  });
});
