#!/usr/bin/env node
/**
 * データベースの構造から TypeScript の型を生成する（W1-8）。
 *
 *   SUPABASE_DB_URL="postgres://..." node scripts/gen-db-types.mjs
 *   SUPABASE_DB_URL="postgres://..." node scripts/gen-db-types.mjs --check
 *
 * --check は書き込まずに、生成結果と現在のファイルを比べるだけ。
 * CI で使い、スキーマを変えたのに型を作り直し忘れた状態を検出する。
 *
 * ■ なぜ Supabase CLI を使わないか
 * `supabase gen types` は内部で Docker を起動する。この開発環境に Docker の
 * デーモンが無く、手元で型を作り直せない。手元で回せない道具は結局使われなくなる。
 * information_schema を読むだけなら依存なしで同じことができるので自前で持つ。
 * 出力の形は Supabase CLI に寄せてあるので、必要になれば差し替えられる。
 */

import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import pg from "pg";

const OUT_PATH = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "src",
  "db",
  "types.generated.ts",
);

const checkOnly = process.argv.includes("--check");

/**
 * PostgreSQL の型を TypeScript の型に対応させる。
 * 日付・時刻は文字列で受け取る（JSONを経由するとDate型は保てないため）。
 * numeric は桁落ちを避けるため文字列で来ることがあるが、
 * 本プロジェクトでは小数の精度が問題になる規模ではないので number として扱う。
 */
function toTsType(dataType, udtName, enums) {
  if (udtName.startsWith("_")) {
    // 配列型。要素の型に [] を付ける。
    return `${toTsType(dataType, udtName.slice(1), enums)}[]`;
  }
  if (enums.has(udtName)) return enums.get(udtName).tsName;

  switch (udtName) {
    case "bool":
      return "boolean";
    case "int2":
    case "int4":
    case "int8":
    case "float4":
    case "float8":
    case "numeric":
      return "number";
    case "json":
    case "jsonb":
      return "Json";
    default:
      // text / varchar / uuid / date / timestamptz / time など。
      return "string";
  }
}

/** snake_case を PascalCase にする。型名に使う。 */
function toPascalCase(name) {
  return name
    .split(/[_\s]+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("");
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

  let output;
  try {
    // --- enum ---------------------------------------------------------------
    const { rows: enumRows } = await client.query(`
      select t.typname as name, e.enumlabel as label
      from pg_type t
      join pg_enum e on e.enumtypid = t.oid
      join pg_namespace n on n.oid = t.typnamespace
      where n.nspname = 'public'
      order by t.typname, e.enumsortorder
    `);

    const enums = new Map();
    for (const row of enumRows) {
      if (!enums.has(row.name)) {
        enums.set(row.name, { tsName: toPascalCase(row.name), labels: [] });
      }
      enums.get(row.name).labels.push(row.label);
    }

    // --- テーブルとビューの列 -------------------------------------------------
    const { rows: columns } = await client.query(`
      select
        c.table_name,
        t.table_type,
        c.column_name,
        c.data_type,
        c.udt_name,
        c.is_nullable = 'YES' as is_nullable,
        c.column_default is not null as has_default,
        c.is_identity = 'YES' as is_identity,
        c.ordinal_position
      from information_schema.columns c
      join information_schema.tables t
        on t.table_schema = c.table_schema and t.table_name = c.table_name
      where c.table_schema = 'public'
        and c.table_name <> 'schema_migrations'
      order by t.table_type, c.table_name, c.ordinal_position
    `);

    const tables = new Map();
    for (const col of columns) {
      if (!tables.has(col.table_name)) {
        tables.set(col.table_name, { kind: col.table_type, columns: [] });
      }
      tables.get(col.table_name).columns.push(col);
    }

    // --- 出力 ---------------------------------------------------------------
    const lines = [];
    lines.push("// このファイルは自動生成です。手で編集しないでください。");
    lines.push("//");
    lines.push("// 生成: npm run db:types");
    lines.push("// 元:   supabase/migrations/*.sql を適用したデータベースの構造");
    lines.push("//");
    lines.push("// スキーマを変えたら作り直してください。");
    lines.push("// CI が `npm run db:types:check` で、作り直し忘れを検出します。");
    lines.push("");
    lines.push(
      "export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];",
    );
    lines.push("");

    if (enums.size > 0) {
      lines.push("// ---- enum ----");
      for (const [, def] of [...enums].sort((a, b) => a[0].localeCompare(b[0]))) {
        const union = def.labels.map((l) => `"${l}"`).join(" | ");
        lines.push(`export type ${def.tsName} = ${union};`);
      }
      lines.push("");
    }

    const baseTables = [...tables].filter(([, v]) => v.kind === "BASE TABLE");
    const views = [...tables].filter(([, v]) => v.kind === "VIEW");

    const emitRow = (name, def) => {
      lines.push(`export type ${toPascalCase(name)}Row = {`);
      for (const col of def.columns) {
        const tsType = toTsType(col.data_type, col.udt_name, enums);
        lines.push(`  ${col.column_name}: ${tsType}${col.is_nullable ? " | null" : ""};`);
      }
      lines.push("};");
    };

    lines.push("// ---- テーブル ----");
    for (const [name, def] of baseTables) {
      emitRow(name, def);

      // 挿入用。既定値がある列と NULL 許容の列は省略できる。
      lines.push(`export type ${toPascalCase(name)}Insert = {`);
      for (const col of def.columns) {
        const tsType = toTsType(col.data_type, col.udt_name, enums);
        const optional = col.has_default || col.is_nullable || col.is_identity;
        lines.push(
          `  ${col.column_name}${optional ? "?" : ""}: ${tsType}${col.is_nullable ? " | null" : ""};`,
        );
      }
      lines.push("};");

      // 更新用。すべて省略できる。
      lines.push(`export type ${toPascalCase(name)}Update = Partial<${toPascalCase(name)}Insert>;`);
      lines.push("");
    }

    if (views.length > 0) {
      lines.push("// ---- ビュー（読み取り専用） ----");
      for (const [name, def] of views) {
        emitRow(name, def);
        lines.push("");
      }
    }

    // テーブル名の一覧。文字列の打ち間違いを型で防ぐために使う。
    lines.push("// ---- 名前の一覧 ----");
    lines.push(
      `export type TableName = ${baseTables.map(([n]) => `"${n}"`).join(" | ") || "never"};`,
    );
    lines.push(`export type ViewName = ${views.map(([n]) => `"${n}"`).join(" | ") || "never"};`);
    lines.push("");

    output = lines.join("\n");
  } finally {
    await client.end();
  }

  if (checkOnly) {
    let current = "";
    try {
      current = await readFile(OUT_PATH, "utf8");
    } catch {
      console.error(`✗ ${path.relative(process.cwd(), OUT_PATH)} がありません。`);
      console.error("  `npm run db:types` を実行してコミットしてください。");
      process.exit(1);
    }
    if (current.trim() !== output.trim()) {
      console.error("✗ 生成される型と、コミットされている型が食い違っています。");
      console.error("  スキーマを変えたあと `npm run db:types` を忘れていませんか。");
      console.error("  実行して、生成されたファイルをコミットしてください。");
      process.exit(1);
    }
    console.log("✓ 型はデータベースの構造と一致しています。");
    return;
  }

  await writeFile(OUT_PATH, `${output}\n`, "utf8");
  console.log(`✓ ${path.relative(process.cwd(), OUT_PATH)} を生成しました。`);
}

main().catch((error) => {
  console.error(`\n✗ ${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
