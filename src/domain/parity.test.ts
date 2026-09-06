import { describe, expect, it } from "vitest";

import fixture from "../../fixtures/stat-parity.json";
import type { StatValue } from "./missing";
import {
  assistsPerGame,
  careerTotals,
  effectiveFieldGoalPct,
  fieldGoalPct,
  freeThrowPct,
  pointsPer36,
  pointsPerGame,
  reboundsPerGame,
  threePointPct,
  trueShootingPct,
  type SeasonRow,
} from "./stats";

/**
 * TypeScript の計算が、共通の期待値どおりになるかを確かめる。
 *
 * 同じ期待値を scripts/verify-domain-parity.mjs がDBのビューに対しても使う。
 * どちらかの実装だけを直すと、こちらかあちらが落ちる。
 * これが「式を2か所に持つ」ことの安全装置になっている。
 */

const rows = fixture.rows as unknown as SeasonRow[];

function num(v: StatValue): number {
  expect(v.kind, `欠損だった: ${JSON.stringify(v)}`).toBe("value");
  return v.kind === "value" ? v.value : Number.NaN;
}

describe("TypeScriptの計算とDBのビューで共通の期待値（シーズン）", () => {
  const season = rows.find((r) => r.seasonId === "9102-03");
  const expected = fixture.expectedSeason["9102-03"];

  const cases: [string, (r: SeasonRow) => StatValue, number][] = [
    ["FG%", fieldGoalPct, expected.fieldGoalPct],
    ["3P%", threePointPct, expected.threePointPct],
    ["FT%", freeThrowPct, expected.freeThrowPct],
    ["eFG%", effectiveFieldGoalPct, expected.effectiveFieldGoalPct],
    ["TS%", trueShootingPct, expected.trueShootingPct],
    ["平均得点", pointsPerGame, expected.pointsPerGame],
    ["平均リバウンド", reboundsPerGame, expected.reboundsPerGame],
    ["平均アシスト", assistsPerGame, expected.assistsPerGame],
    ["36分換算得点", pointsPer36, expected.pointsPer36],
  ];

  for (const [name, fn, want] of cases) {
    it(`${name} が期待値どおり`, () => {
      expect(season).toBeDefined();
      expect(num(fn(season!))).toBeCloseTo(want, 12);
    });
  }
});

describe("TypeScriptの計算とDBのビューで共通の期待値（キャリア）", () => {
  const career = careerTotals(rows);
  const expected = fixture.expectedCareer;

  it("実数の合計が一致する", () => {
    expect(career.seasonsPlayed).toBe(expected.seasonsPlayed);
    expect(career.gamesPlayed).toBe(expected.gamesPlayed);
    expect(career.minutes).toBe(expected.minutes);
    expect(career.fieldGoalsMade).toBe(expected.fieldGoalsMade);
    expect(career.fieldGoalsAttempted).toBe(expected.fieldGoalsAttempted);
    expect(career.points).toBe(expected.points);
  });

  const cases: [string, number, number][] = [
    ["通算FG%", num(fieldGoalPct(career)), expected.fieldGoalPct],
    ["通算3P%", num(threePointPct(career)), expected.threePointPct],
    ["通算FT%", num(freeThrowPct(career)), expected.freeThrowPct],
    ["通算eFG%", num(effectiveFieldGoalPct(career)), expected.effectiveFieldGoalPct],
    ["通算TS%", num(trueShootingPct(career)), expected.trueShootingPct],
    ["通算平均得点", num(pointsPerGame(career)), expected.pointsPerGame],
    ["通算平均リバウンド", num(reboundsPerGame(career)), expected.reboundsPerGame],
    ["通算平均アシスト", num(assistsPerGame(career)), expected.assistsPerGame],
  ];

  for (const [name, got, want] of cases) {
    it(`${name} が期待値どおり`, () => {
      expect(got).toBeCloseTo(want, 12);
    });
  }

  it("シーズン率の単純平均になっていない", () => {
    // 1年目100% と 2年目40% を平均した 70%。最も起きやすい間違い。
    expect(num(fieldGoalPct(career))).not.toBeCloseTo(fixture.wrongCareerFieldGoalPct, 3);
  });
});
