import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

/*
 * Node のバージョンを最初に確かめる。
 *
 * jsdom@30 が同梱する undici@8 は node:worker_threads の markAsUncloneable を使い、
 * これは Node 22.22.2 以降にしかありません。古い Node だと
 * 「webidl.util.markAsUncloneable is not a function」という原因の分からない
 * エラーでテストが全滅します（CIで実際に踏みました）。
 *
 * package.json の engines は "22.x" にしてあります。Vercel がその表記でないと
 * 使う Node を判断できないためで、パッチ版までは縛れません。
 * そのぶんの見張りをここで持ちます。
 */
const REQUIRED = [22, 22, 2] as const;

function isOlderThanRequired(version: string): boolean {
  const actual = version.split(".").map(Number);
  for (const [i, required] of REQUIRED.entries()) {
    const part = actual[i] ?? 0;
    // 上位の桁で差がついた時点で決まる。同じなら次の桁へ進む。
    // 差がついた桁で打ち切らないと、23.0.0 の「0 < 22」を見て古いと誤判定する。
    if (part > required) return false;
    if (part < required) return true;
  }
  return false;
}

if (isOlderThanRequired(process.versions.node)) {
  throw new Error(
    `Node ${REQUIRED.join(".")} 以上が必要です（現在 ${process.versions.node}）。\n` +
      `.nvmrc があるので \`nvm use\` で切り替えてください。`,
  );
}

// 各テストの後に描画したDOMを破棄する。
// これをしないと前のテストの残骸が次のテストに見えてしまい、
// 「単体では通るのに全部走らせると落ちる」種類の不安定さが出る。
afterEach(() => {
  cleanup();
});
