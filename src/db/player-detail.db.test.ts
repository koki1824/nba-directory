import { afterAll, describe, expect, it } from "vitest";

import { getPool } from "./client";
import {
  getPlayerAwards,
  getPlayerBySlug,
  getPlayerCareer,
  getPlayerPercentiles,
  getPlayerSeasons,
  getPlayerTeamHistory,
  getPlayersBySlugs,
} from "./player-detail";
import { listPlayers } from "./players";

/**
 * 選手ページの問い合わせを実際のDBで確かめる。
 * 開発用seedが入っている前提（CIのマイグレーション検証ジョブが作る）。
 */

afterAll(async () => {
  await getPool().end();
});

async function findSlug(predicate: (name: string) => boolean): Promise<string> {
  const all = await listPlayers({ limit: 200 });
  const hit = all.items.find((p) => predicate(p.fullNameEn));
  expect(hit, "該当する選手がseedにいるはず").toBeDefined();
  return hit!.slug;
}

describe("getPlayerBySlug", () => {
  it("slugで選手を1人取れる", async () => {
    const slug = await findSlug((n) => n.includes("Okafor"));
    const player = await getPlayerBySlug(slug);

    expect(player).not.toBeNull();
    expect(player!.fullNameEn).toContain("Okafor");
  });

  it("存在しないslugは null（例外にしない）", async () => {
    // 404を出すのは画面側の仕事。ここで例外にすると扱いが面倒になる。
    expect(await getPlayerBySlug("dev-nonexistent-zzz")).toBeNull();
  });

  it("手動修正が反映され、修正済みだと分かる", async () => {
    const slug = await findSlug((n) => n.includes("Petrov"));
    const player = await getPlayerBySlug(slug);

    // seedでは日本語名が未設定の選手に、手動修正で名前を入れてある。
    expect(player!.hasManualOverride).toBe(true);
    expect(player!.fullNameJa).toBe("ローマン・ペトロフ");
  });
});

describe("getPlayerSeasons", () => {
  it("シーズン別の成績を新しい順に返す", async () => {
    const slug = await findSlug((n) => n.includes("Okafor"));
    const player = await getPlayerBySlug(slug);
    const seasons = await getPlayerSeasons(player!.id);

    expect(seasons.length).toBeGreaterThan(0);
    const seasonIds = seasons.map((s) => s.seasonId);
    expect([...seasonIds].sort().reverse()).toEqual(seasonIds);
  });

  it("移籍したシーズンは合計行と内訳行の両方を返す", async () => {
    const slug = await findSlug((n) => n.includes("Lindqvist"));
    const player = await getPlayerBySlug(slug);
    const seasons = await getPlayerSeasons(player!.id);

    const traded = seasons.filter((s) => s.seasonType === "regular" && s.seasonId === "2023-24");

    // 合計1行 + 内訳2行
    expect(traded.filter((s) => s.stintId === null)).toHaveLength(1);
    expect(traded.filter((s) => s.stintId !== null).length).toBeGreaterThanOrEqual(2);
  });

  it("内訳行にはチーム名が付く（どこでの成績か分かるように）", async () => {
    const slug = await findSlug((n) => n.includes("Lindqvist"));
    const player = await getPlayerBySlug(slug);
    const seasons = await getPlayerSeasons(player!.id);

    const parts = seasons.filter((s) => s.stintId !== null);
    expect(parts.every((s) => s.teamAbbreviation !== null)).toBe(true);
    // 移籍前と移籍後で別のチーム
    expect(new Set(parts.map((s) => s.teamAbbreviation)).size).toBeGreaterThanOrEqual(2);
  });

  it("開幕日が未取得なら年齢は null（推測で埋めない）", async () => {
    // seedのシーズンには開幕日を入れていない（DECISIONS §1・§10）。
    const slug = await findSlug((n) => n.includes("Okafor"));
    const player = await getPlayerBySlug(slug);
    const seasons = await getPlayerSeasons(player!.id);

    expect(seasons.every((s) => s.ageAtSeasonStart === null)).toBe(true);
  });

  it("プレーオフの行も含まれる", async () => {
    const slug = await findSlug((n) => n.includes("Okafor"));
    const player = await getPlayerBySlug(slug);
    const seasons = await getPlayerSeasons(player!.id);

    expect(seasons.some((s) => s.seasonType === "playoff")).toBe(true);
  });

  it("プレーオフに出ていない選手はPOの行を持たない", async () => {
    // 「該当なし」として画面に出すために、行が無いことを頼りにする。
    const slug = await findSlug((n) => n.includes("Emerson"));
    const player = await getPlayerBySlug(slug);
    const seasons = await getPlayerSeasons(player!.id);

    expect(seasons.some((s) => s.seasonType === "playoff")).toBe(false);
  });

  it("一本も打っていないシーズンの FG% は null（0 ではない）", async () => {
    const slug = await findSlug((n) => n.includes("Brennan"));
    const player = await getPlayerBySlug(slug);
    const seasons = await getPlayerSeasons(player!.id);

    const noShots = seasons.find((s) => s.seasonId === "2024-25" && s.stintId === null);
    expect(noShots!.fieldGoalPct).toBeNull();
    expect(noShots!.fieldGoalPct).not.toBe(0);
  });
});

describe("getPlayerCareer", () => {
  it("レギュラーとプレーオフを分けて返す", async () => {
    const slug = await findSlug((n) => n.includes("Okafor"));
    const player = await getPlayerBySlug(slug);
    const career = await getPlayerCareer(player!.id);

    expect(career.map((c) => c.seasonType).sort()).toEqual(["playoff", "regular"]);
  });

  it("通算の率はシーズン率の平均ではない", async () => {
    // ビューが「合計してから割る」ことをここでも確かめる。
    const slug = await findSlug((n) => n.includes("Okafor"));
    const player = await getPlayerBySlug(slug);
    const [career, seasons] = await Promise.all([
      getPlayerCareer(player!.id),
      getPlayerSeasons(player!.id),
    ]);

    const regular = career.find((c) => c.seasonType === "regular")!;
    const seasonPcts = seasons
      .filter((s) => s.seasonType === "regular" && s.stintId === null)
      .map((s) => s.fieldGoalPct)
      .filter((v): v is number => v !== null);

    const naiveAverage = seasonPcts.reduce((a, b) => a + b, 0) / seasonPcts.length;

    expect(regular.fieldGoalPct).not.toBeNull();
    // 完全に一致することは普通ないので、一致していたら平均を使っている疑いがある
    expect(Math.abs(regular.fieldGoalPct! - naiveAverage)).toBeGreaterThan(1e-9);
  });

  it("通算の試合数はシーズン合計行だけの和（内訳を二重に数えない）", async () => {
    const slug = await findSlug((n) => n.includes("Lindqvist"));
    const player = await getPlayerBySlug(slug);
    const [career, seasons] = await Promise.all([
      getPlayerCareer(player!.id),
      getPlayerSeasons(player!.id),
    ]);

    const expected = seasons
      .filter((s) => s.seasonType === "regular" && s.stintId === null)
      .reduce((sum, s) => sum + (s.gamesPlayed ?? 0), 0);

    expect(career.find((c) => c.seasonType === "regular")!.gamesPlayed).toBe(expected);
  });
});

describe("getPlayerPercentiles", () => {
  it("母集団の人数を必ず返す（「◯人中」と出すため）", async () => {
    const slug = await findSlug((n) => n.includes("Okafor"));
    const player = await getPlayerBySlug(slug);
    const rows = await getPlayerPercentiles(player!.id, "2024-25");

    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((r) => Number.isFinite(r.population))).toBe(true);
  });

  it("同じ指標が二重に出ない", async () => {
    // ランキング規定の照合が2件に当たると倍になる（0004で直した不具合）。
    const slug = await findSlug((n) => n.includes("Okafor"));
    const player = await getPlayerBySlug(slug);
    const rows = await getPlayerPercentiles(player!.id, "2024-25");

    const codes = rows.map((r) => r.metricCode);
    expect(new Set(codes).size).toBe(codes.length);
  });

  it("ターンオーバーは少ないほうが良い指標として返る", async () => {
    const slug = await findSlug((n) => n.includes("Okafor"));
    const player = await getPlayerBySlug(slug);
    const rows = await getPlayerPercentiles(player!.id, "2024-25");

    const tov = rows.find((r) => r.metricCode === "tov_per_game");
    expect(tov?.higherIsBetter).toBe(false);
  });
});

describe("getPlayerTeamHistory", () => {
  it("所属履歴を新しい順に返す", async () => {
    const slug = await findSlug((n) => n.includes("Okafor"));
    const player = await getPlayerBySlug(slug);
    const history = await getPlayerTeamHistory(player!.id);

    expect(history.length).toBeGreaterThan(0);
    const ids = history.map((h) => h.seasonId);
    expect([...ids].sort().reverse()).toEqual(ids);
  });

  it("移籍したシーズンは2行になる", async () => {
    const slug = await findSlug((n) => n.includes("Lindqvist"));
    const player = await getPlayerBySlug(slug);
    const history = await getPlayerTeamHistory(player!.id);

    const traded = history.filter((h) => h.seasonId === "2023-24");
    expect(traded).toHaveLength(2);
    expect(traded.map((h) => h.stintOrder)).toEqual([1, 2]);
  });
});

describe("getPlayerAwards", () => {
  it("受賞歴が無ければ空を返す（例外にしない）", async () => {
    const slug = await findSlug((n) => n.includes("Okafor"));
    const player = await getPlayerBySlug(slug);

    expect(await getPlayerAwards(player!.id)).toEqual([]);
  });
});

describe("getPlayersBySlugs（比較ページ用）", () => {
  it("指定した順番のまま返す", async () => {
    // 並べ替えたつもりのない順番で選手が入れ替わると、
    // 比較の左右が勝手に入れ替わる。
    const all = await listPlayers({ limit: 4, sort: "name" });
    const slugs = all.items.map((p) => p.slug);
    const reversed = [...slugs].reverse();

    const result = await getPlayersBySlugs(reversed);

    expect(result.map((p) => p.slug)).toEqual(reversed);
  });

  it("存在しないslugは黙って落とす（残りは表示できる）", async () => {
    const all = await listPlayers({ limit: 2 });
    const slugs = all.items.map((p) => p.slug);

    const result = await getPlayersBySlugs([slugs[0]!, "dev-nonexistent-zzz", slugs[1]!]);

    expect(result.map((p) => p.slug)).toEqual([slugs[0], slugs[1]]);
  });

  it("空の指定は空を返す", async () => {
    expect(await getPlayersBySlugs([])).toEqual([]);
  });
});
