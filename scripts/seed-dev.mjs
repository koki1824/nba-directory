#!/usr/bin/env node
/**
 * 開発用 seed データの投入（W2-1）。
 *
 *   SUPABASE_DB_URL="postgres://..." node scripts/seed-dev.mjs
 *
 * ⚠️ **本番には入れません。** 中身は架空の選手・チームです（docs/DECISIONS.md §12）。
 * 手元での開発と、CIでの検証に使います。
 *
 * psql を使わず Node から流すのは、手元とCIで同じ経路にするため。
 * 「手元では動くのにCIで落ちる」の原因を1つ減らせる。
 *
 * ファイル全体を1つのトランザクションで流す。
 * 途中で失敗したら何も入らない状態に戻るので、
 * 「半分だけ入ったDB」を相手に悩まずに済む。
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import pg from "pg";

const here = dirname(fileURLToPath(import.meta.url));
const SEED = join(here, "..", "supabase", "seed", "dev_seed.sql");

async function main() {
  const connectionString = process.env.SUPABASE_DB_URL?.trim();
  if (!connectionString) {
    console.error("✗ SUPABASE_DB_URL が設定されていません。");
    process.exit(1);
  }

  let sql;
  try {
    sql = readFileSync(SEED, "utf8");
  } catch {
    console.error("✗ supabase/seed/dev_seed.sql がありません。");
    console.error("  node scripts/gen-dev-seed.mjs で作れます。");
    process.exit(1);
  }

  const client = new pg.Client({
    connectionString,
    ssl: connectionString.includes("localhost") ? false : { rejectUnauthorized: false },
  });
  await client.connect();

  try {
    await client.query("begin");
    await client.query(sql);
    await client.query("commit");
  } catch (error) {
    await client.query("rollback").catch(() => {});
    throw error;
  } finally {
    await client.end();
  }

  console.log("✓ 開発用 seed を投入しました（架空の選手・チーム）。");
}

main().catch((error) => {
  console.error(`✗ ${error.message}`);
  process.exit(1);
});
