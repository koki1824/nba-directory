import { afterAll, describe, expect, it } from "vitest";

import { getPool } from "./client";
import {
  isPlayerSortKey,
  latestSeasonWithStats,
  listPlayers,
  playerFilterOptions,
  toNumber,
} from "./players";

/**
 * 選手一覧の問い合わせを、実際のDBに投げて確かめる。
 *
 * 前提: マイグレーション適用済み + 開発用seed投入済みのDBに
 *       DATABASE_URL がつながっていること。
 *       CIのマイグレーション検証ジョブがその状態を作っている。
 *
 * ここで見るのは「SQLが意図どおり動くか」。
 * 特に、途中移籍の選手が二重に出ないことと、
 * 欠損が 0 に化けていないこと。
 */

afterAll(async () => {
  await getPool().end();
});

describe("listPlayers", () => {
  it("最新シーズンの選手を返す", async () => {
    const result = await listPlayers();

    expect(result.items.length).toBeGreaterThan(0);
    expect(result.total).toBeGreaterThan(0);
    expect(result.seasonId).toBe(await latestSeasonWithStats());
  });

  it("同じ選手が二重に出ない（途中移籍でも1行）", async () => {
    // stint別の行を混ぜると、移籍した選手が2回出る。
    const result = await listPlayers({ limit: 200 });
    const ids = result.items.map((p) => p.id);

    expect(new Set(ids).size).toBe(ids.length);
  });

  it("名前の一部で絞り込める（英語名）", async () => {
    const result = await listPlayers({ q: "Kestrel" });

    expect(result.items.length).toBeGreaterThanOrEqual(1);
    expect(result.items.every((p) => p.fullNameEn.includes("Kestrel"))).toBe(true);
  });

  it("日本語名でも絞り込める", async () => {
    const result = await listPlayers({ q: "ケストレル" });

    expect(result.items.length).toBeGreaterThanOrEqual(1);
  });

  it("日本語名が未設定の選手を検索が取りこぼさない", async () => {
    // coalesce を忘れると、日本語名が NULL の選手が
    // 英語名で検索しても出てこなくなる。
    const all = await listPlayers({ limit: 200 });
    const noJa = all.items.find((p) => p.fullNameJa === null);
    expect(noJa, "日本語名が未設定の選手がseedにいるはず").toBeDefined();

    const result = await listPlayers({ q: noJa!.fullNameEn });
    expect(result.items.map((p) => p.id)).toContain(noJa!.id);
  });

  it("チームで絞り込める", async () => {
    const { teams } = await playerFilterOptions();
    const abbr = teams[0]!.abbreviation;

    const result = await listPlayers({ team: abbr, limit: 200 });

    expect(result.items.length).toBeGreaterThan(0);
    expect(result.items.every((p) => p.teamAbbreviation === abbr)).toBe(true);
  });

  it("ポジションで絞り込むと複合表記も拾う（G は G-F を含む）", async () => {
    const result = await listPlayers({ position: "G", limit: 200 });

    expect(result.items.length).toBeGreaterThan(0);
    expect(result.items.every((p) => p.position?.startsWith("G"))).toBe(true);
    // G-F がいることまで確かめる。前方一致になっていないと取りこぼす。
    expect(result.items.some((p) => p.position === "G-F")).toBe(true);
  });

  it("得点順に並べられる", async () => {
    const result = await listPlayers({ sort: "points", limit: 200 });
    const values = result.items.map((p) => p.pointsPerGame).filter((v): v is number => v !== null);

    const sorted = [...values].sort((a, b) => b - a);
    expect(values).toEqual(sorted);
  });

  it("成績が無い選手は並び替えで最後に来る（0扱いしない）", async () => {
    // NULL を 0 とみなして混ぜると、記録が無いだけの選手が
    // 「最下位の選手」として並んでしまう。
    const result = await listPlayers({ sort: "points", limit: 200 });
    const firstNullIndex = result.items.findIndex((p) => p.pointsPerGame === null);

    if (firstNullIndex >= 0) {
      const afterNull = result.items.slice(firstNullIndex);
      expect(afterNull.every((p) => p.pointsPerGame === null)).toBe(true);
    }
  });

  it("一本も打っていない選手の FG% は null（0 ではない）", async () => {
    const result = await listPlayers({ limit: 200 });
    const noAttempts = result.items.find((p) => p.gamesPlayed !== null && p.fieldGoalPct === null);

    expect(noAttempts, "FG%が算出不可の選手がseedにいるはず").toBeDefined();
    expect(noAttempts!.fieldGoalPct).toBeNull();
    expect(noAttempts!.fieldGoalPct).not.toBe(0);
  });

  it("シーズンを指定するとその年の成績になる", async () => {
    const { seasons } = await playerFilterOptions();
    expect(seasons.length).toBeGreaterThan(1);

    const older = await listPlayers({ season: seasons[1], limit: 5 });

    expect(older.seasonId).toBe(seasons[1]);
    expect(older.items.length).toBeGreaterThan(0);
  });

  it("件数と総数が別々に取れる（ページ送りのため）", async () => {
    const page = await listPlayers({ limit: 5 });

    expect(page.items.length).toBeLessThanOrEqual(5);
    expect(page.total).toBeGreaterThan(page.items.length);
  });

  it("offset で次のページが取れる", async () => {
    const first = await listPlayers({ limit: 5, offset: 0, sort: "name" });
    const second = await listPlayers({ limit: 5, offset: 5, sort: "name" });

    const firstIds = new Set(first.items.map((p) => p.id));
    expect(second.items.some((p) => firstIds.has(p.id))).toBe(false);
  });

  it("該当なしでも落ちずに空を返す", async () => {
    const result = await listPlayers({ q: "該当しない名前ZZZ" });

    expect(result.items).toEqual([]);
    expect(result.total).toBe(0);
  });

  it("検索語に記号が入っても壊れない", async () => {
    // URLに書かれた文字列がSQLとして実行されないことの確認。
    const result = await listPlayers({ q: "'; drop table players; --" });

    expect(result.items).toEqual([]);
    // テーブルが残っていること
    expect((await listPlayers({ limit: 1 })).items.length).toBe(1);
  });
});

describe("playerFilterOptions", () => {
  it("チーム・ポジション・シーズンの選択肢を返す", async () => {
    const options = await playerFilterOptions();

    expect(options.teams.length).toBeGreaterThanOrEqual(3);
    expect(options.positions.length).toBeGreaterThan(0);
    expect(options.seasons.length).toBeGreaterThanOrEqual(2);
    // 新しい順
    expect([...options.seasons].sort().reverse()).toEqual(options.seasons);
  });
});

describe("補助関数", () => {
  it("isPlayerSortKey は決められた候補だけを通す", () => {
    expect(isPlayerSortKey("points")).toBe(true);
    expect(isPlayerSortKey("name")).toBe(true);
    // URLに書かれた想定外の文字列を弾く
    expect(isPlayerSortKey("points; drop table players")).toBe(false);
    expect(isPlayerSortKey(undefined)).toBe(false);
  });

  it("toNumber は NULL を 0 にしない", () => {
    expect(toNumber(null)).toBeNull();
    expect(toNumber(undefined)).toBeNull();
    expect(toNumber("0")).toBe(0);
    expect(toNumber("12.5")).toBe(12.5);
  });
});
