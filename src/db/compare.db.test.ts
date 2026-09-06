import { afterAll, describe, expect, it } from "vitest";

import { getPool } from "./client";
import { bestIndex, COMPARE_METRICS, getCompareData, metricMax } from "./compare";
import { listPlayers } from "./players";

/**
 * 比較のデータ取得。中核機能なので厚めに確かめる。
 */

afterAll(async () => {
  await getPool().end();
});

async function twoSlugs(): Promise<[string, string]> {
  const all = await listPlayers({ sort: "points", limit: 5 });
  return [all.items[0]!.slug, all.items[1]!.slug];
}

describe("getCompareData", () => {
  it("指定した順番のまま返す（左右が勝手に入れ替わらない）", async () => {
    const [a, b] = await twoSlugs();

    const forward = await getCompareData([a, b]);
    const backward = await getCompareData([b, a]);

    expect(forward.players.map((p) => p.profile.slug)).toEqual([a, b]);
    expect(backward.players.map((p) => p.profile.slug)).toEqual([b, a]);
  });

  it("指標の値が入る", async () => {
    const [a, b] = await twoSlugs();
    const { players } = await getCompareData([a, b]);

    expect(players).toHaveLength(2);
    for (const player of players) {
      expect(player.values.pointsPerGame).not.toBeNull();
      expect(player.hasSeasonRecord).toBe(true);
    }
  });

  it("シーズンを指定できる", async () => {
    const [a, b] = await twoSlugs();
    const { players, seasonId } = await getCompareData([a, b], { seasonId: "2023-24" });

    expect(seasonId).toBe("2023-24");
    expect(players[0]!.seasonId).toBe("2023-24");
  });

  it("キャリア通算でも比較できる", async () => {
    const [a, b] = await twoSlugs();
    const { players } = await getCompareData([a, b], { mode: "career" });

    expect(players).toHaveLength(2);
    expect(players[0]!.values.pointsPerGame).not.toBeNull();
  });

  it("そのシーズンに記録が無い選手は空だと分かる（値が取れないのとは別）", async () => {
    // 2023-24 にプロ入りした選手は 2022-23 の記録を持たない。
    const all = await listPlayers({ limit: 200 });
    const rookie = all.items.find((p) => p.fullNameEn.includes("Peter Vance"));
    expect(rookie, "2024-25 加入の選手がseedにいるはず").toBeDefined();

    const { players } = await getCompareData([rookie!.slug], { seasonId: "2022-23" });

    expect(players[0]!.hasSeasonRecord).toBe(false);
    expect(players[0]!.values.pointsPerGame).toBeNull();
  });

  it("存在しないslugは黙って落とす（残りは比較できる）", async () => {
    const [a] = await twoSlugs();
    const { players } = await getCompareData([a, "dev-nonexistent-zzz"]);

    expect(players.map((p) => p.profile.slug)).toEqual([a]);
  });

  it("空の指定は空を返す", async () => {
    const { players } = await getCompareData([]);
    expect(players).toEqual([]);
  });

  it("4人まで比較できる", async () => {
    const all = await listPlayers({ sort: "points", limit: 4 });
    const { players } = await getCompareData(all.items.map((p) => p.slug));

    expect(players).toHaveLength(4);
  });

  it("選手ページと同じ数字になる（画面で計算し直していない）", async () => {
    const [a] = await twoSlugs();
    const { players, seasonId } = await getCompareData([a]);
    const listed = await listPlayers({ q: players[0]!.profile.fullNameEn, season: seasonId! });

    const fromList = listed.items.find((p) => p.slug === a)!;
    expect(players[0]!.values.pointsPerGame).toBeCloseTo(fromList.pointsPerGame!, 10);
  });
});

describe("metricMax", () => {
  it("率は 100% を満点にする", () => {
    const metric = COMPARE_METRICS.find((m) => m.key === "fieldGoalPct")!;
    expect(metricMax(metric, [])).toBe(1);
  });

  it("率でない指標は比較中の最大値を満点にする", async () => {
    const [a, b] = await twoSlugs();
    const { players } = await getCompareData([a, b]);
    const metric = COMPARE_METRICS.find((m) => m.key === "pointsPerGame")!;

    const max = metricMax(metric, players);
    const values = players.map((p) => p.values.pointsPerGame!);

    expect(max).toBe(Math.max(...values));
  });

  it("全員欠損なら満点を決められない（棒を描かない）", () => {
    const metric = COMPARE_METRICS.find((m) => m.key === "pointsPerGame")!;
    const players = [
      { values: { pointsPerGame: null } },
      { values: { pointsPerGame: null } },
    ] as never;

    expect(metricMax(metric, players)).toBeNull();
  });
});

describe("bestIndex", () => {
  const points = COMPARE_METRICS.find((m) => m.key === "pointsPerGame")!;
  const turnovers = COMPARE_METRICS.find((m) => m.key === "turnoversPerGame")!;

  function fake(values: (number | null)[]) {
    return values.map((v) => ({ values: { pointsPerGame: v, turnoversPerGame: v } })) as never;
  }

  it("多いほうが良い指標では大きい値を選ぶ", () => {
    expect(bestIndex(points, fake([20, 25]))).toBe(1);
  });

  it("ターンオーバーは少ないほうを選ぶ", () => {
    // 一律に「多いほど良い」で判定すると、ミスが多い選手が優秀に見える。
    expect(bestIndex(turnovers, fake([2.1, 3.4]))).toBe(0);
  });

  it("片方が欠損なら勝ち負けを付けない", () => {
    // 欠損を 0 とみなすと、記録が無いだけの選手が劣って見える。
    expect(bestIndex(points, fake([20, null]))).toBeNull();
    expect(bestIndex(points, fake([null, 20]))).toBeNull();
  });

  it("同値なら勝ち負けを付けない", () => {
    expect(bestIndex(points, fake([20, 20]))).toBeNull();
  });

  it("3人以上でも1人だけ選ぶ", () => {
    expect(bestIndex(points, fake([20, 25, 22]))).toBe(1);
    expect(bestIndex(points, fake([25, 25, 22]))).toBeNull();
  });
});
