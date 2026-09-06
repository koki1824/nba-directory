import type { Pool, PoolClient } from "pg";

import type { DataProvider, PlayerRecord, SeasonStatRecord } from "@/providers/types";

import { buildUniqueSlug, findInternalId, linkInternalId } from "./identity";

/**
 * 取得したデータをDBへ入れる（W4-2 / W4-3）。
 *
 * 【冪等であること】
 * 同じ期間を2回流しても、結果が変わらないこと（T8）。
 * 途中で失敗して流し直すのは日常なので、
 * 「2回流すと2倍になる」設計は運用に耐えない。
 *
 * 実現の仕方:
 *   ・身元は外部IDで決める（provider_entity_ids）。名前で照合しない
 *   ・成績は (選手, シーズン, 種別) の一意制約に対して upsert する
 *   ・すべて1つのトランザクションで行う。途中で失敗したら何も入らない
 *
 * 【手動修正を消さない】
 * 取得した値は元データの列に入れる。manual_overrides には触らない。
 * 実効値はビューが重ねて作るので、同期しても修正が残る（T7）。
 */

export type SyncOptions = {
  provider: DataProvider;
  pool: Pool;
  /** 取り込むシーズン。新しい順でも古い順でもよい */
  seasons: string[];
  seasonType?: "regular" | "playoff";
  /** 実際には書き込まず、何が起きるかだけ数える */
  dryRun?: boolean;
  /** 進捗の通知。省略時は何もしない */
  onProgress?: (message: string) => void;
};

export type SyncResult = {
  status: "succeeded" | "failed";
  recordsRead: number;
  recordsWritten: number;
  playersCreated: number;
  playersUpdated: number;
  statsWritten: number;
  /** 取り込まなかったものと、その理由 */
  skipped: { reason: string; count: number }[];
  errorMessage: string | null;
};

/** 取得元のID。無ければ登録して返す。 */
async function ensureSourceId(client: PoolClient, code: string): Promise<string> {
  const { rows } = await client.query<{ id: string }>(
    `select id from public.data_sources where code = $1`,
    [code],
  );
  if (rows[0]) return rows[0].id;

  throw new Error(
    `データ出典 "${code}" が登録されていません。\n` +
      "  supabase/migrations の基礎データに追加してから実行してください。",
  );
}

/**
 * 選手を1人入れる（または更新する）。
 *
 * 【名前で照合しない】
 * 身元は外部IDだけで決める。同姓同名がいるため、
 * 名前で結びつけると別人の成績がまとまる。
 */
async function upsertPlayer(
  client: PoolClient,
  sourceId: string,
  record: PlayerRecord,
): Promise<{ internalId: string; created: boolean }> {
  const existingId = await findInternalId(client, {
    sourceId,
    entityType: "player",
    externalId: record.externalId,
  });

  if (existingId) {
    // 既知の選手。取得した値で元データを更新する。
    // slug は変えない。変えるとURLが切れて共有されたリンクが死ぬ。
    await client.query(
      `update public.players
          set full_name_en = $2,
              birth_date = coalesce($3::date, birth_date),
              height_cm = coalesce($4::smallint, height_cm),
              weight_kg = coalesce($5::smallint, weight_kg)
        where id = $1`,
      [existingId, record.fullNameEn, record.birthDate, record.heightCm, record.weightKg],
    );
    return { internalId: existingId, created: false };
  }

  const slug = await buildUniqueSlug(client, record.fullNameEn);
  const { rows } = await client.query<{ id: string }>(
    `insert into public.players (slug, full_name_en, birth_date, height_cm, weight_kg)
     values ($1, $2, $3::date, $4::smallint, $5::smallint)
     returning id`,
    [slug, record.fullNameEn, record.birthDate, record.heightCm, record.weightKg],
  );
  const internalId = rows[0]!.id;

  await linkInternalId(client, {
    sourceId,
    entityType: "player",
    externalId: record.externalId,
    internalId,
  });

  return { internalId, created: true };
}

/**
 * 成績を1行入れる。
 *
 * シーズン合計行（stint_id が NULL）だけを扱う。
 * 部分一致の一意インデックス pss_season_total_unique が
 * (選手, シーズン, 種別) の重複を防いでいるので、
 * それに乗せて upsert すると2回流しても増えない。
 */
async function upsertSeasonStat(
  client: PoolClient,
  sourceId: string,
  playerInternalId: string,
  record: SeasonStatRecord,
): Promise<void> {
  await client.query(
    `insert into public.player_season_stats
       (player_id, season_id, season_type, stint_id,
        games_played, minutes, field_goals_made, field_goals_attempted, points, source_id)
     values ($1, $2, $3, null, $4::smallint, $5::numeric, $6, $7, $8, $9)
     on conflict (player_id, season_id, season_type) where stint_id is null
     do update set
       games_played = excluded.games_played,
       minutes = excluded.minutes,
       field_goals_made = excluded.field_goals_made,
       field_goals_attempted = excluded.field_goals_attempted,
       points = excluded.points,
       source_id = excluded.source_id`,
    [
      playerInternalId,
      record.seasonId,
      record.seasonType,
      record.gamesPlayed,
      record.minutes,
      record.fieldGoalsMade,
      record.fieldGoalsAttempted,
      record.points,
      sourceId,
    ],
  );
}

export async function runSync(options: SyncOptions): Promise<SyncResult> {
  const { provider, pool, seasons } = options;
  const seasonType = options.seasonType ?? "regular";
  const progress = options.onProgress ?? (() => {});

  const result: SyncResult = {
    status: "succeeded",
    recordsRead: 0,
    recordsWritten: 0,
    playersCreated: 0,
    playersUpdated: 0,
    statsWritten: 0,
    skipped: [],
    errorMessage: null,
  };

  const skipCounts = new Map<string, number>();
  const skip = (reason: string) => skipCounts.set(reason, (skipCounts.get(reason) ?? 0) + 1);

  // 許諾が無いまま保存しない。registry でも見ているが、
  // 書き込む直前でもう一度確かめる。ここが最後の砦。
  if (!provider.persistenceAllowed) {
    throw new Error(
      "このプロバイダのデータを保存する許諾が確認できていません。取り込みを中止します。",
    );
  }

  const client = await pool.connect();
  let runId: string | null = null;

  try {
    const sourceId = await ensureSourceId(client, provider.id);

    // 実行の記録を先に作る。途中で落ちても「走ったが失敗した」と分かる。
    const { rows: runRows } = await client.query<{ id: string }>(
      `insert into public.sync_runs
         (source_id, status, target_season_from, target_season_to, records_read, records_written)
       values ($1, 'running', $2, $3, 0, 0)
       returning id`,
      [sourceId, seasons[0] ?? null, seasons[seasons.length - 1] ?? null],
    );
    runId = runRows[0]!.id;

    // ここから先は1つのトランザクション。
    // 途中で失敗したら何も入らない状態に戻す。
    // 「半分だけ入ったDB」を相手に原因を探すのが一番つらい。
    await client.query("begin");

    progress("選手を取得しています…");
    const players = await provider.fetchPlayers();
    result.recordsRead += players.length;

    const playerIdByExternal = new Map<string, string>();
    for (const record of players) {
      if (!record.fullNameEn.trim()) {
        // 名前が無い行は入れない。空の名前の選手ページができてしまう。
        skip("名前が空");
        continue;
      }
      const { internalId, created } = await upsertPlayer(client, sourceId, record);
      playerIdByExternal.set(record.externalId, internalId);
      if (created) result.playersCreated += 1;
      else result.playersUpdated += 1;
      result.recordsWritten += 1;
    }
    progress(`選手 ${players.length} 件（新規 ${result.playersCreated}）`);

    for (const seasonId of seasons) {
      progress(`${seasonId} の成績を取得しています…`);
      const stats = await provider.fetchSeasonStats({ seasonId, seasonType });
      result.recordsRead += stats.length;

      for (const record of stats) {
        const playerInternalId = playerIdByExternal.get(record.playerExternalId);
        if (!playerInternalId) {
          // 選手一覧に無い選手の成績。取り込む先が無いので飛ばす。
          // 勝手に選手を作ると、名前も分からない空の選手ページができる。
          skip("対応する選手が見つからない");
          continue;
        }
        await upsertSeasonStat(client, sourceId, playerInternalId, record);
        result.statsWritten += 1;
        result.recordsWritten += 1;
      }
      progress(`${seasonId}: ${stats.length} 件`);
    }

    result.skipped = [...skipCounts.entries()].map(([reason, count]) => ({ reason, count }));

    if (options.dryRun) {
      // 何が起きるかだけ見て、書き込みは取り消す。
      await client.query("rollback");
      progress("dry-run のため、書き込みは取り消しました。");
    } else {
      await client.query("commit");
    }

    await client.query(
      `update public.sync_runs
          set status = 'succeeded', finished_at = now(),
              records_read = $2, records_written = $3
        where id = $1`,
      [runId, result.recordsRead, options.dryRun ? 0 : result.recordsWritten],
    );

    return result;
  } catch (error) {
    await client.query("rollback").catch(() => {});
    const message = error instanceof Error ? error.message : String(error);

    if (runId) {
      // 失敗の記録は残す。何も残らないと「走ったのか」すら分からない。
      await client
        .query(
          `update public.sync_runs
              set status = 'failed', finished_at = now(), error_message = $2
            where id = $1`,
          [runId, message.slice(0, 2000)],
        )
        .catch(() => {});
    }

    return {
      ...result,
      status: "failed",
      skipped: [...skipCounts.entries()].map(([reason, count]) => ({ reason, count })),
      errorMessage: message,
    };
  } finally {
    client.release();
  }
}
