import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import Home from "./page";

describe("トップページ", () => {
  it("サイト名が見出しとして表示される", () => {
    render(<Home />);

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("NBA選手名鑑");
  });
});
