import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import Home from "./page";

/**
 * トップページ。
 * サイト名はヘッダーのロゴが持つので、見出しはモック 01_top.jpg どおり
 * 「選手を探す・比べる」というキャッチコピーになる。
 */
describe("トップページ", () => {
  it("見出しにキャッチコピーが出る", () => {
    render(<Home />);

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("選手を探す・比べる");
  });

  it("中核機能への導線がある（選手一覧と比較）", () => {
    render(<Home />);

    // 比較は中核仮説なので、トップから1クリックで行けることを固定する。
    expect(screen.getByRole("link", { name: /比較ページへ/ })).toHaveAttribute("href", "/compare");
    expect(screen.getByRole("link", { name: /選手一覧ページへ/ })).toHaveAttribute(
      "href",
      "/players",
    );
  });
});
