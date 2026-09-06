import { describe, expect, it } from "vitest";

import { divide, fromNullable, isValue, missing, notApplicable, onlyWhen, value } from "./missing";

describe("0 と 欠損 の区別（オーバーライド v3 §8）", () => {
  it("0 は値として扱う。欠損ではない", () => {
    // 「10本打って0本決まらなかった」は事実。—— で隠してはいけない。
    expect(fromNullable(0)).toEqual({ kind: "value", value: 0 });
    expect(isValue(fromNullable(0))).toBe(true);
  });

  it("null は no_data。0 に変換しない", () => {
    // ここで 0 にすると、記録が残っていない選手が「0本」の選手になる。
    expect(fromNullable(null)).toEqual({ kind: "missing", reason: "no_data" });
  });

  it("undefined も no_data", () => {
    expect(fromNullable(undefined)).toEqual({ kind: "missing", reason: "no_data" });
  });

  it("NaN を値として通さない", () => {
    // 計算の失敗がそのまま画面に出るのを防ぐ。
    expect(fromNullable(Number.NaN)).toEqual({ kind: "missing", reason: "no_data" });
  });

  it("欠損の理由を差し替えられる", () => {
    expect(fromNullable(null, "not_applicable", "プレーオフ未出場")).toEqual({
      kind: "missing",
      reason: "not_applicable",
      detail: "プレーオフ未出場",
    });
  });
});

describe("divide — 0% と 算出不可 の区別", () => {
  it("普通に割れる", () => {
    expect(divide(41, 101)).toEqual({ kind: "value", value: 41 / 101 });
  });

  it("10本打って0本は 0%。これは事実なので値として出す", () => {
    expect(divide(0, 10)).toEqual({ kind: "value", value: 0 });
  });

  it("0本打って0本は算出不可。0% ではない", () => {
    // ★このテストが落ちたら、シュートを打たない選手が
    //   「成功率0%の下手な選手」としてランキング最下位に並ぶ。
    const result = divide(0, 0);

    expect(result.kind).toBe("missing");
    expect(result).toMatchObject({ reason: "not_calculated" });
    expect(isValue(result)).toBe(false);
  });

  it("分子が未取得なら no_data（算出不可ではない）", () => {
    // 「打っていないから出せない」と「記録が無いから出せない」は別物。
    expect(divide(null, 10)).toMatchObject({ reason: "no_data" });
  });

  it("分母が未取得なら no_data", () => {
    expect(divide(10, null)).toMatchObject({ reason: "no_data" });
  });

  it("分母0のときは理由を添える", () => {
    expect(divide(5, 0)).toMatchObject({ reason: "not_calculated", detail: "分母が0" });
    expect(divide(5, 0, "試投0本")).toMatchObject({ detail: "試投0本" });
  });
});

describe("not_applicable — 概念が当てはまらない", () => {
  it("no_data とは別物として扱う", () => {
    // 「まだ取得していない」と「永久に存在しない」を混ぜると、
    // プレーオフ未出場が「データ取得中」に見える。
    const po = notApplicable("プレーオフ未出場");

    expect(po).toEqual({
      kind: "missing",
      reason: "not_applicable",
      detail: "プレーオフ未出場",
    });
    expect(po).not.toMatchObject({ reason: "no_data" });
  });

  it("onlyWhen は条件を満たすときだけ値を通す", () => {
    expect(onlyWhen(true, value(12.3), "プレーオフ未出場")).toEqual({
      kind: "value",
      value: 12.3,
    });
    expect(onlyWhen(false, value(12.3), "プレーオフ未出場")).toMatchObject({
      reason: "not_applicable",
      detail: "プレーオフ未出場",
    });
  });

  it("条件を満たしても中身が欠損ならその欠損が残る", () => {
    // 出場はしたが記録が無い、という状態を握りつぶさない。
    expect(onlyWhen(true, missing("no_data"), "プレーオフ未出場")).toMatchObject({
      reason: "no_data",
    });
  });
});
