#!/usr/bin/env node
/**
 * 開発用 seed データの検証（W2-1）。
 *
 *   SUPABASE_DB_URL="postgres://..." node scripts/verify-dev-seed.mjs
 *
 * seed は画面とテストの土台なので、境界ケースが揃っていないと
 * 「試していないのに動いているつもり」になる。
 *
 * 特に怖いのは**静かに減ること**。生成器を直したときに、
 * たとえば移籍のケースが作られなくなっても、画面は普通に動いてしまう。
 * 気づかないまま公開日を迎えるので、ここで数を見張る。
 *
 * 数値の辻褄（得点が内訳と合う・3P成功がFG成功を超えない）も見る。
 * 画面で見て「バグだ」と誤解する時間が惜しいため。
 */

import pg from "pg";

const results = [];

function check(name, ok, detail = "") {
  results.push({ name, ok });
  console.log(`${ok ? "  ✓" : "  ✗"} ${name}${detail ? ` — ${detail}` : ""}`);
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

  const one = async (sql, params = []) => (await client.query(sql, params)).rows[0];

  try {
    console.log("規模");
    const counts = await one(`
      select
        (select count(*) from players where slug like 'dev-%')::int as players,
        (select count(*) from teams t join franchises f on f.id = t.franchise_id
          where f.slug like 'dev-%')::int as teams,
        (select count(distinct season_id) from stints st
          join players p on p.id = st.player_id where p.slug like 'dev-%')::int as seasons
    `);
    // 要件（オーバーライド v3 §7）: 20〜30名 / 3チーム以上 / 複数シーズン
    check(
      "選手が20〜30名いる",
      counts.players >= 20 && counts.players <= 30,
      `${counts.players}名`,
    );
    check("チームが3つ以上ある", counts.teams >= 3, `${counts.teams}チーム`);
    check("複数シーズンある", counts.seasons >= 2, `${counts.seasons}シーズン`);

    console.log("\n数値の辻褄");
    const sane = await one(`
      select
        (select count(*) from player_season_stats
          where points is not null
            and points <> 2 * field_goals_made + three_pointers_made + free_throws_made)::int
          as bad_points,
        (select count(*) from player_season_stats
          where three_pointers_made > field_goals_made)::int as bad_threes,
        (select count(*) from player_season_stats
          where field_goals_made > field_goals_attempted
             or three_pointers_made > three_pointers_attempted
             or free_throws_made > free_throws_attempted)::int as bad_made
    `);
    check(
      "得点が内訳と一致する（2×FG成功 + 3P成功 + FT成功）",
      sane.bad_points === 0,
      `合わない行 ${sane.bad_points}`,
    );
    check("3P成功がFG成功を超えていない（3PはFGの内数）", sane.bad_threes === 0);
    check("成功数が試投数を超えていない", sane.bad_made === 0);

    console.log("\n境界ケース");

    // 1. シーズン途中の移籍
    const traded = await one(`
      select count(*)::int as n from (
        select s.player_id, s.season_id
        from player_season_stats s
        join players p on p.id = s.player_id
        where p.slug like 'dev-%' and s.season_type = 'regular' and s.stint_id is not null
        group by 1, 2 having count(*) >= 2
      ) t
    `);
    check("シーズン途中の移籍がある（stintで分割）", traded.n >= 1, `${traded.n}件`);

    // 合計行 = 内訳の和。ここがずれるのが一番分かりにくい壊れ方。
    const tradeSum = await one(`
      select count(*)::int as n from (
        select s.player_id, s.season_id,
               max(case when s.stint_id is null then s.points end) as total,
               sum(case when s.stint_id is not null then s.points end) as parts
        from player_season_stats s
        join players p on p.id = s.player_id
        where p.slug like 'dev-%' and s.season_type = 'regular'
        group by 1, 2
        having count(*) filter (where s.stint_id is not null) > 0
      ) t where t.total is distinct from t.parts
    `);
    check("移籍シーズンの合計行が内訳の和と一致する", tradeSum.n === 0, `ずれ ${tradeSum.n}件`);

    // 2. 一本も打っていない → FG%は算出不可（0%ではない）
    const noAttempts = await one(`
      select count(*)::int as n
      from player_season_stats_derived d
      join players p on p.id = d.player_id
      where p.slug like 'dev-%' and d.stint_id is null
        and d.field_goals_attempted = 0 and d.field_goal_pct is null
    `);
    check("一本も打っていないシーズンがあり、FG%がNULL（算出不可）", noAttempts.n >= 1);

    // 3. 出場0試合 → 1試合平均は算出不可
    const zeroGames = await one(`
      select count(*)::int as n
      from player_season_stats_derived d
      join players p on p.id = d.player_id
      where p.slug like 'dev-%' and d.stint_id is null
        and d.games_played = 0 and d.points_per_game is null
    `);
    check("出場0試合のシーズンがあり、1試合平均がNULL（算出不可）", zeroGames.n >= 1);

    // 4. 記録が残っていない項目（0ではなくNULL）
    const missingBox = await one(`
      select count(*)::int as n
      from player_season_stats s
      join players p on p.id = s.player_id
      where p.slug like 'dev-%' and s.steals is null and s.games_played > 0
    `);
    check("記録が無い項目がNULLのシーズンがある（0ではない）", missingBox.n >= 1);

    // 5. プレーオフ両方 / 未出場
    const po = await one(`
      select
        (select count(distinct s.player_id) from player_season_stats s
          join players p on p.id = s.player_id
         where p.slug like 'dev-%' and s.season_type = 'playoff')::int as with_po,
        (select count(*) from players p where p.slug like 'dev-%'
          and not exists (
            select 1 from player_season_stats s
             where s.player_id = p.id and s.season_type = 'playoff'))::int as without_po
    `);
    check("プレーオフ成績のある選手がいる", po.with_po >= 1, `${po.with_po}名`);
    check(
      "プレーオフに一度も出ていない選手がいる（N/Aの検証用）",
      po.without_po >= 1,
      `${po.without_po}名`,
    );

    // 6. 同姓同名 / 同姓
    const names = await one(`
      select
        (select count(*) from (
          select full_name_en from players where slug like 'dev-%'
          group by 1 having count(*) >= 2) x)::int as same_full,
        (select count(*) from (
          select last_name_en from players where slug like 'dev-%'
          group by 1 having count(*) >= 2) y)::int as same_last
    `);
    check(
      "同姓同名の選手がいる（区別できることの検証用）",
      names.same_full >= 1,
      `${names.same_full}組`,
    );
    check("同じ姓の選手がいる（検索の検証用）", names.same_last >= 2, `${names.same_last}組`);

    // 7. 日本語名の状態が3種そろっている
    const jaStates = await one(`
      select count(distinct name_ja_state)::int as n from players where slug like 'dev-%'
    `);
    check(
      "日本語名の状態が3種そろっている（未設定/機械/人手確認）",
      jaStates.n === 3,
      `${jaStates.n}種`,
    );

    // 8. 手動修正が効き、元データは変わっていない
    const override = await one(`
      select
        (select count(*) from manual_overrides mo
          join players p on p.id = mo.target_id
         where mo.target = 'player' and p.slug like 'dev-%')::int as n,
        (select count(*) from players_effective e
          join players p on p.id = e.id
         where p.slug like 'dev-%' and e.has_manual_override
           and e.full_name_ja is distinct from p.full_name_ja)::int as applied
    `);
    check("手動修正が1件以上ある", override.n >= 1, `${override.n}件`);
    check(
      "手動修正がビューに反映され、元データは書き換わっていない",
      override.applied >= 1,
      `${override.applied}件`,
    );

    // 9. チーム成績が個人成績の合計になっていない（合計で代用しない・v3 §8）
    const teamVsPlayers = await one(`
      select count(*)::int as n from (
        select t.id,
               max(ts.points_for) as official,
               sum(s.points) filter (where s.stint_id is null) as player_sum
        from teams t
        join franchises f on f.id = t.franchise_id and f.slug like 'dev-%'
        join team_season_stats ts on ts.team_id = t.id and ts.season_id = '2024-25'
        left join stints st on st.team_id = t.id and st.season_id = '2024-25'
        left join player_season_stats s
          on s.player_id = st.player_id and s.season_id = '2024-25' and s.season_type = 'regular'
        group by t.id
      ) x where x.official = x.player_sum
    `);
    check(
      "チーム成績が所属選手の合計と一致していない（合計で代用しないことの確認）",
      teamVsPlayers.n === 0,
      "一致していたら、合計で代用してよいという誤解を生む",
    );

    // 10. ランキングに同じ選手が二重に出ない（0004 の不具合の再発防止）
    const dupRank = await one(`
      select count(*)::int as n from (
        select player_id, season_id, season_type, metric_code
        from player_rankings
        group by 1, 2, 3, 4 having count(*) > 1
      ) d
    `);
    check("ランキングに同じ選手が二重に出ない", dupRank.n === 0, `重複 ${dupRank.n}件`);
  } finally {
    await client.end();
  }

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length} / ${results.length} 件成功`);

  if (failed.length > 0) {
    console.error(`\n✗ ${failed.length} 件失敗しました。`);
    console.error("seed の境界ケースが欠けています。scripts/gen-dev-seed.mjs を確認してください。");
    process.exit(1);
  }

  console.log("✓ 開発用 seed の検証をすべて通過しました。");
}

main().catch((error) => {
  console.error(`✗ ${error.message}`);
  process.exit(1);
});
