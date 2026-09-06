import { afterAll, describe, expect, it } from "vitest";

import { getPool, query } from "./client";
import { getRanking, getRankingMeta, rankingMetrics, rankingSeasons } from "./rankings";

afterAll(async () => {
  await getPool().end();
});

const SEASON = "2024-25";

describe("rankingMetrics", () => {
  it("値が入っている指標だけを返す", async () => {
    // 選んだ先が空だと「壊れている」と受け取られる。
    const metrics = await rankingMetrics();

    expect(metrics.length).toBeGreaterThan(0);
    expect(metrics.some((m) => m.code === "pts_per_game")).toBe(true);
    // seed には高度指標（BPM/VORP）を入れていないので出ないはず
    expect(metrics.some((m) => m.code === "bpm")).toBe(false);
  });

  it("同じ指標が二重に出ない", async () => {
    const metrics = await rankingMetrics();
    const codes = metrics.map((m) => m.code);

    expect(new Set(codes).size).toBe(codes.length);
  });
});

describe("rankingSeasons", () => {
  it("新しい順に返す", async () => {
    const seasons = await rankingSeasons();

    expect(seasons.length).toBeGreaterThan(0);
    expect(seasons).toEqual([...seasons].sort().reverse());
  });
});

describe("getRankingMeta", () => {
  it("指標の情報と規定到達者の人数を返す", async () => {
    const meta = await getRankingMeta("pts_per_game", SEASON, "regular");

    expect(meta).not.toBeNull();
    expect(meta!.metricNameJa.length).toBeGreaterThan(0);
    expect(meta!.qualifiedCount).toBeGreaterThan(0);
  });

  it("ターンオーバーは少ないほうが良いと分かる", async () => {
    const meta = await getRankingMeta("tov_per_game", SEASON, "regular");

    expect(meta!.higherIsBetter).toBe(false);
  });

  it("存在しない指標は null", async () => {
    expect(await getRankingMeta("no_such_metric", SEASON, "regular")).toBeNull();
  });

  it("規定が2件に当たっても1件だけ採用する", async () => {
    // 0003 が「全シーズン共通の既定」を入れているので、
    // シーズン個別の規定を足すと2件該当する状態になる。
    // lateral + limit 1 で絞れていないと、ここで値がぶれる。
    await query(
      `insert into public.ranking_rules (season_id, metric_code, season_type, minimum_games)
       values ($1, 'pts_per_game', 'regular', 40)
       on conflict (season_id, metric_code, season_type)
       do update set minimum_games = excluded.minimum_games`,
      [SEASON],
    );

    try {
      const meta = await getRankingMeta("pts_per_game", SEASON, "regular");
      // 共通の既定（条件なし）ではなく、シーズン個別の 40 が採用される
      expect(meta!.minimumGames).toBe(40);
    } finally {
      await query(
        `delete from public.ranking_rules
          where season_id = $1 and metric_code = 'pts_per_game' and season_type = 'regular'`,
        [SEASON],
      );
    }
  });
});

describe("getRanking", () => {
  it("上位から順位付きで返る", async () => {
    const rows = await getRanking("pts_per_game", SEASON);

    expect(rows.length).toBeGreaterThan(0);
    expect(rows[0]!.rank).toBe(1);
    expect(rows[0]!.value).not.toBeNull();
  });

  it("同じ選手が二重に出ない", async () => {
    // ランキングの規定が2件に当たると倍になる（0004 で直した不具合）。
    const rows = await getRanking("pts_per_game", SEASON, "regular", 200);
    const ids = rows.map((r) => r.playerId);

    expect(new Set(ids).size).toBe(ids.length);
  });

  it("値の大きい順に並ぶ（多いほど良い指標）", async () => {
    const rows = await getRanking("pts_per_game", SEASON);
    const values = rows.map((r) => r.value!).filter((v) => v !== null);

    expect(values).toEqual([...values].sort((a, b) => b - a));
  });

  it("少ないほうが良い指標では小さい順に並ぶ", async () => {
    // 一律に大きい順で出すと、ミスの多い選手が1位になる。
    const rows = await getRanking("tov_per_game", SEASON);
    const values = rows.map((r) => r.value!).filter((v) => v !== null);

    expect(values).toEqual([...values].sort((a, b) => a - b));
  });

  it("規定到達者が先に並ぶ", async () => {
    const rows = await getRanking("pts_per_game", SEASON, "regular", 200);
    const firstUnqualified = rows.findIndex((r) => !r.isQualified);

    if (firstUnqualified >= 0) {
      expect(rows.slice(firstUnqualified).every((r) => !r.isQualified)).toBe(true);
    }
  });

  it("プレーオフも取れる（最低条件なしで全員）", async () => {
    // DECISIONS §4: プレーオフは全選手表示 + 試合数を併記。
    const rows = await getRanking("pts_per_game", SEASON, "playoff", 200);

    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((r) => r.isQualified)).toBe(true);
    // 試合数を併記できるように必ず持って返る
    expect(rows.every((r) => r.gamesPlayed !== null)).toBe(true);
  });

  it("値が無い選手は載せない", async () => {
    // 出場0試合で平均が出せない選手を順位表に混ぜない。
    const rows = await getRanking("pts_per_game", SEASON, "regular", 200);

    expect(rows.every((r) => r.value !== null)).toBe(true);
  });

  it("記録の無いシーズンでは空（例外にしない）", async () => {
    expect(await getRanking("pts_per_game", "2015-16")).toEqual([]);
  });

  it("件数を絞れる", async () => {
    const rows = await getRanking("pts_per_game", SEASON, "regular", 3);

    expect(rows.length).toBeLessThanOrEqual(3);
  });
});
