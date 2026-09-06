#!/usr/bin/env node
/**
 * ビューの検証。マイグレーション適用後に走らせる。
 *
 *   SUPABASE_DB_URL="postgres://..." node scripts/verify-views.mjs
 *
 * ビューは「画面に出る数値そのもの」を作る。間違えるとサイトが嘘をつくので、
 * 答えが分かっているデータを入れて、期待値と一致するかを確かめる。
 *
 * 特に重要な3つ:
 *   1. キャリアの率が「シーズン率の平均」になっていないこと
 *   2. 分母が0のとき 0 ではなく NULL（算出不可）になること
 *   3. 手動修正が効き、「意図的に空にした」も表現できること
 *
 * 検証データはトランザクションごと巻き戻すので、DBには何も残らない。
 */

import pg from "pg";

const results = [];

function check(name, ok, detail = "") {
  results.push({ name, ok });
  console.log(`${ok ? "  ✓" : "  ✗"} ${name}${detail ? ` — ${detail}` : ""}`);
}

/** 小数の比較。浮動小数の誤差を許容する。 */
function closeTo(actual, expected, tolerance = 1e-6) {
  if (actual === null || actual === undefined) return false;
  return Math.abs(Number(actual) - expected) < tolerance;
}

const P = "aaaaaaaa-0000-0000-0000-000000000001"; // キャリア率の検証用
const P_ZERO = "aaaaaaaa-0000-0000-0000-000000000002"; // 分母0の検証用
const P_OV = "aaaaaaaa-0000-0000-0000-000000000003"; // 手動修正の検証用
const P_QUAL = "aaaaaaaa-0000-0000-0000-000000000004"; // 規定到達の検証用
const TEAM = "bbbbbbbb-0000-0000-0000-000000000001";
const FR = "cccccccc-0000-0000-0000-000000000001";

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
    await client.query("begin");

    // --- 検証用データ ---------------------------------------------------------
    await client.query(`
      insert into seasons (id, start_year, end_year, regular_season_start_date, scheduled_games)
      values ('9001-02', 9001, 9002, '9001-10-20', 82),
             ('9002-03', 9002, 9003, '9002-10-20', 82);
      insert into franchises (id, slug) values ('${FR}', 'view-verify');
      insert into teams (id, franchise_id, name_en, abbreviation)
      values ('${TEAM}', '${FR}', 'Verify Team', 'VFY');
      insert into players (id, slug, full_name_en, birth_date)
      values ('${P}', 'career-player', 'Career Player', '8980-10-20'),
             ('${P_ZERO}', 'zero-player', 'Zero Player', '8985-01-01'),
             ('${P_OV}', 'override-player', 'Override Player', '8990-01-01');
      insert into metric_definitions (code, name_ja, name_en, higher_is_better, is_rate)
      values ('pts_per_game', '平均得点', 'PPG', true, false),
             ('fg_pct', 'FG成功率', 'FG%', true, true);
    `);

    // 選手A: 1年目 1/1 (100%)、2年目 40/100 (40%)
    // シーズン率の平均 = 70% ← これは誤り
    // 正しい通算       = 41/101 = 40.594...%
    await client.query(`
      insert into player_season_stats
        (player_id, season_id, season_type, games_played, minutes,
         field_goals_made, field_goals_attempted, points)
      values ('${P}', '9001-02', 'regular', 1, 10, 1, 1, 2),
             ('${P}', '9002-03', 'regular', 50, 1000, 40, 100, 100);
    `);

    // 選手B: 1本も打っていない。FG% は 0% ではなく算出不可。
    // 出場時間も0なので36分換算も算出不可。得点0は「実際に0」なので 0 のまま。
    await client.query(`
      insert into player_season_stats
        (player_id, season_id, season_type, games_played, minutes,
         field_goals_made, field_goals_attempted, points)
      values ('${P_ZERO}', '9001-02', 'regular', 5, 0, 0, 0, 0);
    `);

    // --- 1. キャリアの率 ------------------------------------------------------
    console.log("キャリア集計（最重要）");
    const { rows: career } = await client.query(
      `select field_goal_pct, field_goals_made, field_goals_attempted, points, games_played
       from player_career_stats where player_id = '${P}' and season_type = 'regular'`,
    );
    const c = career[0];
    check(
      "通算FG% が 41/101 = 40.594% になる（シーズン率の平均 70% ではない）",
      closeTo(c?.field_goal_pct, 41 / 101, 1e-9),
      `実際 ${c?.field_goal_pct}`,
    );
    check(
      "シーズン率の単純平均(0.70)になっていない",
      !closeTo(c?.field_goal_pct, 0.7, 1e-3),
      `実際 ${c?.field_goal_pct}`,
    );
    check("通算の実数が合計されている", c?.field_goals_made === 41 && c?.points === 102);
    check("通算試合数が合計されている", c?.games_played === 51);

    // --- 2. 分母0の扱い -------------------------------------------------------
    console.log("\n分母が0のとき（0% と 算出不可 の区別）");
    const { rows: zero } = await client.query(
      `select field_goal_pct, points, points_per_36, points_per_game, true_shooting_pct
       from player_season_stats_derived
       where player_id = '${P_ZERO}' and stint_id is null`,
    );
    const z = zero[0];
    check("試投0本の FG% は NULL（算出不可）。0 ではない", z?.field_goal_pct === null);
    check("出場0分の 36分換算 は NULL（算出不可）", z?.points_per_36 === null);
    check("TS% も NULL（分母0）", z?.true_shooting_pct === null);
    check("得点0は 0 のまま（欠損ではない）", z?.points === 0);
    check("出場5試合あるので1試合平均は算出できる（0.0）", closeTo(z?.points_per_game, 0));

    // --- 3. 手動修正 ----------------------------------------------------------
    console.log("\n手動修正の実効値");
    await client.query(`
      insert into player_season_stats (id, player_id, season_id, season_type, games_played, points)
      values ('dddddddd-0000-0000-0000-000000000001', '${P_OV}', '9001-02', 'regular', 10, 200);
      insert into manual_overrides (target, target_id, column_name, value_text, reason_ja)
      values ('player_season_stats', 'dddddddd-0000-0000-0000-000000000001', 'points', '250', '公式発表との差異を修正');
    `);
    const { rows: ov } = await client.query(
      `select points, has_manual_override from player_season_stats_effective
       where id = 'dddddddd-0000-0000-0000-000000000001'`,
    );
    check("手動修正した得点が実効値に反映される（200→250）", ov[0]?.points === 250);
    check("修正済みであることが分かる", ov[0]?.has_manual_override === true);

    const { rows: raw } = await client.query(
      `select points from player_season_stats where id = 'dddddddd-0000-0000-0000-000000000001'`,
    );
    check("元データは書き換わっていない（同期しても修正が消えない構造）", raw[0]?.points === 200);

    await client.query(`
      insert into manual_overrides (target, target_id, column_name, is_null_override, reason_ja)
      values ('player_season_stats', 'dddddddd-0000-0000-0000-000000000001', 'games_played', true, '誤った値だったため空にする');
    `);
    const { rows: nullOv } = await client.query(
      `select games_played from player_season_stats_effective
       where id = 'dddddddd-0000-0000-0000-000000000001'`,
    );
    check("「意図的に空にする」修正ができる（10→NULL）", nullOv[0]?.games_played === null);

    // --- 4. 年齢の基準日 ------------------------------------------------------
    console.log("\nロスターと年齢");
    await client.query(`
      insert into stints (player_id, season_id, team_id, stint_order)
      values ('${P}', '9001-02', '${TEAM}', 1);
    `);
    const { rows: roster } = await client.query(
      `select age_at_season_start from team_rosters
       where player_id = '${P}' and season_id = '9001-02'`,
    );
    // 誕生日 8980-10-20、開幕日 9001-10-20 → ちょうど21歳
    check("年齢がシーズン開幕日基準で計算される（21歳）", roster[0]?.age_at_season_start === 21);

    await client.query(`update seasons set regular_season_start_date = null where id = '9002-03';
      insert into stints (player_id, season_id, team_id, stint_order)
      values ('${P}', '9002-03', '${TEAM}', 1);`);
    const { rows: noDate } = await client.query(
      `select age_at_season_start from team_rosters
       where player_id = '${P}' and season_id = '9002-03'`,
    );
    check(
      "開幕日が未取得なら年齢は NULL（推測で出さない）",
      noDate[0]?.age_at_season_start === null,
    );

    // --- 5. ランキングとパーセンタイル ----------------------------------------
    console.log("\nランキングと規定到達");
    // 規定: 10試合以上。選手A(9001-02)は1試合なので未到達。
    await client.query(`
      insert into ranking_rules (season_id, metric_code, season_type, minimum_games)
      values ('9001-02', 'pts_per_game', 'regular', 10);
    `);
    // 規定到達側の検証には専用の選手を使う。
    // P_OV は直前の手動修正テストで games_played を NULL にしてあるため使えない。
    await client.query(`
      insert into players (id, slug, full_name_en)
      values ('${P_QUAL}', 'qualified-player', 'Qualified Player');
      insert into player_season_stats (player_id, season_id, season_type, games_played, minutes, points)
      values ('${P_QUAL}', '9001-02', 'regular', 20, 600, 400);
    `);
    const { rows: ranks } = await client.query(
      `select player_id, is_qualified, rank from player_rankings
       where season_id = '9001-02' and season_type = 'regular' and metric_code = 'pts_per_game'
       order by player_id`,
    );
    const aRow = ranks.find((r) => r.player_id === P);
    const qualRow = ranks.find((r) => r.player_id === P_QUAL);
    check("規定未到達（1試合 < 10試合）は is_qualified が false", aRow?.is_qualified === false);
    check("規定未到達者には順位が付かない（NULL）", aRow?.rank === null);
    check(
      "規定到達者（20試合）には順位が付く",
      qualRow?.is_qualified === true && qualRow?.rank !== null,
      `is_qualified=${qualRow?.is_qualified} rank=${qualRow?.rank}`,
    );

    // 手動修正で出場試合数を空にした選手は、規定判定から外れる。
    const ovRow = ranks.find((r) => r.player_id === P_OV);
    check(
      "出場試合数を空にした選手は規定到達と判定されない",
      ovRow?.is_qualified === false,
      `is_qualified=${ovRow?.is_qualified}`,
    );

    console.log("\nパーセンタイル");
    const { rows: pct } = await client.query(
      `select player_id, percentile, population from player_percentiles
       where season_id = '9001-02' and season_type = 'regular' and metric_code = 'pts_per_game'`,
    );
    const aPct = pct.find((r) => r.player_id === P);
    const qualifiedPct = pct.filter((r) => r.percentile !== null);
    check("規定未到達者のパーセンタイルは NULL", aPct?.percentile === null);
    check(
      "母集団の人数が数えられている（画面に「◯人中」と出すため）",
      qualifiedPct.every((r) => Number(r.population) > 0),
    );

    // --- 6. 二重計上していないか ----------------------------------------------
    console.log("\n二重計上の防止");
    // stint別の行を足しても、キャリア集計は変わってはいけない。
    const before = c?.points;
    await client.query(`
      insert into stints (id, player_id, season_id, team_id, stint_order)
      values ('eeeeeeee-0000-0000-0000-000000000001', '${P}', '9001-02', '${TEAM}', 2);
      insert into player_season_stats (player_id, season_id, season_type, stint_id, points, games_played)
      values ('${P}', '9001-02', 'regular', 'eeeeeeee-0000-0000-0000-000000000001', 999, 1);
    `);
    const { rows: after } = await client.query(
      `select points from player_career_stats where player_id = '${P}' and season_type = 'regular'`,
    );
    check(
      "stint別の行を足してもキャリア通算は変わらない（二重計上しない）",
      after[0]?.points === before,
      `${before} → ${after[0]?.points}`,
    );

    await client.query("rollback");

    const { rows: leftover } = await client.query(
      `select count(*)::int as n from players where slug = 'career-player'`,
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
  console.log("✓ ビューの検証をすべて通過しました。");
}

main().catch((error) => {
  console.error(`\n✗ ${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
