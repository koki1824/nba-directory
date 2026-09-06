#!/usr/bin/env node
/**
 * APIの応答の形を確かめる（W4-1 の前提作業）。
 *
 *   BALLDONTLIE_API_KEY="..." node scripts/probe-api.mjs
 *
 * 【なぜこれが要るか】
 * 開発した環境から外部APIへ接続できないため、
 * `src/providers/balldontlie.ts` の読み取りは**公開情報からの想定**で書いています。
 * 想定が外れたまま本番のデータを作ると、誤った数字がサイトに載ります。
 *
 * このスクリプトは**1ページだけ**取得して、
 *   ・どのキーが返ってきたか
 *   ・こちらが必要としているキーが揃っているか
 *   ・契約プランでそのエンドポイントを使えるか
 * を表示します。実物に合わせて読み取りを直すための材料です。
 *
 * 【安全のための制限】
 * ・取得するのは各エンドポイント1ページだけ（レート制限を使い切らないため）
 * ・DBには一切書き込みません
 * ・APIキーは表示しません
 */

const BASE_URL = "https://api.balldontlie.io/v1";

/** 読み取りに必要としているキー。src/providers/balldontlie.ts と揃えること。 */
const EXPECTED = {
  "/players": {
    required: ["id", "first_name", "last_name"],
    optional: ["height_feet", "height_inches", "weight_pounds", "birthdate", "team"],
  },
  "/season_averages": {
    required: ["player_id"],
    optional: ["games_played", "min", "fgm", "fga", "pts"],
  },
  "/teams": {
    required: ["id", "name"],
    optional: ["abbreviation", "city", "conference", "division", "full_name"],
  },
};

async function probe(path, query = {}) {
  const apiKey = process.env.BALLDONTLIE_API_KEY?.trim();
  const url = new URL(`${BASE_URL}${path}`);
  url.searchParams.set("per_page", "5");
  for (const [k, v] of Object.entries(query)) url.searchParams.set(k, String(v));

  console.log(`\n── ${path} ${Object.keys(query).length > 0 ? JSON.stringify(query) : ""}`);

  let response;
  try {
    response = await fetch(url.toString(), {
      headers: { Authorization: apiKey, Accept: "application/json" },
    });
  } catch (error) {
    console.log(`  ✗ 接続できませんでした: ${error.message}`);
    console.log("    このスクリプトは外部に接続できる環境で実行してください。");
    return { ok: false };
  }

  if (!response.ok) {
    console.log(`  ✗ HTTP ${response.status}`);
    if (response.status === 401 || response.status === 403) {
      console.log("    APIキーが受け付けられませんでした。");
      console.log(
        "    キーが正しいか、契約プランでこのエンドポイントを使えるかを確認してください。",
      );
    }
    return { ok: false, status: response.status };
  }

  let payload;
  try {
    payload = await response.json();
  } catch {
    console.log("  ✗ JSONとして読み取れませんでした。");
    return { ok: false };
  }

  const rows = Array.isArray(payload?.data) ? payload.data : null;
  if (!rows) {
    console.log(
      `  ✗ "data" が配列ではありません。返ってきたキー: ${Object.keys(payload ?? {}).join(", ")}`,
    );
    return { ok: false };
  }

  console.log(`  ✓ HTTP 200 / ${rows.length} 件`);
  console.log(`    meta: ${JSON.stringify(payload.meta ?? {})}`);

  if (rows.length === 0) {
    console.log("    ⚠ 中身が空です。キーの権限か、指定した条件を確認してください。");
    return { ok: true, empty: true };
  }

  const actualKeys = Object.keys(rows[0]);
  console.log(`    返ってきたキー: ${actualKeys.join(", ")}`);

  const expected = EXPECTED[path];
  if (expected) {
    const missingRequired = expected.required.filter((k) => !(k in rows[0]));
    const missingOptional = expected.optional.filter((k) => !(k in rows[0]));

    if (missingRequired.length > 0) {
      console.log(`    ✗ 必要なキーがありません: ${missingRequired.join(", ")}`);
      console.log("      → src/providers/balldontlie.ts の読み取りを直してください。");
    } else {
      console.log("    ✓ 必要なキーは揃っています");
    }
    if (missingOptional.length > 0) {
      console.log(`    ・任意のキーのうち無いもの: ${missingOptional.join(", ")}`);
    }
  }

  // 1件目の中身を見せる。型の食い違い（数値のつもりが文字列など）に気づくため。
  console.log("    1件目:");
  console.log(
    JSON.stringify(rows[0], null, 2)
      .split("\n")
      .map((line) => `      ${line}`)
      .join("\n"),
  );

  return { ok: true };
}

async function main() {
  const apiKey = process.env.BALLDONTLIE_API_KEY?.trim();
  if (!apiKey) {
    console.error("✗ BALLDONTLIE_API_KEY が設定されていません。");
    console.error('  BALLDONTLIE_API_KEY="..." node scripts/probe-api.mjs');
    process.exit(1);
  }

  console.log("APIの応答の形を確認します（各エンドポイント1ページのみ・DBには書き込みません）");

  const results = [];
  results.push(await probe("/teams"));
  results.push(await probe("/players"));
  // 成績は有料プランでしか取れないことがある。ここで分かる。
  results.push(await probe("/season_averages", { season: 2024 }));

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length} / ${results.length} 件のエンドポイントに到達`);

  if (failed.length > 0) {
    console.log("\n到達できなかったものがあります。");
    console.log("契約プランで使えないエンドポイントの可能性があります。");
    console.log("その場合、取れる範囲で何を出すかを決め直す必要があります（お金の話になります）。");
  } else {
    console.log("\n次にすること: 上の「返ってきたキー」を見て、");
    console.log("src/providers/balldontlie.ts の読み取りが合っているか確かめてください。");
  }
}

main().catch((error) => {
  console.error(`✗ ${error.message}`);
  process.exit(1);
});
