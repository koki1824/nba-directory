/**
 * 実データの取り込み（W4-2）。
 *
 *   BALLDONTLIE_API_KEY="..." DATABASE_URL="..." npm run sync -- --seasons 2024-25
 *
 *   --dry-run  … 何が起きるかだけ表示し、書き込まない
 *   --seasons  … 取り込むシーズン（カンマ区切り）
 *
 * 【この環境からは動きません】
 * 外部APIへ接続できないため、実行は GitHub Actions の「実データの取り込み」から行います。
 * 手元で確かめられるのは、記録した応答を使った単体テストと、
 * DBへの書き込み方（src/sync/run.db.test.ts）までです。
 *
 * 【TypeScript のまま実行する理由】
 * 取り込みの処理は画面と同じ型を使う。JavaScriptへ書き写すと、
 * 型が変わったときに気づけない写し間違いが生まれる。
 * tsx で実行して、変換の工程を挟まない。
 */

import { Pool } from "pg";

import { BalldontlieProvider } from "@/providers/balldontlie";
import { parseConsent } from "@/providers/registry";
import { runSync } from "@/sync/run";

function parseArgs(argv: string[]) {
  const seasonsIndex = argv.indexOf("--seasons");
  const seasons =
    seasonsIndex >= 0 && argv[seasonsIndex + 1]
      ? argv[seasonsIndex + 1]!.split(",")
          .map((s) => s.trim())
          .filter(Boolean)
      : [];

  return { seasons, dryRun: argv.includes("--dry-run") };
}

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    console.error(`✗ ${name} が設定されていません。`);
    process.exit(1);
  }
  return value;
}

async function main() {
  const { seasons, dryRun } = parseArgs(process.argv.slice(2));

  if (seasons.length === 0) {
    console.error("✗ --seasons を指定してください（例: --seasons 2024-25,2023-24）。");
    console.error("  対象を明示させるのは、意図せず全期間を取りに行かないためです。");
    process.exit(1);
  }

  const apiKey = requireEnv("BALLDONTLIE_API_KEY");
  const databaseUrl = requireEnv("DATABASE_URL");

  // 許諾は環境変数で明示させる。既定では保存しない。
  const persistenceAllowed = parseConsent(process.env.PROVIDER_PERSISTENCE_ALLOWED);
  if (!persistenceAllowed) {
    console.error("✗ PROVIDER_PERSISTENCE_ALLOWED=true が設定されていません。");
    console.error("  外部から取得したデータを保存してよいかを、明示的に指定してください。");
    console.error("  契約条件の確認が済んでいない場合は実行しないでください。");
    process.exit(1);
  }

  console.log(`取り込み対象: ${seasons.join(", ")}${dryRun ? "（dry-run）" : ""}`);

  const provider = new BalldontlieProvider({ apiKey, persistenceAllowed: true });
  const pool = new Pool({
    connectionString: databaseUrl,
    ssl: databaseUrl.includes("localhost") ? false : { rejectUnauthorized: false },
    max: 2,
  });

  try {
    const result = await runSync({
      provider,
      pool,
      seasons,
      dryRun,
      onProgress: (message) => console.log(`  ${message}`),
    });

    console.log("");
    console.log(`状態: ${result.status === "succeeded" ? "成功" : "失敗"}`);
    console.log(`  読み込み: ${result.recordsRead} 件`);
    console.log(`  書き込み: ${result.recordsWritten} 件`);
    console.log(`  選手: 新規 ${result.playersCreated} / 更新 ${result.playersUpdated}`);
    console.log(`  成績: ${result.statsWritten} 件`);
    console.log(`  APIへのリクエスト: ${provider.requestCount} 回`);

    if (result.skipped.length > 0) {
      console.log("  取り込まなかったもの:");
      for (const s of result.skipped) console.log(`    ${s.reason}: ${s.count} 件`);
    }

    if (result.status === "failed") {
      console.error(`\n✗ ${result.errorMessage}`);
      console.error("何も書き込まれていません（途中で失敗した場合は元に戻します）。");
      process.exit(1);
    }

    console.log("\n✓ 取り込みが完了しました。");
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(`✗ ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
