#!/usr/bin/env node
/**
 * スキーマの検証。マイグレーション適用後に走らせる。
 *
 *   SUPABASE_DB_URL="postgres://..." node scripts/verify-schema.mjs
 *
 * 目的は「制約を書いた」ではなく「制約が効いている」ことを毎回確かめること。
 * 書いただけで効いていない制約は、無いのと同じで、しかも有ると勘違いする分たちが悪い。
 *
 * 実際に不正なデータを入れてみて、弾かれることを確認する。
 * 検証用のデータは最後にすべて巻き戻すので、DBには何も残らない。
 */

import pg from "pg";

const EXPECTED_TABLES = [
  "awards",
  "data_sources",
  "favorites",
  "franchises",
  "image_licenses",
  "inquiries",
  "manual_overrides",
  "metric_definitions",
  "page_seo",
  "player_awards",
  "player_images",
  "player_season_stats",
  "players",
  "provider_entity_ids",
  "ranking_rules",
  "ranking_snapshots",
  "seasons",
  "stints",
  "sync_runs",
  "team_season_stats",
  "teams",
];

const results = [];

function check(name, ok, detail = "") {
  results.push({ name, ok, detail });
  console.log(`${ok ? "  ✓" : "  ✗"} ${name}${detail ? ` — ${detail}` : ""}`);
}

/** 不正なデータが「弾かれること」を確認する。通ってしまったら失敗。 */
async function expectRejected(client, name, sql, expectedConstraint) {
  await client.query("savepoint probe");
  try {
    await client.query(sql);
    await client.query("rollback to savepoint probe");
    check(name, false, "弾かれるべきデータが通ってしまった");
  } catch (error) {
    await client.query("rollback to savepoint probe");
    const message = error instanceof Error ? error.message : String(error);
    const matched = expectedConstraint === undefined || message.includes(expectedConstraint);
    check(name, matched, matched ? "" : `別の理由で失敗: ${message}`);
  }
}

/** 正しいデータが通ることを確認する。弾かれたら失敗。 */
async function expectAccepted(client, name, sql) {
  await client.query("savepoint probe");
  try {
    await client.query(sql);
    await client.query("release savepoint probe");
    check(name, true);
  } catch (error) {
    await client.query("rollback to savepoint probe");
    check(name, false, error instanceof Error ? error.message : String(error));
  }
}

async function main() {
  const connectionString = process.env.SUPABASE_DB_URL?.trim();
  if (!connectionString) {
    console.error("✗ SUPABASE_DB_URL が設定されていません。");
    process.exit(1);
  }

  const client = new pg.Client({
    connectionString,
    ssl: connectionString.includes("localhost") ? false : { rejectUnauthorized: false },
  });
  await client.connect();

  try {
    console.log("テーブルの構成");
    const { rows: tables } = await client.query(
      `select table_name from information_schema.tables
       where table_schema = 'public' and table_type = 'BASE TABLE'
         and table_name <> 'schema_migrations'
       order by table_name`,
    );
    const actual = tables.map((r) => r.table_name);
    const missing = EXPECTED_TABLES.filter((t) => !actual.includes(t));
    const extra = actual.filter((t) => !EXPECTED_TABLES.includes(t));
    check(`21テーブルが揃っている（実際 ${actual.length} 件）`, actual.length === 21);
    check("不足しているテーブルが無い", missing.length === 0, missing.join(", "));
    check("想定外のテーブルが無い", extra.length === 0, extra.join(", "));

    console.log("\n行レベルセキュリティ");
    const { rows: noRls } = await client.query(
      `select tablename from pg_tables
       where schemaname = 'public' and not rowsecurity and tablename <> 'schema_migrations'`,
    );
    check("全テーブルでRLSが有効", noRls.length === 0, noRls.map((r) => r.tablename).join(", "));

    const { rows: noPolicy } = await client.query(
      `select tablename from pg_tables t
       where schemaname = 'public' and tablename in ('manual_overrides','sync_runs','provider_entity_ids','inquiries')
         and exists (select 1 from pg_policies p where p.schemaname='public' and p.tablename=t.tablename)`,
    );
    check(
      "運用系テーブルに公開ポリシーが無い（匿名から読めない）",
      noPolicy.length === 0,
      noPolicy.map((r) => r.tablename).join(", "),
    );

    console.log("\n基礎データ（W1-7）");
    const { rows: po } = await client.query(
      `select count(*)::int as n from ranking_rules
       where season_type = 'playoff'
         and (minimum_games is not null or minimum_minutes is not null or minimum_per_game is not null)`,
    );
    check(
      "プレーオフのランキングに最低条件が設定されていない（DECISIONS §4）",
      po[0]?.n === 0,
      `条件付きの行が ${po[0]?.n} 件`,
    );

    const { rows: tov } = await client.query(
      `select higher_is_better from metric_definitions where code = 'tov_per_game'`,
    );
    check("ターンオーバーは「少ない方が良い」になっている", tov[0]?.higher_is_better === false);

    const { rows: lic } = await client.query(
      `select count(*)::int as n from image_licenses
       where is_allowed and code in ('CC-BY-NC','CC-BY-ND','UNKNOWN')`,
    );
    check("非商用・改変不可・不明のライセンスは許可されていない", lic[0]?.n === 0);

    const { rows: src } = await client.query(
      `select count(*)::int as n from data_sources where code in ('seed','manual','balldontlie')`,
    );
    check("データ出典が3件登録されている", src[0]?.n === 3);

    console.log("\n制約が実際に効くか（不正データを入れてみる）");
    // 検証は1つのトランザクションで行い、最後に必ず巻き戻す。
    await client.query("begin");

    await client.query(`
      insert into seasons (id, start_year, end_year, regular_season_start_date, scheduled_games)
      values ('9999-00', 9999, 10000, '9999-10-22', 82);
      insert into franchises (id, slug) values ('11111111-1111-1111-1111-111111111111','verify-fr');
      insert into teams (id, franchise_id, name_en, abbreviation)
      values ('22222222-2222-2222-2222-222222222222','11111111-1111-1111-1111-111111111111','Verify','VER');
      insert into players (id, slug, full_name_en)
      values ('33333333-3333-3333-3333-333333333333','verify-player','Verify Player');
      insert into stints (id, player_id, season_id, team_id, stint_order)
      values ('44444444-4444-4444-4444-444444444444','33333333-3333-3333-3333-333333333333','9999-00','22222222-2222-2222-2222-222222222222',1);
    `);

    await expectRejected(
      client,
      "成功数が試投数を超えるデータは弾かれる",
      `insert into player_season_stats (player_id, season_id, season_type, field_goals_made, field_goals_attempted)
       values ('33333333-3333-3333-3333-333333333333','9999-00','regular', 10, 5)`,
      "pss_made_not_over_attempted",
    );

    await expectRejected(
      client,
      "先発数が出場数を超えるデータは弾かれる",
      `insert into player_season_stats (player_id, season_id, season_type, games_played, games_started)
       values ('33333333-3333-3333-3333-333333333333','9999-00','playoff', 5, 10)`,
      "pss_started_not_over_played",
    );

    await expectRejected(
      client,
      "勝敗数の合計が試合数と合わないデータは弾かれる",
      `insert into team_season_stats (team_id, season_id, season_type, games_played, wins, losses)
       values ('22222222-2222-2222-2222-222222222222','9999-00','regular', 82, 50, 40)`,
      "tss_record_matches_games",
    );

    await expectRejected(
      client,
      "カラーコードの形式が不正なら弾かれる",
      `insert into teams (franchise_id, name_en, abbreviation, primary_color)
       values ('11111111-1111-1111-1111-111111111111','X','XXX','notacolor')`,
      "teams_color_is_hex",
    );

    await expectRejected(
      client,
      "身長が非現実的な値なら弾かれる",
      `insert into players (slug, full_name_en, height_cm) values ('verify-tall','Tall', 400)`,
      "players_height_sane",
    );

    await expectRejected(
      client,
      "お気に入りが選手とチームの両方を指したら弾かれる",
      `insert into favorites (user_id, player_id, team_id)
       values ('55555555-5555-5555-5555-555555555555','33333333-3333-3333-3333-333333333333','22222222-2222-2222-2222-222222222222')`,
      "favorites_subject",
    );

    await expectAccepted(
      client,
      "正しいシーズン合計行は通る",
      `insert into player_season_stats (player_id, season_id, season_type, points)
       values ('33333333-3333-3333-3333-333333333333','9999-00','regular', 100)`,
    );

    await expectRejected(
      client,
      "同じシーズン合計行を二重に入れると弾かれる",
      `insert into player_season_stats (player_id, season_id, season_type, points)
       values ('33333333-3333-3333-3333-333333333333','9999-00','regular', 200)`,
      "pss_season_total_unique",
    );

    await expectAccepted(
      client,
      "同じシーズンでもstint別の行は通る（途中移籍を表現できる）",
      `insert into player_season_stats (player_id, season_id, season_type, stint_id, points)
       values ('33333333-3333-3333-3333-333333333333','9999-00','regular','44444444-4444-4444-4444-444444444444', 40)`,
    );

    console.log("\n自動更新のトリガ");
    // 同一トランザクション内では now() が同じ値を返すため、
    // 「created_at より後になったか」では判定できない。
    // 代わりに updated_at へ意図的に古い値を入れ、トリガが上書きするかを見る。
    await client.query(
      `update players set updated_at = timestamptz '2000-01-01'
       where id = '33333333-3333-3333-3333-333333333333'`,
    );
    const { rows: touched } = await client.query(
      `select updated_at > timestamptz '2020-01-01' as ok
       from players where id = '33333333-3333-3333-3333-333333333333'`,
    );
    check("更新するとupdated_atがトリガで上書きされる", touched[0]?.ok === true);

    // 検証用のデータは残さない。
    await client.query("rollback");

    const { rows: leftover } = await client.query(
      `select count(*)::int as n from players where slug = 'verify-player'`,
    );
    check("検証用データがDBに残っていない", leftover[0]?.n === 0);
  } finally {
    await client.end();
  }

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length} / ${results.length} 件成功`);
  if (failed.length > 0) {
    console.error(`\n✗ ${failed.length} 件失敗しました。`);
    process.exit(1);
  }
  console.log("✓ スキーマの検証をすべて通過しました。");
}

main().catch((error) => {
  console.error(`\n✗ ${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
