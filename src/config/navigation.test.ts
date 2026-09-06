import { describe, expect, it } from "vitest";

import { legalNavigation, mainNavigation, visibleItems } from "./navigation";

describe("ナビゲーションの定義", () => {
  it("コラムは 10/4 では表示しない（Q7の決定）", () => {
    const columns = mainNavigation.find((item) => item.label === "コラム");

    expect(columns).toBeDefined();
    expect(columns?.visible).toBe(false);
    // 「決め忘れ」ではなく「そう決めた」と分かるよう、理由を残す
    expect(columns?.note).toBeTruthy();
  });

  it("非表示の項目は visibleItems から除かれる", () => {
    expect(visibleItems(mainNavigation).some((item) => item.label === "コラム")).toBe(false);
  });

  it("選手・チーム・比較・ランキングは表示する", () => {
    const labels = visibleItems(mainNavigation).map((item) => item.label);

    expect(labels).toEqual(["選手", "チーム", "比較", "ランキング"]);
  });

  it("法務6ページと問い合わせが全ページからたどれる（公開の必須条件）", () => {
    const paths = visibleItems(legalNavigation).map((item) => item.href);

    for (const required of [
      "/terms",
      "/privacy",
      "/data-sources",
      "/image-credits",
      "/disclaimer",
      "/corrections",
      "/contact",
    ]) {
      expect(paths).toContain(required);
    }
  });
});
