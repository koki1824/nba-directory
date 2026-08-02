import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// 各テストの後に描画したDOMを破棄する。
// これをしないと前のテストの残骸が次のテストに見えてしまい、
// 「単体では通るのに全部走らせると落ちる」種類の不安定さが出る。
afterEach(() => {
  cleanup();
});
