import { describe, expect, it } from "vitest";

import { MAX_COMPARE_PLAYERS, parseComparePlayers, routes } from "./routes";

describe("routes", () => {
  it("選手のslugをURLに安全に埋め込む", () => {
    expect(routes.player("lebron-james")).toBe("/players/lebron-james");
    // slugに記号が混ざってもURLが壊れない
    expect(routes.player("a/b?c")).toBe("/players/a%2Fb%3Fc");
  });

  it("ロスターURLはチームとシーズンの両方を含む", () => {
    expect(routes.teamRoster("lakers", "2024-25")).toBe("/teams/lakers/2024-25");
  });
});

describe("比較URLの組み立て", () => {
  it("選手が未指定なら素のパスを返す", () => {
    expect(routes.compare()).toBe("/compare");
    expect(routes.compare([])).toBe("/compare");
  });

  it("選手を ?p= の繰り返しで表す", () => {
    expect(routes.compare(["a", "b"])).toBe("/compare?p=a&p=b");
  });

  it("上限を超えたら先頭4件に丸める（エラーにしない）", () => {
    const url = routes.compare(["a", "b", "c", "d", "e", "f"]);

    expect(url).toBe("/compare?p=a&p=b&p=c&p=d");
    expect(url.match(/p=/g)?.length).toBe(MAX_COMPARE_PLAYERS);
  });
});

describe("parseComparePlayers", () => {
  it("未指定なら空", () => {
    expect(parseComparePlayers(undefined)).toEqual([]);
  });

  it("1人でも配列で返す", () => {
    expect(parseComparePlayers("a")).toEqual(["a"]);
  });

  it("複数指定を受け取る", () => {
    expect(parseComparePlayers(["a", "b"])).toEqual(["a", "b"]);
  });

  it("5人以上は先頭4件に丸める。エラーにしない", () => {
    // 上限超過でページを落とすと、URLを共有された相手がエラー画面を見ることになる。
    expect(parseComparePlayers(["a", "b", "c", "d", "e"])).toEqual(["a", "b", "c", "d"]);
  });

  it("空文字や空白だけの値は捨てる", () => {
    expect(parseComparePlayers(["a", "", "  ", "b"])).toEqual(["a", "b"]);
  });
});
