import { expect, test } from "@playwright/test";

/**
 * ランキング（W2-10）。
 *
 * 一番大事なのは「規定（最低出場条件）を画面に書くこと」。
 * 書かないと、なぜある選手が載っていないのかが分からない。
 */

async function skipIfNoDatabase(page: import("@playwright/test").Page) {
  const notice = page.getByText("データベースの接続先が設定されていません");
  if (await notice.isVisible().catch(() => false)) {
    test.skip(true, "DBにつながっていないため飛ばす");
  }
}

test.describe("ランキング", () => {
  test("順位表が出る", async ({ page }) => {
    await page.goto("/rankings");
    await skipIfNoDatabase(page);

    await expect(page.getByRole("heading", { level: 1, name: "ランキング" })).toBeVisible();
    await expect(page.getByRole("table")).toBeVisible();
  });

  test("規定（最低出場条件）を必ず書く", async ({ page }) => {
    // 条件を書かないと「なぜこの選手がいないのか」が分からない。
    await page.goto("/rankings");
    await skipIfNoDatabase(page);

    // まだ条件を設定していない段階では、そう書いてあること
    await expect(page.getByText(/最低出場条件|規定:/)).toBeVisible();
  });

  test("指標を切り替えられる", async ({ page }) => {
    await page.goto("/rankings");
    await skipIfNoDatabase(page);

    await page.getByLabel("指標").selectOption("reb_per_game");
    await page.waitForURL(/metric=reb_per_game/);

    await expect(page.getByRole("table")).toBeVisible();
  });

  test("少ないほうが良い指標だと明示する", async ({ page }) => {
    // 一律に「多いほど良い」で見せると、ミスが多い選手が1位に見える。
    await page.goto("/rankings?metric=tov_per_game");
    await skipIfNoDatabase(page);

    await expect(page.getByText(/少ないほど良い指標です/)).toBeVisible();
  });

  test("少ないほうが良い指標は小さい値が上に来る", async ({ page }) => {
    await page.goto("/rankings?metric=tov_per_game");
    await skipIfNoDatabase(page);

    const cells = page.getByRole("table").getByRole("row").locator("td:last-child");
    const values = (await cells.allTextContents()).map(Number).filter((n) => !Number.isNaN(n));

    expect(values.length).toBeGreaterThan(1);
    expect(values).toEqual([...values].sort((a, b) => a - b));
  });

  test("プレーオフは全選手を出し、条件を設けないと書く（DECISIONS §4）", async ({ page }) => {
    await page.goto("/rankings?type=playoff");
    await skipIfNoDatabase(page);

    await expect(page.getByText(/プレーオフは最低出場条件を設けていません/)).toBeVisible();
    // 試合数を併記する
    await expect(page.getByRole("columnheader", { name: "試合" })).toBeVisible();
  });

  test("同じ選手が二重に出ない", async ({ page }) => {
    // 規定の照合が2件に当たると倍になる（0004 で直した不具合）。
    await page.goto("/rankings");
    await skipIfNoDatabase(page);

    const links = page.getByRole("table").getByRole("link");
    const hrefs = (
      await links.evaluateAll((els) =>
        els.map((el) => (el as HTMLAnchorElement).getAttribute("href")),
      )
    ).filter((h) => h?.startsWith("/players/"));

    expect(hrefs.length).toBeGreaterThan(0);
    expect(new Set(hrefs).size).toBe(hrefs.length);
  });

  test("URLに変な値が入っても落ちない", async ({ page }) => {
    const response = await page.goto("/rankings?metric=no_such&season=zzzz&type=bogus");

    expect(response?.status()).toBe(200);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });

  test("選んだランキングをそのまま送れる（URLに入る）", async ({ page }) => {
    await page.goto("/rankings?metric=ast_per_game&season=2023-24");
    await skipIfNoDatabase(page);

    await expect(page.getByLabel("指標")).toHaveValue("ast_per_game");
    await expect(page.getByLabel("シーズン")).toHaveValue("2023-24");
  });
});
