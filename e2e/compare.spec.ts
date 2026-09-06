import { expect, test } from "@playwright/test";

/**
 * 選手比較（W2-7）。**このサイトの中核機能。**
 *
 * 10/4 のゴールは「実在のNBAファン1名がこの機能を操作した」こと。
 * ここが壊れたまま公開すると、公開した意味がなくなる。
 */

async function skipIfNoDatabase(page: import("@playwright/test").Page) {
  const notice = page.getByText("データベースの接続先が設定されていません");
  if (await notice.isVisible().catch(() => false)) {
    test.skip(true, "DBにつながっていないため飛ばす");
  }
}

const TWO = "/compare?p=dev-dante-okafor-7&p=dev-nikolai-brandt-13";
const FOUR =
  "/compare?p=dev-dante-okafor-7&p=dev-nikolai-brandt-13&p=dev-marcus-hollowell-1&p=dev-rashad-emerson-19";

test.describe("比較ページ", () => {
  test("誰も選ばれていないときは選び方を示す（空白にしない）", async ({ page }) => {
    await page.goto("/compare");

    await expect(page.getByText("比べたい選手を選んでください")).toBeVisible();
    await expect(page.getByRole("link", { name: /選手一覧から選ぶ/ })).toBeVisible();
  });

  test("1人だけのときは、もう1人選ぶよう促す", async ({ page }) => {
    await page.goto("/compare?p=dev-dante-okafor-7");
    await skipIfNoDatabase(page);

    await expect(page.getByText(/1人だけです/)).toBeVisible();
    await expect(page.getByText(/もう1人選んでください/)).toBeVisible();
  });

  test("2人なら向かい合わせで比べられる", async ({ page }) => {
    await page.goto(TWO);
    await skipIfNoDatabase(page);

    // 両方の名前が見出しとして出る
    await expect(page.getByRole("heading", { name: /オカフォー/ })).toBeVisible();
    await expect(page.getByRole("heading", { name: /ブラント/ })).toBeVisible();
    // 指標名が出る。
    // 広い画面と狭い画面で別のまとまりを描き分けているため、
    // どちらの幅で走っても「見えているほう」だけを見る。
    await expect(page.getByText("得点", { exact: true }).filter({ visible: true })).toHaveCount(1);
  });

  test("色だけに頼らず、名前とラベルを併記している", async ({ page }) => {
    // 比較スロットの4色は明度がほぼ同じで、色覚特性やモノクロでは
    // 見分けられない（DECISIONS の比較スロット色の注記）。
    await page.goto(TWO);
    await skipIfNoDatabase(page);

    await expect(page.getByText("A", { exact: true })).toBeVisible();
    await expect(page.getByText("B", { exact: true })).toBeVisible();
    await expect(page.getByText(/色だけで区別せず/)).toBeVisible();
  });

  test("ターンオーバーは「少ないほど良い」と明示する", async ({ page }) => {
    // 一律に「多いほど良い」で見せると、ミスが多い選手が優秀に見える。
    await page.goto(TWO);
    await skipIfNoDatabase(page);

    // 狭い画面では「（少ないほど良い）」と括弧付きで並記するので、部分一致で見る。
    await expect(
      page
        .getByText(/少ないほど良い/)
        .filter({ visible: true })
        .first(),
    ).toBeVisible();
  });

  test("3〜4人なら表で比べられる", async ({ page }) => {
    await page.goto(FOUR);
    await skipIfNoDatabase(page);

    const table = page.getByRole("table", { name: "選手比較" });
    await expect(table).toBeVisible();
    // 指標の列 + 選手4人
    await expect(table.getByRole("columnheader")).toHaveCount(5);
  });

  test("シーズン成績とキャリア通算を切り替えられる", async ({ page }) => {
    await page.goto(TWO);
    await skipIfNoDatabase(page);

    await page.getByRole("link", { name: "キャリア通算" }).click();
    await page.waitForURL(/mode=career/);

    await expect(page.getByText(/キャリア通算で比べています/)).toBeVisible();
    // 率の出し方を明記する（シーズン率の平均ではない）
    await expect(page.getByText(/通算の実数から計算/)).toBeVisible();
  });

  test("比較の状態がURLに入っていて、そのまま送れる", async ({ page }) => {
    // 「この2人を比べてみて」と共有できることが、この機能の価値の半分。
    await page.goto(TWO);
    await skipIfNoDatabase(page);

    await expect(page).toHaveURL(/p=dev-dante-okafor-7/);
    await expect(page).toHaveURL(/p=dev-nikolai-brandt-13/);
  });

  test("5人以上を指定してもエラーにせず4人に丸める", async ({ page }) => {
    // 上限超過でページを落とすと、URLを送られた相手がエラー画面を見る。
    const response = await page.goto(FOUR + "&p=dev-roman-petrov-5");
    expect(response?.status()).toBe(200);
    await skipIfNoDatabase(page);

    const table = page.getByRole("table", { name: "選手比較" });
    await expect(table.getByRole("columnheader")).toHaveCount(5);
  });

  test("存在しない選手を指定しても落とさない", async ({ page }) => {
    const response = await page.goto("/compare?p=dev-nonexistent-zzz");
    expect(response?.status()).toBe(200);

    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });

  test("比較ページは検索エンジンに載せない", async ({ page }) => {
    await page.goto(TWO);

    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
  });

  test("一覧から選んで比較まで到達できる（中核の導線）", async ({ page }) => {
    // 10/4 のゴールそのもの。この道が通らなければ公開する意味がない。
    await page.goto("/players");
    await skipIfNoDatabase(page);

    await page
      .getByRole("button", { name: /を比較に追加$/ })
      .first()
      .click();
    await page.waitForURL(/[?&]p=/);
    await page
      .getByRole("button", { name: /を比較に追加$/ })
      .first()
      .click();
    await page.waitForURL(/p=.*&.*p=/);

    await page.getByRole("link", { name: /比較する/ }).click();
    await page.waitForURL(/\/compare\?/);

    await expect(page.getByRole("heading", { level: 1, name: "選手を比較する" })).toBeVisible();
    // 2人ぶんの見出しが出ている
    await expect(page.getByRole("heading", { level: 2 })).toHaveCount(2);
  });
});

test.describe("比較のモバイル表示（W2-11）", () => {
  test("狭い画面では縦積みになり、横にはみ出さない", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "mobile-chromium", "スマホ幅のみ");

    await page.goto(TWO);
    await skipIfNoDatabase(page);

    // 向かい合わせは横に3列必要で、スマホの幅に収まらない。
    // 実測で 412px の画面に 498px はみ出していたのを縦積みで直した。
    const overflow = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));
    expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.clientWidth + 1);
  });

  test("狭い画面でも両方の選手の値が読める", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "mobile-chromium", "スマホ幅のみ");

    await page.goto(TWO);
    await skipIfNoDatabase(page);

    // 縦積みでは各行に「A 選手名」「B 選手名」が付く
    await expect(page.getByText(/^A /).first()).toBeVisible();
    await expect(page.getByText(/^B /).first()).toBeVisible();
  });

  test("スクロールしても誰と誰かが分かる（上部に固定）", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "mobile-chromium", "スマホ幅のみ");

    await page.goto(TWO);
    await skipIfNoDatabase(page);

    const heading = page.getByRole("heading", { level: 2 }).first();
    const before = await heading.boundingBox();

    await page.evaluate(() => window.scrollTo(0, 600));
    await page.waitForTimeout(200);

    const after = await heading.boundingBox();
    // 貼り付いていれば、画面内に残ったまま
    expect(after).not.toBeNull();
    expect(after!.y).toBeLessThan((before?.y ?? 0) + 200);
    expect(after!.y).toBeGreaterThanOrEqual(0);
  });
});
