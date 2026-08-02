import { defineConfig, devices } from "@playwright/test";

const PORT = 3100;
const baseURL = `http://127.0.0.1:${PORT}`;

// 通常は Playwright が自前で取得したブラウザを使う（CIはこの経路）。
// ブラウザを別途インストール済みで再取得させたくない環境向けに、
// PLAYWRIGHT_CHROMIUM_PATH でその実行ファイルを指定できるようにしておく。
const chromiumPath = process.env.PLAYWRIGHT_CHROMIUM_PATH;
const launchOptions = chromiumPath ? { launchOptions: { executablePath: chromiumPath } } : {};

export default defineConfig({
  testDir: "./e2e",
  // CIでは .only の消し忘れをエラーにする（一部のテストしか走らない状態で緑になるのを防ぐ）。
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL,
    trace: "on-first-retry",
    ...launchOptions,
  },
  projects: [
    {
      name: "desktop-chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      // モバイルはPC版の縮小ではなく別設計にするため（要件定義書 §モバイル）、
      // 最初から独立したプロジェクトとして検証対象に入れておく。
      name: "mobile-chromium",
      use: { ...devices["Pixel 7"] },
    },
  ],
  // テスト実行前に本番ビルドを起動する。開発サーバーではなく本番同等で確認する。
  webServer: {
    command: `npm run build && npx next start -p ${PORT}`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
