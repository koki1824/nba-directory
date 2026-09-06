-- =============================================================================
-- 0005_career_stats_more_averages.sql — キャリア通算に平均値を追加
--
-- 【なぜ】
-- 比較ページ（W2-7）は「シーズン成績」と「キャリア通算」を同じ指標で見せる。
-- ところが player_career_stats には
--   得点 / リバウンド / アシスト の1試合平均しか無く、
--   スティール / ブロック / ターンオーバー / 出場時間 が抜けていた。
-- そのままだと、キャリアに切り替えたとたん指標が減って見える。
--
-- 【追加するもの】
--   steals_per_game / blocks_per_game / turnovers_per_game / minutes_per_game
--
-- 実数はすでに合計して持っているので、それを試合数で割るだけ。
-- 率と同じく「合計 ÷ 合計」であり、シーズンごとの平均を平均したものではない。
-- 出場0試合なら nullif で NULL（算出不可）になる。0 にはしない。
--
-- create or replace view は「末尾に列を足す」ことだけができる。
-- 既存の列の順番と型は 0002 のまま変えていない。
-- =============================================================================

create or replace view public.player_career_stats as
select
  e.player_id,
  e.season_type,
  count(*)::integer as seasons_played,
  sum(e.games_played)::integer as games_played,
  sum(e.games_started)::integer as games_started,
  sum(e.minutes) as minutes,
  sum(e.field_goals_made)::integer as field_goals_made,
  sum(e.field_goals_attempted)::integer as field_goals_attempted,
  sum(e.three_pointers_made)::integer as three_pointers_made,
  sum(e.three_pointers_attempted)::integer as three_pointers_attempted,
  sum(e.free_throws_made)::integer as free_throws_made,
  sum(e.free_throws_attempted)::integer as free_throws_attempted,
  sum(e.offensive_rebounds)::integer as offensive_rebounds,
  sum(e.defensive_rebounds)::integer as defensive_rebounds,
  sum(e.assists)::integer as assists,
  sum(e.steals)::integer as steals,
  sum(e.blocks)::integer as blocks,
  sum(e.turnovers)::integer as turnovers,
  sum(e.points)::integer as points,

  -- 率は「合計 ÷ 合計」。シーズン率の平均ではない。
  sum(e.field_goals_made)::numeric / nullif(sum(e.field_goals_attempted), 0) as field_goal_pct,
  sum(e.three_pointers_made)::numeric / nullif(sum(e.three_pointers_attempted), 0)
    as three_point_pct,
  sum(e.free_throws_made)::numeric / nullif(sum(e.free_throws_attempted), 0) as free_throw_pct,
  (sum(e.field_goals_made) + 0.5 * sum(e.three_pointers_made))::numeric
    / nullif(sum(e.field_goals_attempted), 0) as effective_field_goal_pct,
  sum(e.points)::numeric
    / nullif(2 * (sum(e.field_goals_attempted) + 0.44 * sum(e.free_throws_attempted)), 0)
    as true_shooting_pct,

  sum(e.points)::numeric / nullif(sum(e.games_played), 0) as points_per_game,
  (sum(e.offensive_rebounds) + sum(e.defensive_rebounds))::numeric
    / nullif(sum(e.games_played), 0) as rebounds_per_game,
  sum(e.assists)::numeric / nullif(sum(e.games_played), 0) as assists_per_game,

  -- ここから 0005 で追加。列は末尾に足す必要がある。
  sum(e.steals)::numeric / nullif(sum(e.games_played), 0) as steals_per_game,
  sum(e.blocks)::numeric / nullif(sum(e.games_played), 0) as blocks_per_game,
  sum(e.turnovers)::numeric / nullif(sum(e.games_played), 0) as turnovers_per_game,
  sum(e.minutes) / nullif(sum(e.games_played), 0) as minutes_per_game
from public.player_season_stats_effective e
-- シーズン合計行のみ。stint別の行を含めると同じ成績を二重に数える。
where e.stint_id is null
group by e.player_id, e.season_type;

comment on view public.player_career_stats is
  'キャリア通算。率も1試合平均も、合計してから割る（シーズンごとの値の平均は誤り）。'
  'stint別の行は除外し、シーズン合計行のみを集計する（二重計上を防ぐため）。';
