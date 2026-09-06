import { describe, expect, it } from "vitest";

import type { StatValue } from "./missing";
import {
  assistsPerGame,
  careerTotals,
  effectiveFieldGoalPct,
  fieldGoalPct,
  minutesPerGame,
  playoffValue,
  pointsPer36,
  pointsPerGame,
  reboundsPer36,
  reboundsPerGame,
  seasonTotalRows,
  trueShootingPct,
  type SeasonRow,
  type StatCounts,
} from "./stats";

/** 全項目 null の土台。テストごとに必要な項目だけ上書きする。 */
const EMPTY: StatCounts = {
  gamesPlayed: null,
  minutes: null,
  fieldGoalsMade: null,
  fieldGoalsAttempted: null,
  threePointersMade: null,
  threePointersAttempted: null,
  freeThrowsMade: null,
  freeThrowsAttempted: null,
  offensiveRebounds: null,
  defensiveRebounds: null,
  assists: null,
  steals: null,
  blocks: null,
  turnovers: null,
  points: null,
};

function counts(overrides: Partial<StatCounts>): StatCounts {
  return { ...EMPTY, ...overrides };
}

function row(seasonId: string, overrides: Partial<SeasonRow>): SeasonRow {
  return { ...EMPTY, seasonId, stintId: null, ...overrides };
}

/** 値であることを確かめてから中身を取り出す。 */
function expectValue(v: StatValue): number {
  expect(v.kind, `欠損だった: ${JSON.stringify(v)}`).toBe("value");
  return v.kind === "value" ? v.value : Number.NaN;
}

describe("率の計算", () => {
  it("FG% は FGM / FGA", () => {
    expect(
      expectValue(fieldGoalPct(counts({ fieldGoalsMade: 41, fieldGoalsAttempted: 101 }))),
    ).toBeCloseTo(41 / 101, 10);
  });

  it("試投0本の FG% は算出不可。0% ではない", () => {
    // ★ここが 0 になると、シュートを打たない選手が
    //   「成功率0%」としてランキング最下位に並ぶ。
    expect(fieldGoalPct(counts({ fieldGoalsMade: 0, fieldGoalsAttempted: 0 }))).toMatchObject({
      reason: "not_calculated",
    });
  });

  it("10本打って0本は 0%。これは事実なので値で出す", () => {
    expect(expectValue(fieldGoalPct(counts({ fieldGoalsMade: 0, fieldGoalsAttempted: 10 })))).toBe(
      0,
    );
  });

  it("eFG% は3Pの価値を織り込む", () => {
    // 10本中5本成功、うち3Pが2本 → (5 + 0.5×2) / 10 = 0.6
    const s = counts({ fieldGoalsMade: 5, fieldGoalsAttempted: 10, threePointersMade: 2 });

    expect(expectValue(effectiveFieldGoalPct(s))).toBeCloseTo(0.6, 10);
    // 素のFG%(0.5)より高くなる。3Pの分だけ価値がある。
    expect(expectValue(effectiveFieldGoalPct(s))).toBeGreaterThan(expectValue(fieldGoalPct(s)));
  });

  it("3Pの記録が無ければ eFG% は出さない（0本とみなさない）", () => {
    expect(
      effectiveFieldGoalPct(counts({ fieldGoalsMade: 5, fieldGoalsAttempted: 10 })),
    ).toMatchObject({ reason: "no_data" });
  });

  it("TS% はフリースローを含めた得点効率", () => {
    // PTS 25 / (2 × (20 + 0.44 × 5)) = 25 / 44.4
    const s = counts({ points: 25, fieldGoalsAttempted: 20, freeThrowsAttempted: 5 });

    expect(expectValue(trueShootingPct(s))).toBeCloseTo(25 / (2 * (20 + 0.44 * 5)), 10);
  });

  it("何も打っていなければ TS% は算出不可", () => {
    expect(
      trueShootingPct(counts({ points: 0, fieldGoalsAttempted: 0, freeThrowsAttempted: 0 })),
    ).toMatchObject({ reason: "not_calculated" });
  });
});

describe("1試合平均と36分換算", () => {
  it("平均得点は 得点 / 出場試合数", () => {
    expect(expectValue(pointsPerGame(counts({ points: 500, gamesPlayed: 20 })))).toBe(25);
  });

  it("出場0試合なら算出不可", () => {
    expect(pointsPerGame(counts({ points: 0, gamesPlayed: 0 }))).toMatchObject({
      reason: "not_calculated",
    });
  });

  it("リバウンドは攻守の合計から平均を出す", () => {
    const s = counts({ offensiveRebounds: 40, defensiveRebounds: 160, gamesPlayed: 20 });

    expect(expectValue(reboundsPerGame(s))).toBe(10);
  });

  it("攻守どちらかの記録が無ければリバウンドは出さない", () => {
    // 0として足すと、記録が無いだけの選手が「リバウンドの少ない選手」になる。
    const s = counts({ offensiveRebounds: 40, defensiveRebounds: null, gamesPlayed: 20 });

    expect(reboundsPerGame(s)).toMatchObject({ reason: "no_data" });
    expect(reboundsPer36(s)).toMatchObject({ reason: "no_data" });
  });

  it("36分換算は 実数 × 36 / 出場時間", () => {
    expect(expectValue(pointsPer36(counts({ points: 200, minutes: 400 })))).toBe(18);
  });

  it("出場0分なら36分換算は算出不可", () => {
    expect(pointsPer36(counts({ points: 0, minutes: 0 }))).toMatchObject({
      reason: "not_calculated",
    });
  });

  it("出場時間・アシストの平均も同じ規則に従う", () => {
    expect(expectValue(minutesPerGame(counts({ minutes: 600, gamesPlayed: 20 })))).toBe(30);
    expect(expectValue(assistsPerGame(counts({ assists: 100, gamesPlayed: 20 })))).toBe(5);
  });
});

describe("キャリア集計（最重要）", () => {
  // 1年目 1/1 (100%)、2年目 40/100 (40%)
  const twoSeasons: SeasonRow[] = [
    row("2023-24", { fieldGoalsMade: 1, fieldGoalsAttempted: 1, points: 2, gamesPlayed: 1 }),
    row("2024-25", { fieldGoalsMade: 40, fieldGoalsAttempted: 100, points: 100, gamesPlayed: 50 }),
  ];

  it("通算FG% は 41/101 = 40.6%。シーズン率の平均 70% ではない", () => {
    // ★このプロジェクトで最も間違えやすい計算。
    //   シーズンごとの率を平均すると (100% + 40%) / 2 = 70% になるが、
    //   実際に投げた101本のうち決まったのは41本なので 40.6% が正しい。
    const career = careerTotals(twoSeasons);
    const pct = expectValue(fieldGoalPct(career));

    expect(pct).toBeCloseTo(41 / 101, 10);
    expect(pct).not.toBeCloseTo(0.7, 3);
  });

  it("実数は合計される", () => {
    const career = careerTotals(twoSeasons);

    expect(career.fieldGoalsMade).toBe(41);
    expect(career.fieldGoalsAttempted).toBe(101);
    expect(career.points).toBe(102);
    expect(career.gamesPlayed).toBe(51);
    expect(career.seasonsPlayed).toBe(2);
  });

  it("シーズン途中の移籍で分割された行は二重に数えない", () => {
    // 移籍した選手は「移籍前」「移籍後」「シーズン合計」の3行を持つ。
    // 素直に足すと2倍になる。
    const withStints: SeasonRow[] = [
      row("2024-25", { points: 100, gamesPlayed: 50 }),
      row("2024-25", { stintId: "stint-a", points: 60, gamesPlayed: 30 }),
      row("2024-25", { stintId: "stint-b", points: 40, gamesPlayed: 20 }),
    ];

    const career = careerTotals(withStints);

    expect(career.points).toBe(100);
    expect(career.gamesPlayed).toBe(50);
    expect(career.seasonsPlayed).toBe(1);
  });

  it("seasonTotalRows はシーズン合計行だけを返す", () => {
    const rows: SeasonRow[] = [
      row("2024-25", {}),
      row("2024-25", { stintId: "stint-a" }),
      row("2023-24", {}),
    ];

    expect(seasonTotalRows(rows)).toHaveLength(2);
    expect(seasonTotalRows(rows).every((r) => r.stintId === null)).toBe(true);
  });

  it("記録の無いシーズンが混ざったら partial として伝える", () => {
    // 数値としては出せるが「全期間の合計」ではないことを画面で断れるようにする。
    const career = careerTotals([
      row("2023-24", { points: 100, gamesPlayed: 10 }),
      row("2024-25", { points: null, gamesPlayed: 20 }),
    ]);

    expect(career.points).toBe(100);
    expect(career.isPartial).toBe(true);
  });

  it("全部そろっていれば partial にはならない", () => {
    expect(careerTotals(twoSeasons).isPartial).toBe(false);
  });

  it("全シーズンで欠けている項目は partial 扱いにしない", () => {
    // 合計自体を出さないので「少なく見える」心配がない。
    // ここを partial にすると、未取得の項目が1つあるだけで注記が出っぱなしになり、
    // 本当に一部だけ欠けている場合の警告が埋もれる。
    const career = careerTotals([
      row("2023-24", { points: 10, gamesPlayed: 1 }),
      row("2024-25", { points: 20, gamesPlayed: 2 }),
    ]);

    expect(career.blocks).toBeNull();
    expect(career.isPartial).toBe(false);
  });

  it("全シーズンで記録が無い項目は合計を出さない（0にしない）", () => {
    // 0 にすると「1本も決めなかった」という別の意味になる。
    const career = careerTotals([row("2023-24", { points: 10 })]);

    expect(career.points).toBe(10);
    expect(career.blocks).toBeNull();
    expect(fieldGoalPct(career)).toMatchObject({ reason: "no_data" });
  });

  it("1試合も出ていない選手のキャリア平均は算出不可", () => {
    const career = careerTotals([row("2023-24", { points: 0, gamesPlayed: 0 })]);

    expect(pointsPerGame(career)).toMatchObject({ reason: "not_calculated" });
  });
});

describe("プレーオフの扱い", () => {
  it("未出場は not_applicable。no_data ではない", () => {
    // 「まだ入れていない」ではなく「その年は出ていない」。
    const result = playoffValue(false, () => pointsPerGame(counts({ points: 0, gamesPlayed: 0 })));

    expect(result).toMatchObject({ reason: "not_applicable", detail: "プレーオフ未出場" });
  });

  it("出場していれば普通に計算する", () => {
    const result = playoffValue(true, () => pointsPerGame(counts({ points: 120, gamesPlayed: 5 })));

    expect(expectValue(result)).toBe(24);
  });

  it("出場していても記録が無ければ no_data のまま", () => {
    const result = playoffValue(true, () =>
      pointsPerGame(counts({ points: null, gamesPlayed: 5 })),
    );

    expect(result).toMatchObject({ reason: "no_data" });
  });
});
