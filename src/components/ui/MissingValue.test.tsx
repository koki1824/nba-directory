import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { MissingValue } from "./MissingValue";

/**
 * オーバーライド v3 §8「0 / NULL / N/A / Not calculated を区別する」を守らせるテスト。
 * ここが崩れると、サイトが嘘の数字を出します。
 */
describe("MissingValue", () => {
  it("データなし（NULL）は em ダッシュで表す", () => {
    render(<MissingValue reason="no_data" />);

    expect(screen.getByLabelText("データなし")).toHaveTextContent("—");
  });

  it("該当なしは N/A と表す", () => {
    render(<MissingValue reason="not_applicable" />);

    expect(screen.getByLabelText("該当なし")).toHaveTextContent("N/A");
  });

  it("算出不可は 0 でも空欄でもなく「算出不可」と表す", () => {
    render(<MissingValue reason="not_calculated" />);

    const el = screen.getByLabelText("算出条件を満たしません");
    expect(el).toHaveTextContent("算出不可");
    expect(el).not.toHaveTextContent("0");
  });

  it("3つの理由はそれぞれ異なる文字列で表示される（見た目で区別できる）", () => {
    const { container } = render(
      <>
        <MissingValue reason="no_data" />
        <MissingValue reason="not_applicable" />
        <MissingValue reason="not_calculated" />
      </>,
    );

    const texts = Array.from(container.querySelectorAll("[data-missing]")).map(
      (el) => el.textContent,
    );
    expect(new Set(texts).size).toBe(3);
  });

  it("理由の補足を渡すと読み上げ用の説明に含まれる", () => {
    render(<MissingValue reason="not_applicable" detail="プレーオフ未出場" />);

    expect(screen.getByLabelText("該当なし（プレーオフ未出場）")).toBeInTheDocument();
  });
});
