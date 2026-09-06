import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { getPool, query } from "@/db/client";
import type {
  DataProvider,
  FetchSeasonStatsParams,
  PlayerRecord,
  SeasonStatRecord,
} from "@/providers/types";

import { findSameNameCandidates } from "./identity";
import { runSync } from "./run";

/**
 * 同期の検証（W4-3）。**T8「同じ期間を2回流して重複ゼロ」がここ。**
 *
 * 途中で失敗して流し直すのは日常なので、
 * 「2回流すと2倍になる」設計は運用に耐えない。
 */

afterAll(async () => {
  await getPool().end();
});

/** 決まったデータを返すプロバイダ。APIは叩かない。 */
function fakeProvider(options: {
  players: PlayerRecord[];
  stats: SeasonStatRecord[];
  persistenceAllowed?: boolean;
}): DataProvider {
  return {
    id: "balldontlie",
    persistenceAllowed: options.persistenceAllowed ?? true,
    capabilities: {
      metrics: ["pts_per_game"],
      earliestSeason: null,
      supportsPlayoffs: false,
      supportsTeamStats: false,
      supportsStintSplit: false,
    },
    fetchPlayers: async () => options.players,
    fetchSeasonStats: async (params: FetchSeasonStatsParams) =>
      options.stats.filter((s) => s.seasonId === params.seasonId),
  };
}

const SEASON = "2024-25";

function player(externalId: string, name: string, extra: Partial<PlayerRecord> = {}): PlayerRecord {
  return {
    externalId,
    fullNameEn: name,
    birthDate: null,
    heightCm: null,
    weightKg: null,
    ...extra,
  };
}

function stat(
  externalId: string,
  points: number,
  extra: Partial<SeasonStatRecord> = {},
): SeasonStatRecord {
  return {
    playerExternalId: externalId,
    seasonId: SEASON,
    seasonType: "regular",
    teamExternalId: null,
    gamesPlayed: 70,
    minutes: 2000,
    fieldGoalsMade: 500,
    fieldGoalsAttempted: 1000,
    points,
    ...extra,
  };
}

/** 同期で入った行だけを消す（開発用seedには触らない）。 */
async function cleanSync() {
  await query(
    `delete from public.player_season_stats
      where source_id in (select id from public.data_sources where code = 'balldontlie')`,
  );
  await query(
    `delete from public.players
      where id in (
        select internal_id::uuid from public.provider_entity_ids
         where source_id in (select id from public.data_sources where code = 'balldontlie')
           and entity_type = 'player'
      )`,
  );
  await query(
    `delete from public.provider_entity_ids
      where source_id in (select id from public.data_sources where code = 'balldontlie')`,
  );
  await query(
    `delete from public.sync_runs
      where source_id in (select id from public.data_sources where code = 'balldontlie')`,
  );
}

beforeEach(cleanSync);
afterAll(cleanSync);

async function countSyncedPlayers(): Promise<number> {
  const rows = await query<{ n: string }>(
    `select count(*)::text as n from public.provider_entity_ids
      where entity_type = 'player'
        and source_id in (select id from public.data_sources where code = 'balldontlie')`,
  );
  return Number(rows[0]?.n ?? 0);
}

async function countSyncedStats(): Promise<number> {
  const rows = await query<{ n: string }>(
    `select count(*)::text as n from public.player_season_stats
      where source_id in (select id from public.data_sources where code = 'balldontlie')`,
  );
  return Number(rows[0]?.n ?? 0);
}

describe("T8: 同じ期間を2回流して重複ゼロ", () => {
  it("2回流しても選手も成績も増えない", async () => {
    const provider = fakeProvider({
      players: [player("101", "Alpha Tester"), player("102", "Beta Tester")],
      stats: [stat("101", 1400), stat("102", 900)],
    });

    const first = await runSync({ provider, pool: getPool(), seasons: [SEASON] });
    expect(first.status).toBe("succeeded");
    const playersAfterFirst = await countSyncedPlayers();
    const statsAfterFirst = await countSyncedStats();

    const second = await runSync({ provider, pool: getPool(), seasons: [SEASON] });
    expect(second.status).toBe("succeeded");

    expect(await countSyncedPlayers()).toBe(playersAfterFirst);
    expect(await countSyncedStats()).toBe(statsAfterFirst);
  });

  it("2回目は新規ではなく更新として数える", async () => {
    const provider = fakeProvider({
      players: [player("101", "Alpha Tester")],
      stats: [stat("101", 1400)],
    });

    await runSync({ provider, pool: getPool(), seasons: [SEASON] });
    const second = await runSync({ provider, pool: getPool(), seasons: [SEASON] });

    expect(second.playersCreated).toBe(0);
    expect(second.playersUpdated).toBe(1);
  });

  it("値が変わっていれば上書きされる", async () => {
    const pool = getPool();
    await runSync({
      provider: fakeProvider({
        players: [player("101", "Alpha Tester")],
        stats: [stat("101", 1400)],
      }),
      pool,
      seasons: [SEASON],
    });

    await runSync({
      provider: fakeProvider({
        players: [player("101", "Alpha Tester")],
        stats: [stat("101", 1600)],
      }),
      pool,
      seasons: [SEASON],
    });

    const rows = await query<{ points: number }>(
      `select s.points from public.player_season_stats s
         join public.data_sources d on d.id = s.source_id
        where d.code = 'balldontlie'`,
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]!.points).toBe(1600);
  });
});

describe("同姓同名（W4-6）", () => {
  it("名前が同じでも外部IDが違えば別人として登録する", async () => {
    // 名前で結びつけると、別人の成績が1人にまとまる。
    const provider = fakeProvider({
      players: [
        player("201", "Same Name", { birthDate: "1995-01-01" }),
        player("202", "Same Name", { birthDate: "2001-06-15" }),
      ],
      stats: [stat("201", 1000), stat("202", 500)],
    });

    const result = await runSync({ provider, pool: getPool(), seasons: [SEASON] });

    expect(result.playersCreated).toBe(2);
    expect(await countSyncedPlayers()).toBe(2);
    expect(await countSyncedStats()).toBe(2);
  });

  it("同姓同名でも別々のURLになる", async () => {
    const provider = fakeProvider({
      players: [player("201", "Same Name"), player("202", "Same Name")],
      stats: [],
    });

    await runSync({ provider, pool: getPool(), seasons: [SEASON] });

    const rows = await query<{ slug: string }>(
      `select p.slug from public.players p
         join public.provider_entity_ids e on e.internal_id = p.id::text
         join public.data_sources d on d.id = e.source_id
        where d.code = 'balldontlie' order by p.slug`,
    );
    expect(rows).toHaveLength(2);
    expect(new Set(rows.map((r) => r.slug)).size).toBe(2);
  });

  it("同姓同名の候補を、判断材料つきで示せる（自動では結びつけない）", async () => {
    await runSync({
      provider: fakeProvider({
        players: [player("201", "Same Name", { birthDate: "1995-01-01" })],
        stats: [],
      }),
      pool: getPool(),
      seasons: [SEASON],
    });

    const client = await getPool().connect();
    try {
      const candidates = await findSameNameCandidates(client, {
        fullNameEn: "Same Name",
        birthDate: "1995-01-01",
      });

      expect(candidates.length).toBeGreaterThanOrEqual(1);
      // 生年月日まで一致することが分かる＝人が判断できる材料になる
      expect(candidates.some((c) => c.sameBirthDate)).toBe(true);
    } finally {
      client.release();
    }
  });

  it("既存のslugは変えない（URLが切れないように）", async () => {
    const pool = getPool();
    await runSync({
      provider: fakeProvider({ players: [player("301", "Rename Me")], stats: [] }),
      pool,
      seasons: [SEASON],
    });
    const before = await query<{ slug: string }>(
      `select p.slug from public.players p
         join public.provider_entity_ids e on e.internal_id = p.id::text
        where e.provider_id = '301'`,
    );

    // 名前が変わっても（改名・表記の修正）URLは変えない
    await runSync({
      provider: fakeProvider({ players: [player("301", "Renamed Person")], stats: [] }),
      pool,
      seasons: [SEASON],
    });
    const after = await query<{ slug: string; full_name_en: string }>(
      `select p.slug, p.full_name_en from public.players p
         join public.provider_entity_ids e on e.internal_id = p.id::text
        where e.provider_id = '301'`,
    );

    expect(after[0]!.slug).toBe(before[0]!.slug);
    expect(after[0]!.full_name_en).toBe("Renamed Person");
  });
});

describe("取り込まないもの", () => {
  it("名前が空の行は入れない", async () => {
    // 名前の無い選手ページができてしまう。
    const provider = fakeProvider({
      players: [player("401", "  "), player("402", "Valid Name")],
      stats: [],
    });

    const result = await runSync({ provider, pool: getPool(), seasons: [SEASON] });

    expect(result.playersCreated).toBe(1);
    expect(result.skipped.find((s) => s.reason === "名前が空")?.count).toBe(1);
  });

  it("選手一覧に無い選手の成績は飛ばす（勝手に選手を作らない）", async () => {
    const provider = fakeProvider({
      players: [player("501", "Known Player")],
      stats: [stat("501", 1000), stat("999", 800)],
    });

    const result = await runSync({ provider, pool: getPool(), seasons: [SEASON] });

    expect(result.statsWritten).toBe(1);
    expect(result.skipped.find((s) => s.reason === "対応する選手が見つからない")?.count).toBe(1);
  });
});

describe("失敗したとき", () => {
  it("途中で失敗したら何も入らない", async () => {
    // 「半分だけ入ったDB」を相手に原因を探すのが一番つらい。
    const provider: DataProvider = {
      ...fakeProvider({ players: [player("601", "Will Fail")], stats: [] }),
      fetchSeasonStats: async () => {
        throw new Error("取得の途中で失敗");
      },
    };

    const result = await runSync({ provider, pool: getPool(), seasons: [SEASON] });

    expect(result.status).toBe("failed");
    expect(result.errorMessage).toContain("取得の途中で失敗");
    expect(await countSyncedPlayers()).toBe(0);
  });

  it("失敗の記録は残る（走ったかどうかが分かるように）", async () => {
    const provider: DataProvider = {
      ...fakeProvider({ players: [], stats: [] }),
      fetchPlayers: async () => {
        throw new Error("接続できません");
      },
    };

    await runSync({ provider, pool: getPool(), seasons: [SEASON] });

    const rows = await query<{ status: string; error_message: string }>(
      `select r.status, r.error_message from public.sync_runs r
         join public.data_sources d on d.id = r.source_id
        where d.code = 'balldontlie' order by r.started_at desc limit 1`,
    );
    expect(rows[0]!.status).toBe("failed");
    expect(rows[0]!.error_message).toContain("接続できません");
  });

  it("許諾が無ければ書き込まない", async () => {
    const provider = fakeProvider({
      players: [player("701", "No Consent")],
      stats: [],
      persistenceAllowed: false,
    });

    await expect(runSync({ provider, pool: getPool(), seasons: [SEASON] })).rejects.toThrow(
      /許諾が確認できていません/,
    );
    expect(await countSyncedPlayers()).toBe(0);
  });
});

describe("dry-run", () => {
  it("何が起きるかは数えるが、書き込まない", async () => {
    const provider = fakeProvider({
      players: [player("801", "Dry Run")],
      stats: [stat("801", 1000)],
    });

    const result = await runSync({
      provider,
      pool: getPool(),
      seasons: [SEASON],
      dryRun: true,
    });

    expect(result.status).toBe("succeeded");
    expect(result.playersCreated).toBe(1);
    expect(await countSyncedPlayers()).toBe(0);
  });
});

describe("手動修正を消さない（T7）", () => {
  it("同期しても manual_overrides は残り、実効値に効き続ける", async () => {
    const pool = getPool();
    await runSync({
      provider: fakeProvider({ players: [player("901", "Override Target")], stats: [] }),
      pool,
      seasons: [SEASON],
    });

    const rows = await query<{ id: string }>(
      `select p.id from public.players p
         join public.provider_entity_ids e on e.internal_id = p.id::text
        where e.provider_id = '901'`,
    );
    const playerId = rows[0]!.id;

    await query(
      `insert into public.manual_overrides
         (target, target_id, column_name, value_text, is_null_override, reason_ja, created_by)
       values ('player', $1, 'full_name_ja', '手動で入れた名前', false, 'テスト', 'test')`,
      [playerId],
    );

    // 取得元の名前が変わっても、手動修正は消えない
    await runSync({
      provider: fakeProvider({ players: [player("901", "Changed Upstream")], stats: [] }),
      pool,
      seasons: [SEASON],
    });

    const effective = await query<{ full_name_ja: string; full_name_en: string }>(
      `select full_name_ja, full_name_en from public.players_effective where id = $1`,
      [playerId],
    );

    expect(effective[0]!.full_name_ja).toBe("手動で入れた名前");
    // 元データのほうは更新される
    expect(effective[0]!.full_name_en).toBe("Changed Upstream");

    await query(`delete from public.manual_overrides where target_id = $1`, [playerId]);
  });
});
