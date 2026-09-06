import { expect, test } from "@playwright/test";

test.describe("公開URLの疎通", () => {
  test("トップページが表示され、日本語ページとして返る", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByRole("heading", { level: 1 })).toContainText("選手を探す");
    // 日本語サイトなので lang="ja" が落ちていないことを見張る。
    // スクリーンリーダーの読み上げ言語とブラウザの翻訳提案に効く。
    await expect(page.locator("html")).toHaveAttribute("lang", "ja");
  });

  test("存在しないURLは404ページになる", async ({ page }) => {
    const response = await page.goto("/this-page-does-not-exist");

    expect(response?.status()).toBe(404);
  });
});

test.describe("ルーティングの骨格（W1-10）", () => {
  // 主要なURLがすべて200で返ること。リンク切れを公開前に見つけるため。
  const paths = [
    "/players",
    "/players/test-slug",
    "/compare",
    "/teams",
    "/teams/test-slug",
    "/teams/test-slug/2024-25",
    "/teams/compare",
    "/rankings",
    "/terms",
    "/privacy",
    "/data-sources",
    "/image-credits",
    "/disclaimer",
    "/corrections",
    "/contact",
  ];

  for (const path of paths) {
    test(`${path} が表示される`, async ({ page }) => {
      const response = await page.goto(path);

      expect(response?.status()).toBe(200);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    });
  }

  test("ヘッダーの主要メニューが全ページ共通で出る", async ({ page }) => {
    await page.goto("/players");

    const nav = page.getByRole("navigation", { name: "主要メニュー" });
    for (const label of ["選手", "チーム", "比較", "ランキング"]) {
      await expect(nav.getByRole("link", { name: label, exact: true })).toBeVisible();
    }
  });

  test("コラムはまだ出さない（Q7の決定）", async ({ page }) => {
    await page.goto("/");

    const nav = page.getByRole("navigation", { name: "主要メニュー" });
    await expect(nav.getByRole("link", { name: "コラム" })).toHaveCount(0);
  });

  test("法務ページへのリンクが全ページのフッターにある（公開の必須条件）", async ({ page }) => {
    await page.goto("/rankings");

    const footer = page.getByRole("navigation", { name: "サイト情報" });
    for (const label of ["ご利用について", "プライバシーポリシー", "データ出典"]) {
      await expect(footer.getByRole("link", { name: label })).toBeVisible();
    }
  });
});

test.describe("トップページの操作感（オーナー指摘 2026-09-06）", () => {
  test("入口カードは全体がリンクになっている（指で押す範囲を広く取る）", async ({ page }) => {
    await page.goto("/");

    // 見出しがリンクの中にある = カードごとリンクになっている。
    // 文字だけのリンクだと押せる範囲が狭く、押し外しやすい。
    const compareCard = page.getByRole("link", { name: "比較ページへ" });
    await expect(compareCard).toHaveAttribute("href", "/compare");
    await expect(compareCard.getByRole("heading", { name: "比較をはじめる" })).toBeVisible();
  });

  test("カーソルを重ねると浮き上がる", async ({ page }, testInfo) => {
    // 浮き上がりは hover のある環境だけの挙動。
    // スマホは hover を持たないので、この検証はデスクトップだけで行う。
    test.skip(testInfo.project.name !== "desktop-chromium", "hover のある環境のみ");

    await page.goto("/");
    const card = page.getByRole("link", { name: "比較ページへ" });

    const before = await card.evaluate((el) => getComputedStyle(el).transform);
    await card.hover();
    // transition の 150ms を待つ
    await expect
      .poll(async () => card.evaluate((el) => getComputedStyle(el).transform))
      .not.toBe(before);

    const after = await card.evaluate((el) => getComputedStyle(el).transform);
    // matrix(1, 0, 0, 1, 0, -2) の最後の値が縦の移動量。上に動くので負になる。
    const translateY = Number(after.match(/matrix\([^)]*,\s*(-?[\d.]+)\)/)?.[1] ?? 0);
    expect(translateY).toBeLessThan(0);
  });

  test("「視差効果を減らす」設定のときは動かさない", async ({ page }) => {
    // 動きで気分が悪くなる人がいる。OSの設定は必ず尊重する。
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");

    const card = page.getByRole("link", { name: "比較ページへ" });
    await card.hover();

    const transform = await card.evaluate((el) => getComputedStyle(el).transform);
    expect(["none", "matrix(1, 0, 0, 1, 0, 0)"]).toContain(transform);
  });
});

test.describe("狭い画面でレイアウトが崩れないこと", () => {
  test("メニューの文字が縦に割れない", async ({ page }) => {
    // ヘッダーの文字を大きくしたとき、狭い画面で実際に起きた壊れ方はこれ。
    // 横スクロールは出ないまま、メニューの各項目が1文字ずつ縦に折り返され、
    // 「チーム」が縦書きのようになって高さ66pxになっていた。
    //
    // 横幅の検査（下の describe）では捕まらなかったので、
    // 「1項目が1行に収まっているか」を高さで見る。
    await page.goto("/");

    const links = page.getByRole("navigation", { name: "主要メニュー" }).getByRole("link");
    const count = await links.count();
    expect(count).toBeGreaterThan(0);

    for (let i = 0; i < count; i += 1) {
      const link = links.nth(i);
      const label = await link.textContent();
      const box = await link.boundingBox();
      // 1行なら行の高さ（文字サイズ15px × 行間）に収まる。
      // 2行になると倍以上になるので 30px を境にする。
      expect(box?.height, `「${label}」が複数行に折り返されている`).toBeLessThan(30);
    }
  });
});

test.describe("横スクロールが出ないこと", () => {
  // 横にはみ出すと、指で横に振らないと読めないページになる。
  for (const path of ["/", "/players", "/compare", "/rankings", "/styleguide"]) {
    test(`${path} が横にはみ出さない`, async ({ page }) => {
      await page.goto(path);

      const overflow = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
      }));

      // 1px は端数の丸め誤差を許容する
      expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.clientWidth + 1);
    });
  }
});

test.describe("検索エンジン向けの設定", () => {
  test("robots.txt が比較ページと管理画面を除外している", async ({ request }) => {
    const response = await request.get("/robots.txt");
    const body = await response.text();

    expect(response.status()).toBe(200);
    // 比較は選手の組み合わせが膨大で、中身の薄いページが大量に並ぶため除外する。
    expect(body).toContain("/compare");
    expect(body).toContain("/admin");
    expect(body).toContain("/styleguide");
    expect(body).toContain("Sitemap:");
  });

  test("sitemap.xml が主要ページを含み、除外対象を含まない", async ({ request }) => {
    const response = await request.get("/sitemap.xml");
    const body = await response.text();

    expect(response.status()).toBe(200);

    // 部分一致で判定すると /teams/compare が /compare に引っかかる。
    // URLを取り出してパスとして厳密に比べる。
    const paths = [...body.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => new URL(m[1]!).pathname);

    expect(paths).toContain("/players");
    expect(paths).toContain("/rankings");
    // チーム比較は組み合わせが限られるので載せてよい。
    expect(paths).toContain("/teams/compare");

    // robots で除外したものを sitemap に載せると指示が食い違う。
    expect(paths).not.toContain("/compare");
    expect(paths).not.toContain("/styleguide");
  });

  test("比較ページは noindex（自動生成ページを検索結果に出さない）", async ({ page }) => {
    await page.goto("/compare");

    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
  });

  test("見本帳は noindex", async ({ page }) => {
    await page.goto("/styleguide");

    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
  });
});
