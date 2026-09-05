#!/usr/bin/env node
/**
 * マイグレーション適用ツール。
 *
 * supabase/migrations/*.sql をファイル名順に見て、まだ適用していないものだけを流す。
 * 適用済みかどうかは、DB内の schema_migrations テーブルで判断する。
 *
 * 使い方:
 *   SUPABASE_DB_URL="postgres://..." node scripts/migrate.mjs
 *   SUPABASE_DB_URL="postgres://..." node scripts/migrate.mjs --dry-run
 *
 * 設計の理由:
 * - **1ファイル = 1トランザクション。** 途中で失敗したらそのファイルの変更は丸ごと戻る。
 *   中途半端に適用された状態を作らないため（オーナーがDBを手で直せないので、
 *   「半分だけ適用された」が最悪の状態になる）。
 * - **ファイルの中身のハッシュを記録する。** 適用済みファイルを後から書き換えると
 *   検知して止まる。手元とDBで中身が食い違ったまま進むのを防ぐ。
 * - **接続文字列は絶対に出力しない。** ログに残るとGitHubのActionsログから漏れる。
 */

import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import pg from "pg";

const MIGRATIONS_DIR = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "supabase",
  "migrations",
);

const dryRun = process.argv.includes("--dry-run");

/** 適用履歴を持つテーブル。無ければ作る。 */
const CREATE_HISTORY_TABLE = `
  create table if not exists public.schema_migrations (
    version     text        primary key,
    checksum    text        not null,
    applied_at  timestamptz not null default now()
  );
`;

function fail(message) {
  console.error(`\n✗ ${message}\n`);
  process.exit(1);
}

async function loadMigrationFiles() {
  let entries;
  try {
    entries = await readdir(MIGRATIONS_DIR);
  } catch {
    fail(`マイグレーションのディレクトリが見つかりません: ${MIGRATIONS_DIR}`);
  }

  const files = entries.filter((name) => name.endsWith(".sql")).sort();

  return Promise.all(
    files.map(async (name) => {
      const sql = await readFile(path.join(MIGRATIONS_DIR, name), "utf8");
      return {
        version: name,
        sql,
        checksum: createHash("sha256").update(sql).digest("hex"),
      };
    }),
  );
}

async function main() {
  const connectionString = process.env.SUPABASE_DB_URL?.trim();
  if (!connectionString) {
    fail(
      "環境変数 SUPABASE_DB_URL が設定されていません。\n" +
        "  GitHub Actions の場合: リポジトリの Settings > Secrets に SUPABASE_DB_URL を登録してください。\n" +
        "  手元で試す場合    : SUPABASE_DB_URL='postgres://...' node scripts/migrate.mjs",
    );
  }

  const migrations = await loadMigrationFiles();
  if (migrations.length === 0) {
    console.log("適用対象のマイグレーションはありません。");
    return;
  }

  const client = new pg.Client({
    connectionString,
    // Supabase は TLS 必須。自己署名の中間証明書を使うことがあるため検証は緩める。
    // 接続先は自分のDBであり、URLに認証情報が入っている前提。
    ssl: connectionString.includes("localhost") ? false : { rejectUnauthorized: false },
  });

  await client.connect();

  try {
    await client.query(CREATE_HISTORY_TABLE);

    const { rows } = await client.query("select version, checksum from public.schema_migrations");
    const applied = new Map(rows.map((row) => [row.version, row.checksum]));

    // 適用済みファイルが書き換えられていないか先に全部確認する。
    // 1件でも食い違ったら、何も流さずに止める。
    for (const migration of migrations) {
      const previous = applied.get(migration.version);
      if (previous !== undefined && previous !== migration.checksum) {
        fail(
          `適用済みのマイグレーションが書き換えられています: ${migration.version}\n` +
            "  適用済みのファイルは編集しないでください。変更は新しいファイルとして追加します。\n" +
            "  （DBは既に古い内容で適用されており、ファイルを直しても反映されないため）",
        );
      }
    }

    const pending = migrations.filter((m) => !applied.has(m.version));

    if (pending.length === 0) {
      console.log(`適用済み ${applied.size} 件。新しいマイグレーションはありません。`);
      return;
    }

    console.log(`未適用 ${pending.length} 件:`);
    for (const migration of pending) console.log(`  - ${migration.version}`);

    if (dryRun) {
      console.log("\n--dry-run のため実行しません。");
      return;
    }

    for (const migration of pending) {
      process.stdout.write(`適用中 ${migration.version} ... `);
      // 1ファイルを1トランザクションで流す。途中で落ちたら丸ごと巻き戻す。
      await client.query("begin");
      try {
        await client.query(migration.sql);
        await client.query(
          "insert into public.schema_migrations (version, checksum) values ($1, $2)",
          [migration.version, migration.checksum],
        );
        await client.query("commit");
        console.log("完了");
      } catch (error) {
        await client.query("rollback");
        console.log("失敗（このファイルの変更は巻き戻しました）");
        throw error;
      }
    }

    console.log(`\n✓ ${pending.length} 件を適用しました。`);
  } finally {
    await client.end();
  }
}

/** 接続できないときは、原因として多いものを案内する。 */
function connectionHint(message) {
  const looksLikeNetwork =
    /ENOTFOUND|ECONNREFUSED|ETIMEDOUT|EHOSTUNREACH|ENETUNREACH|Connection terminated/i.test(
      message,
    );
  if (!looksLikeNetwork) return "";

  return (
    "\n\n  DBに接続できていません。よくある原因:\n" +
    "  1. Supabase の Direct connection の文字列を使っている\n" +
    "     → Direct connection は IPv6 のみ。GitHub Actions は IPv4 なので繋がりません。\n" +
    "       ダッシュボード上部の Connect から「Session pooler」の文字列に差し替えてください。\n" +
    "  2. Supabase のプロジェクトが一時停止している\n" +
    "     → ダッシュボードで Restore / Resume を押してください。\n" +
    "  3. 接続文字列の [YOUR-PASSWORD] を実際のパスワードに置き換えていない"
  );
}

main().catch((error) => {
  // 接続文字列が混ざらないよう、エラーメッセージだけを出す。
  const message = error instanceof Error ? error.message : String(error);
  fail(message + connectionHint(message));
});
