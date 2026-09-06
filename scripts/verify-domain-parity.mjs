#!/usr/bin/env node
/**
 * TypeScript の計算とDBのビューが同じ答えを出すことを確かめる。
 *
 *   SUPABASE_DB_URL="postgres://..." node scripts/verify-domain-parity.mjs
 *
 * 【なぜ要るか】
 * 率・平均・キャリア集計の式が、DBのビュー（0002_views.sql）と
 * TypeScript（src/domain/stats.ts）の2か所にある。
 * ビューは一覧やランキングをDB側で速く出すため、TypeScript は画面上で
 * 組み替えるために必要で、どちらも消せない。
 *
 * 2か所にある以上、片方だけ直せば数字が食い違う。
 * 選手ページとランキングで違う値が出る、という形で表に出るので、
 * 気づくのが遅れると信用を失う。
 *
 * そこで期待値を fixtures/stat-parity.json に1つだけ置き、
 *   ・TypeScript側 … src/domain/parity.test.ts（npm run test）
 *   ・DB側        … このスクリプト（CI）
 * の両方から突き合わせる。どちらかがずれれば必ずどちらかが落ちる。
 *
 * 検証データはトランザクションごと巻き戻すので、DBには何も残らない。
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import pg from "pg";

const here = dirname(fileURLToPath(import.meta.url));
const fixture = JSON.parse(readFileSync(join(here, "..", "fixtures", "stat-parity.json"), "utf8"));

const results = [];

function check(name, ok, detail = "") {
  results.push({ name, ok });
  console.log(`${ok ? "  ✓" : "  ✗"} ${name}${detail ? ` — ${detail}` : ""}`);
}

/**
 * 小数の比較。
 * Postgres の numeric は10進の高精度、JavaScript は2進の浮動小数なので、
 * まったく同じビット列にはならない。表示は小数3〜4桁なので 1e-9 で十分。
 */
function closeTo(actual, expected, tolerance = 1e-9) {
  if (actual === null || actual === undefined) return false;
  return Math.abs(Number(actual) - expected) < tolerance;
}

const PLAYER = "aaaaaaaa-1111-0000-0000-000000000001";

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

    for (const seasonId of fixture.seasons) {
      const startYear = Number(seasonId.slice(0, 4));
      await client.query(
        `insert into seasons (id, start_year, end_year) values ($1, $2, $3)
         on conflict (id) do nothing`,
        [seasonId, startYear, startYear + 1],
      );
    }

    await client.query(
      `insert into players (id, slug, full_name_en) values ($1, 'parity-player', 'Parity Player')`,
      [PLAYER],
    );

    for (const row of fixture.rows) {
      await client.query(
        `insert into player_season_stats
           (player_id, season_id, season_type, games_played, minutes,
            field_goals_made, field_goals_attempted,
            three_pointers_made, three_pointers_attempted,
            free_throws_made, free_throws_attempted,
            offensive_rebounds, defensive_rebounds,
            assists, steals, blocks, turnovers, points)
         values ($1, $2, 'regular', $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)`,
        [
          PLAYER,
          row.seasonId,
          row.gamesPlayed,
          row.minutes,
          row.fieldGoalsMade,
          row.fieldGoalsAttempted,
          row.threePointersMade,
          row.threePointersAttempted,
          row.freeThrowsMade,
          row.freeThrowsAttempted,
          row.offensiveRebounds,
          row.defensiveRebounds,
          row.assists,
          row.steals,
          row.blocks,
          row.turnovers,
          row.points,
        ],
      );
    }

    // --- シーズン単体 ---------------------------------------------------------
    console.log("シーズンの計算（ビュー: player_season_stats_derived）");
    const [seasonId, expectedSeason] = Object.entries(fixture.expectedSeason)[0];
    const { rows: derived } = await client.query(
      `select field_goal_pct, three_point_pct, free_throw_pct, effective_field_goal_pct,
              true_shooting_pct, points_per_game, rebounds_per_game, assists_per_game, points_per_36
       from player_season_stats_derived
       where player_id = $1 and season_id = $2 and stint_id is null`,
      [PLAYER, seasonId],
    );
    const d = derived[0];

    const seasonPairs = [
      ["FG%", d?.field_goal_pct, expectedSeason.fieldGoalPct],
      ["3P%", d?.three_point_pct, expectedSeason.threePointPct],
      ["FT%", d?.free_throw_pct, expectedSeason.freeThrowPct],
      ["eFG%", d?.effective_field_goal_pct, expectedSeason.effectiveFieldGoalPct],
      ["TS%", d?.true_shooting_pct, expectedSeason.trueShootingPct],
      ["平均得点", d?.points_per_game, expectedSeason.pointsPerGame],
      ["平均リバウンド", d?.rebounds_per_game, expectedSeason.reboundsPerGame],
      ["平均アシスト", d?.assists_per_game, expectedSeason.assistsPerGame],
      ["36分換算得点", d?.points_per_36, expectedSeason.pointsPer36],
    ];

    for (const [name, actual, want] of seasonPairs) {
      check(
        `${name} が TypeScript と同じ値になる`,
        closeTo(actual, want),
        `DB ${actual} / 期待 ${want}`,
      );
    }

    // --- キャリア -------------------------------------------------------------
    console.log("\nキャリア集計（ビュー: player_career_stats）");
    const { rows: career } = await client.query(
      `select seasons_played, games_played, minutes, field_goals_made, field_goals_attempted,
              points, field_goal_pct, three_point_pct, free_throw_pct,
              effective_field_goal_pct, true_shooting_pct,
              points_per_game, rebounds_per_game, assists_per_game
       from player_career_stats where player_id = $1 and season_type = 'regular'`,
      [PLAYER],
    );
    const c = career[0];
    const want = fixture.expectedCareer;

    check(
      "実数の合計が一致する",
      c?.seasons_played === want.seasonsPlayed &&
        c?.games_played === want.gamesPlayed &&
        Number(c?.minutes) === want.minutes &&
        c?.field_goals_made === want.fieldGoalsMade &&
        c?.field_goals_attempted === want.fieldGoalsAttempted &&
        c?.points === want.points,
      `試合 ${c?.games_played} / FGM ${c?.field_goals_made} / FGA ${c?.field_goals_attempted} / 得点 ${c?.points}`,
    );

    const careerPairs = [
      ["通算FG%", c?.field_goal_pct, want.fieldGoalPct],
      ["通算3P%", c?.three_point_pct, want.threePointPct],
      ["通算FT%", c?.free_throw_pct, want.freeThrowPct],
      ["通算eFG%", c?.effective_field_goal_pct, want.effectiveFieldGoalPct],
      ["通算TS%", c?.true_shooting_pct, want.trueShootingPct],
      ["通算平均得点", c?.points_per_game, want.pointsPerGame],
      ["通算平均リバウンド", c?.rebounds_per_game, want.reboundsPerGame],
      ["通算平均アシスト", c?.assists_per_game, want.assistsPerGame],
    ];

    for (const [name, actual, expected] of careerPairs) {
      check(
        `${name} が TypeScript と同じ値になる`,
        closeTo(actual, expected),
        `DB ${actual} / 期待 ${expected}`,
      );
    }

    check(
      "通算FG% がシーズン率の単純平均(0.70)になっていない",
      !closeTo(c?.field_goal_pct, fixture.wrongCareerFieldGoalPct, 1e-3),
      `DB ${c?.field_goal_pct}`,
    );

    await client.query("rollback");

    const { rows: leftover } = await client.query(
      `select count(*)::int as n from players where slug = 'parity-player'`,
    );
    check("検証用データがDBに残っていない", leftover[0]?.n === 0);
  } finally {
    await client.end();
  }

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length} / ${results.length} 件成功`);

  if (failed.length > 0) {
    console.error(`\n✗ ${failed.length} 件失敗しました。`);
    console.error(
      "TypeScript（src/domain/stats.ts）とDBのビュー（supabase/migrations）で式が食い違っています。",
    );
    console.error("片方だけ直していないか確認してください。両方直すか、両方そのままにするかです。");
    process.exit(1);
  }

  console.log("✓ TypeScript と DB の計算が一致しています。");
}

main().catch((error) => {
  console.error(`✗ ${error.message}`);
  process.exit(1);
});
