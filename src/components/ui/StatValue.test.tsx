import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { StatValue } from "./StatValue";

describe("StatValue", () => {
  it("0 は 0.0 と表示する（欠損ではない）", () => {
    // 「10本打って0本」は事実。—— で隠すと情報が消える。
    render(<StatValue value={0} />);

    expect(screen.getByText("0.0")).toBeInTheDocument();
  });

  it("null は欠損として表示する。0.0 にしない", () => {
    render(<StatValue value={null} />);

    expect(screen.queryByText("0.0")).not.toBeInTheDocument();
    expect(screen.getByText("—")).toBeInTheDocument();
  });

  it("undefined も欠損として扱う", () => {
    render(<StatValue value={undefined} />);

    expect(screen.getByText("—")).toBeInTheDocument();
  });

  it("算出不可を理由として出せる", () => {
    // 試投0本のFG%はここを通る。「データなし」ではなく「算出不可」。
    render(<StatValue value={null} missingReason="not_calculated" missingDetail="試投0本" />);

    expect(screen.getByText("算出不可")).toBeInTheDocument();
    expect(screen.getByLabelText(/試投0本/)).toBeInTheDocument();
  });

  it("プレーオフ未出場は該当なしとして出せる", () => {
    render(
      <StatValue value={null} missingReason="not_applicable" missingDetail="プレーオフ未出場" />,
    );

    expect(screen.getByText("N/A")).toBeInTheDocument();
  });

  it("桁数を指定できる", () => {
    render(<StatValue value={24.567} digits={2} />);

    expect(screen.getByText("24.57")).toBeInTheDocument();
  });

  it("率は % で出す", () => {
    render(<StatValue value={0.4123} percent />);

    expect(screen.getByText("41.2%")).toBeInTheDocument();
  });

  it("率が 0 でも 0.0% と出す（欠損にしない）", () => {
    render(<StatValue value={0} percent />);

    expect(screen.getByText("0.0%")).toBeInTheDocument();
  });
});
