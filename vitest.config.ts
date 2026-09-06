import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  // tsconfig.json の paths（`@/*`）をテスト側でも解決する。Vite本体の機能で足りるため、
  // 従来必要だった vite-tsconfig-paths プラグインは入れない。
  resolve: { tsconfigPaths: true },
  test: {
    // ブラウザ相当のDOMをNode上に用意する。Reactコンポーネントの描画テストに必要。
    environment: "jsdom",
    // describe / it / expect は各テストで明示的に import する（globalsは使わない）。
    // どこから来た関数かがファイル内で完結し、型も自動で効く。
    setupFiles: ["./src/test/setup.ts"],
    // E2E（Playwright）は別コマンドで動かすので、Vitestの対象から外す。
    include: ["src/**/*.{test,spec}.{ts,tsx}", "scripts/**/*.test.mjs"],
    // *.db.test.ts はDBにつなぐテスト。DBを立てていない環境で
    // テスト全体が動かなくなるのを避けるため、こちらでは走らせない。
    // 実行は npm run test:db（vitest.integration.config.ts）。
    //
    // src/app 配下のページも対象外。データを読むページはサーバー側でしか
    // 動かない作りになっており（server-only を読み込む）、
    // ここで render しようとすると読み込みの時点で失敗する。
    // ページの検証は E2E（Playwright）で行う。実際のブラウザで動かすほうが、
    // 「本当に表示されるか」を確かめる目的にも合っている。
    exclude: [
      "node_modules/**",
      ".next/**",
      "e2e/**",
      "src/**/*.db.test.ts",
      "src/app/**/*.test.tsx",
    ],
    coverage: {
      provider: "v8",
      include: ["src/**/*.{ts,tsx}"],
      exclude: ["src/**/*.{test,spec}.{ts,tsx}", "src/test/**"],
    },
  },
});
