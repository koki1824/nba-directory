import { defineConfig } from "vitest/config";

/**
 * DBにつなぐテスト（integration）専用の設定。
 *
 * 【なぜ普通のテストと分けるか】
 * 画面が使う問い合わせは、SQLとしてDBに投げてみないと正しさが分からない。
 * 一方で、DBが要るテストを普段の `npm run test` に混ぜると、
 * DBを立てていない環境ではテスト全体が動かなくなる。
 *
 * そこで分けて、CIでは PostgreSQL を立てているジョブでだけ動かす。
 *   npm run test         … DB不要。速い。毎回動かす
 *   npm run test:db      … DBが要る。CIのマイグレーション検証ジョブで動かす
 *
 * 対象は *.db.test.ts というファイル名にしてある。
 * 名前で分かるようにしておかないと、DBが要るテストが
 * 普通のテストに紛れ込んで「たまに落ちるテスト」になる。
 */
export default defineConfig({
  resolve: {
    tsconfigPaths: true,
    // src/db/client.ts は `server-only` を読み込んでいる。
    // クライアント側から読まれたときに例外を投げる仕掛けで、
    // 接続情報を誤ってブラウザへ持ち出すのを防いでいる。
    //
    // このテストはサーバー側の想定なので、その仕掛けを無効にする。
    // 解決条件（react-server）でも切り替えられるが、Vitestのどの経路で
    // 解決されるかに依存して効いたり効かなかったりする。
    // 空のモジュールに置き換えるほうが確実で、意図も読み取りやすい。
    alias: { "server-only": new URL("./src/test/server-only-stub.ts", import.meta.url).pathname },
  },
  test: {
    // DOMは要らない。SQLの結果を確かめるだけ。
    environment: "node",
    include: ["src/**/*.db.test.ts"],
    exclude: ["node_modules/**", ".next/**", "e2e/**"],
    // DBへの問い合わせは同時に走らせない。
    // 同じテーブルを見ているので、並行させると互いの前提を壊す。
    fileParallelism: false,
  },
});
