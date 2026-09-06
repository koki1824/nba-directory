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
    exclude: ["node_modules/**", ".next/**", "e2e/**", "src/**/*.db.test.ts"],
    coverage: {
      provider: "v8",
      include: ["src/**/*.{ts,tsx}"],
      exclude: ["src/**/*.{test,spec}.{ts,tsx}", "src/test/**"],
    },
  },
});
