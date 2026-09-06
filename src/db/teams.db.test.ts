import { afterAll, describe, expect, it } from "vitest";

import { getPool } from "./client";
import {
  getTeamBySlug,
  getTeamRoster,
  latestTeamSeason,
  listTeams,
  rosterPointsSum,
  teamSeasons,
} from "./teams";

afterAll(async () => {
  await getPool().end();
});

describe("listTeams", () => {
  it("チーム一覧を返す", async () => {
    const { teams, seasonId } = await listTeams();

    expect(teams.length).toBeGreaterThanOrEqual(3);
    expect(seasonId).toBe(await latestTeamSeason());
    expect(teams.every((t) => t.franchiseSlug.length > 0)).toBe(true);
  });

  it("同じチームが二重に出ない", async () => {
    const { teams } = await listTeams();
    const ids = teams.map((t) => t.id);

    expect(new Set(ids).size).toBe(ids.length);
  });

  it("勝ち数の多い順に並ぶ", async () => {
    const { teams } = await listTeams();
    const wins = teams.map((t) => t.wins).filter((w): w is number => w !== null);

    expect(wins).toEqual([...wins].sort((a, b) => b - a));
  });

  it("シーズンを指定できる", async () => {
    const { teams, seasonId } = await listTeams("2022-23");

    expect(seasonId).toBe("2022-23");
    expect(teams.length).toBeGreaterThanOrEqual(3);
  });
});

describe("getTeamBySlug", () => {
  it("フランチャイズのslugで引ける", async () => {
    const { teams } = await listTeams();
    const team = await getTeamBySlug(teams[0]!.franchiseSlug);

    expect(team).not.toBeNull();
    expect(team!.franchiseSlug).toBe(teams[0]!.franchiseSlug);
  });

  it("存在しないslugは null", async () => {
    expect(await getTeamBySlug("dev-nonexistent-zzz")).toBeNull();
  });

  it("1試合平均が計算される", async () => {
    const { teams } = await listTeams();
    const team = await getTeamBySlug(teams[0]!.franchiseSlug);

    expect(team!.pointsForPerGame).not.toBeNull();
    // 公式の合計 ÷ 試合数と一致する
    expect(team!.pointsForPerGame).toBeCloseTo(team!.pointsFor! / team!.gamesPlayed!, 9);
  });

  it("成績が無いシーズンでもチーム情報は返る", async () => {
    // 「チームが存在しない」と「その年の記録が無い」は別物。
    const { teams } = await listTeams();
    const team = await getTeamBySlug(teams[0]!.franchiseSlug, "2015-16");

    expect(team).not.toBeNull();
    expect(team!.wins).toBeNull();
    expect(team!.pointsForPerGame).toBeNull();
  });
});

describe("getTeamRoster", () => {
  it("在籍選手を返す", async () => {
    const { teams, seasonId } = await listTeams();
    const roster = await getTeamRoster(teams[0]!.id, seasonId!);

    expect(roster.length).toBeGreaterThan(0);
    expect(roster.every((r) => r.playerSlug.length > 0)).toBe(true);
  });

  it("同じ選手が二重に出ない", async () => {
    const { teams, seasonId } = await listTeams();
    for (const team of teams) {
      const roster = await getTeamRoster(team.id, seasonId!);
      const ids = roster.map((r) => r.playerId);
      expect(new Set(ids).size, `${team.abbreviation} で重複`).toBe(ids.length);
    }
  });

  it("得点の多い順に並び、成績が無い選手は最後に来る", async () => {
    const { teams, seasonId } = await listTeams();
    const roster = await getTeamRoster(teams[0]!.id, seasonId!);
    const values = roster.map((r) => r.pointsPerGame);
    const firstNull = values.findIndex((v) => v === null);

    if (firstNull >= 0) {
      expect(values.slice(firstNull).every((v) => v === null)).toBe(true);
    }
    const numbers = values.filter((v): v is number => v !== null);
    expect(numbers).toEqual([...numbers].sort((a, b) => b - a));
  });

  it("開幕日が未取得なら年齢は null（推測で埋めない）", async () => {
    const { teams, seasonId } = await listTeams();
    const roster = await getTeamRoster(teams[0]!.id, seasonId!);

    expect(roster.every((r) => r.ageAtSeasonStart === null)).toBe(true);
  });

  it("移籍で加入した選手も在籍として出る", async () => {
    // 2023-24 に Amari Lindqvist が Prairie から Harbor へ移った。
    const harbor = (await listTeams()).teams.find((t) => t.abbreviation === "HCA")!;
    const roster = await getTeamRoster(harbor.id, "2023-24");

    expect(roster.some((r) => r.fullNameEn.includes("Lindqvist"))).toBe(true);
  });

  it("記録の無いシーズンでは空を返す（例外にしない）", async () => {
    const { teams } = await listTeams();
    expect(await getTeamRoster(teams[0]!.id, "2015-16")).toEqual([]);
  });
});

describe("teamSeasons", () => {
  it("そのチームが在籍記録を持つシーズンを新しい順で返す", async () => {
    const { teams } = await listTeams();
    const seasons = await teamSeasons(teams[0]!.franchiseSlug);

    expect(seasons.length).toBeGreaterThan(0);
    expect(seasons).toEqual([...seasons].sort().reverse());
  });
});

describe("rosterPointsSum", () => {
  it("チームの公式得点と所属選手の合計は一致しない", async () => {
    // 一致させると「合計で代用してよい」という誤解を生む。
    // オーバーライド v3 §8 が禁じている代用を、画面で並べて示すために使う。
    const { teams, seasonId } = await listTeams();
    const team = await getTeamBySlug(teams[0]!.franchiseSlug, seasonId!);
    const sum = await rosterPointsSum(team!.id, seasonId!);

    expect(sum).not.toBeNull();
    expect(sum).not.toBe(team!.pointsFor);
  });
});
