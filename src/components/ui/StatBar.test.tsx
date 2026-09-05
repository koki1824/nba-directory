import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { StatBar } from "./StatBar";

const fill = () => screen.getByTestId("statbar-fill");

describe("StatBar", () => {
  it("値の割合が棒の幅になる", () => {
    render(<StatBar value={75} label="得点のパーセンタイル" />);

    expect(fill()).toHaveStyle({ width: "75%" });
  });

  it("0 は欠損ではないので、幅0の棒と数値の 0 を出す", () => {
    render(<StatBar value={0} label="ブロックのパーセンタイル" />);

    expect(fill()).toHaveStyle({ width: "0%" });
    expect(screen.getByText("0")).toBeInTheDocument();
    // 0 を「—」に化けさせない
    expect(screen.queryByText("—")).not.toBeInTheDocument();
  });

  it("null のときは棒を描かず、欠損値として表示する", () => {
    render(<StatBar value={null} missingReason="not_applicable" label="PO平均得点" />);

    expect(screen.queryByTestId("statbar-fill")).not.toBeInTheDocument();
    expect(screen.getByLabelText("該当なし（PO平均得点）")).toBeInTheDocument();
  });

  it("max を超える値でも棒がはみ出さない", () => {
    render(<StatBar value={140} max={100} label="異常値" />);

    expect(fill()).toHaveStyle({ width: "100%" });
  });

  it("負の値でも棒が反転しない", () => {
    render(<StatBar value={-20} max={100} label="異常値" />);

    expect(fill()).toHaveStyle({ width: "0%" });
  });

  it("max が 0 でもゼロ除算で壊れない", () => {
    render(<StatBar value={5} max={0} label="分母ゼロ" />);

    expect(fill()).toHaveStyle({ width: "0%" });
  });

  it("読み上げ用に値と満点をテキストで持つ", () => {
    render(<StatBar value={82} max={100} label="得点のリーグ内パーセンタイル" />);

    expect(screen.getByText("得点のリーグ内パーセンタイル: 82 / 100")).toBeInTheDocument();
  });

  it("目盛を出すと 0/25/50/75/100 が並ぶ", () => {
    render(<StatBar value={50} label="パーセンタイル" showScale />);

    for (const tick of ["0", "25", "50", "75", "100"]) {
      expect(screen.getAllByText(tick).length).toBeGreaterThan(0);
    }
  });
});
