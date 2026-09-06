import { expect, test } from "@playwright/test";

/**
 * 選手一覧（W2-5）。
 *
 * 開発用seedが入ったDBにつながっている前提。
 * つながっていない場合は「接続先が設定されていません」と出るので、
 * まずそれを見て、この一覧のテストは飛ばす。
 * DBの有無でCIを落とさないようにするため。
 */

async function skipIfNoDatabase(page: import("@playwright/test").Page) {
  const notice = page.getByText("データベースの接続先が設定されていません");
  if (await notice.isVisible().catch(() => false)) {
    test.skip(true, "DBにつながっていないため飛ばす");
  }
}

test.describe("選手一覧", () => {
  test("選手が一覧に出る", async ({ page }) => {
    await page.goto("/players");
    await skipIfNoDatabase(page);

    await expect(page.getByRole("heading", { level: 1, name: "選手一覧" })).toBeVisible();
    // 表に行があること
    await expect(page.getByRole("row").nth(1)).toBeVisible();
  });

  test("名前で絞り込める", async ({ page }) => {
    await page.goto("/players");
    await skipIfNoDatabase(page);

    await page.getByLabel("名前で探す").fill("Kestrel");
    // 入力が止まってから反映されるので、URLが変わるのを待つ
    await page.waitForURL(/q=Kestrel/);

    // 表示名は日本語名なので、リンクの文字列は「ケストレル」になる。
    // 英語名はその隣に併記されるので、行全体で見る。
    const rows = page.getByRole("row").filter({ hasText: "Kestrel" });
    await expect(rows.first()).toBeVisible();
    // 同じ姓が2人いる。両方出ること。
    await expect(rows).toHaveCount(2);
  });

  test("日本語でも英語でも同じ選手にたどり着ける", async ({ page }) => {
    await page.goto("/players?q=" + encodeURIComponent("ケストレル"));
    await skipIfNoDatabase(page);

    const rows = page.getByRole("row").filter({ hasText: "Kestrel" });
    await expect(rows).toHaveCount(2);
  });

  test("絞り込んだ結果はURLに残る（そのまま人に送れる）", async ({ page }) => {
    // 画面の中だけに状態を持つと、送られた側は操作し直しになる。
    await page.goto("/players?q=Kestrel");
    await skipIfNoDatabase(page);

    await expect(page.getByLabel("名前で探す")).toHaveValue("Kestrel");
  });

  test("該当が無くてもエラーにせず、次にすることを出す", async ({ page }) => {
    await page.goto("/players?q=" + encodeURIComponent("該当しない名前ZZZ"));
    await skipIfNoDatabase(page);

    await expect(page.getByText("条件に合う選手が見つかりませんでした")).toBeVisible();
  });

  test("記録が無い値を 0 と偽らない", async ({ page }) => {
    // 一本も打っていない選手の FG% は「算出不可」。0% ではない。
    await page.goto("/players?q=Brennan");
    await skipIfNoDatabase(page);

    await expect(page.getByText("算出不可").first()).toBeVisible();
  });

  test("URLに変な値が入っても落ちない", async ({ page }) => {
    // 共有されたURLでエラー画面を見せないため。
    for (const url of [
      "/players?sort=" + encodeURIComponent("'; drop table players; --"),
      "/players?page=abc",
      "/players?page=-5",
      "/players?season=9999-99",
    ]) {
      const response = await page.goto(url);
      expect(response?.status(), url).toBe(200);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    }
  });
});

test.describe("比較トレー（中核機能への入口）", () => {
  test("選手を選ぶとトレーに溜まり、比較へ進める", async ({ page }) => {
    await page.goto("/players");
    await skipIfNoDatabase(page);

    await page
      .getByRole("button", { name: /を比較に追加$/ })
      .first()
      .click();

    const tray = page.getByRole("region", { name: "比較する選手" });
    await expect(tray).toBeVisible();
    await expect(tray.getByText("比較する選手（1 / 4）")).toBeVisible();
    // 選択がURLに乗る（送れる・戻れる）
    await expect(page).toHaveURL(/[?&]p=/);
  });

  test("選んだ状態のURLを開くとトレーが復元される", async ({ page }) => {
    await page.goto("/players");
    await skipIfNoDatabase(page);
    await page
      .getByRole("button", { name: /を比較に追加$/ })
      .first()
      .click();
    await page.waitForURL(/[?&]p=/);
    const url = page.url();

    await page.goto(url);

    await expect(page.getByRole("region", { name: "比較する選手" })).toBeVisible();
  });

  test("5人目は選べない（上限4人・DECISIONS §2）", async ({ page }) => {
    await page.goto("/players");
    await skipIfNoDatabase(page);

    for (let i = 0; i < 4; i += 1) {
      await page
        .getByRole("button", { name: /を比較に追加$/ })
        .first()
        .click();
      await page.waitForURL(new RegExp(`(p=[^&]*&?){${i + 1}}`));
    }

    const tray = page.getByRole("region", { name: "比較する選手" });
    await expect(tray.getByText("比較する選手（4 / 4）")).toBeVisible();

    // 残りの「比較に追加」ボタンは押せなくなる。
    // 押しても何も起きない、だと壊れていると思われる。
    const remaining = page.getByRole("button", { name: /を比較に追加$/ }).first();
    await expect(remaining).toBeDisabled();
  });

  test("トレーから外せる", async ({ page }) => {
    await page.goto("/players");
    await skipIfNoDatabase(page);
    await page
      .getByRole("button", { name: /を比較に追加$/ })
      .first()
      .click();

    const tray = page.getByRole("region", { name: "比較する選手" });
    await expect(tray).toBeVisible();

    await tray.getByRole("button", { name: "すべて外す" }).click();

    await expect(tray).toBeHidden();
  });
});

test.describe("選手ページ", () => {
  async function openFirstPlayer(page: import("@playwright/test").Page) {
    await page.goto("/players");
    await skipIfNoDatabase(page);
    await page.getByRole("row").nth(1).getByRole("link").first().click();
    await page.waitForURL(/\/players\/dev-/);
  }

  test("プロフィールとシーズン別成績が出る", async ({ page }) => {
    await openFirstPlayer(page);

    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.getByRole("heading", { name: "シーズン別成績" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "キャリア通算" })).toBeVisible();
  });

  test("年齢の基準日を明記している（他サイトと1歳ずれるため）", async ({ page }) => {
    // docs/DECISIONS.md §1 で「選手ページに明記する」と決めた項目。
    await openFirstPlayer(page);

    await expect(page.getByText(/そのシーズンの開幕日/)).toBeVisible();
    await expect(page.getByText(/1歳ずれて見える/)).toBeVisible();
  });

  test("キャリアの率がシーズン率の平均でないと明記している", async ({ page }) => {
    await openFirstPlayer(page);

    await expect(page.getByText(/率を平均したものではなく/)).toBeVisible();
  });

  test("パーセンタイルに母集団の人数を併記している（Q3）", async ({ page }) => {
    // 「上位20%」だけでは何と比べた値か分からない。
    await openFirstPlayer(page);

    // 母集団は説明文にも各棒の読み上げ用ラベルにも入る（どちらでも伝わるように）。
    // ここでは説明文のほうを見る。
    await expect(page.getByText(/規定到達者\s*\d+\s*人/).first()).toBeVisible();
  });

  test("移籍したシーズンは合計の下に内訳がぶら下がる", async ({ page }) => {
    await page.goto("/players/dev-amari-lindqvist-15");
    await skipIfNoDatabase(page);

    // 内訳の行は「└ チーム名」で始まる
    await expect(page.getByText(/^└ /).first()).toBeVisible();

    // レギュラーシーズンの表の中で、そのシーズンの合計行は1つだけ。
    // 同じシーズンが並列に2行出ると、合計なのか一部なのか分からない。
    // （プレーオフの表にも同じシーズンの行があるので、表を限定して数える）
    const regularTable = page.getByRole("table", { name: /レギュラーシーズン/ });
    const seasonRows = regularTable.getByRole("row").filter({ hasText: "2023-24" });
    await expect(seasonRows).toHaveCount(1);

    // その下に内訳が2行ぶら下がる（移籍前と移籍後）
    const partRows = regularTable.getByRole("row").filter({ hasText: "└" });
    await expect(partRows).toHaveCount(2);
  });

  test("プレーオフ未出場は「記録がない」と書く（データ未取得と区別）", async ({ page }) => {
    await page.goto("/players/dev-rashad-emerson-19");
    await skipIfNoDatabase(page);

    await expect(page.getByText(/プレーオフの出場記録はありません/).first()).toBeVisible();
  });

  test("手動修正が入っていることを隠さない", async ({ page }) => {
    await page.goto("/players/dev-roman-petrov-5");
    await skipIfNoDatabase(page);

    await expect(page.getByText(/運営者が確認して修正しています/)).toBeVisible();
  });

  test("存在しない選手は404", async ({ page }) => {
    const response = await page.goto("/players/dev-nonexistent-zzz");

    expect(response?.status()).toBe(404);
  });
});
