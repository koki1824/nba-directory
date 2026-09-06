-- =============================================================================
-- 0002_views.sql — ビュー6種
--
-- ここは「表示される数値そのもの」を作る場所。間違えるとサイトが嘘をつく。
-- オーバーライド v3 §8 の禁止事項を、ビューの構造で守らせる:
--   ・0 / NULL / N/A / Not calculated を区別する（欠損値を0扱いしない）
--   ・キャリア値をシーズン率の単純平均で算出しない
--   ・チーム成績を個人成績の合計で代用しない
--
-- 率の扱い方（重要）:
--   分母が 0 のときは NULL を返す。nullif(分母, 0) で割ることで実現する。
--   「試投0本の FG%」は 0% ではなく「算出不可」であり、
--   画面側では MissingValue の not_calculated として出す。
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. 手動修正を重ねた実効値
--
-- manual_overrides は元データを書き換えず、別テーブルに修正値を持っている。
-- ここで重ねることで「同期が走っても手動修正が消えない」を実現する（T7）。
--
-- 仕組み: 修正値を jsonb にまとめ、列ごとに
--   ・キーがある → 修正値を使う（is_null_override なら NULL になる）
--   ・キーがない  → 元の値を使う
-- という分岐をする。coalesce ではなく `?` 演算子で判定するのは、
-- 「意図的に空にした」と「修正していない」を区別する必要があるため。
-- -----------------------------------------------------------------------------

create or replace view public.player_overrides as
select
  target_id,
  jsonb_object_agg(
    column_name,
    case when is_null_override then 'null'::jsonb else to_jsonb(value_text) end
  ) as ov
from public.manual_overrides
where target = 'player'
group by target_id;

create or replace view public.players_effective as
select
  p.id,
  p.slug,
  p.full_name_en,
  case when o.ov ? 'full_name_ja' then o.ov ->> 'full_name_ja' else p.full_name_ja end
    as full_name_ja,
  p.name_ja_state,
  case when o.ov ? 'birth_date' then (o.ov ->> 'birth_date')::date else p.birth_date end
    as birth_date,
  case when o.ov ? 'height_cm' then (o.ov ->> 'height_cm')::smallint else p.height_cm end
    as height_cm,
  case when o.ov ? 'weight_kg' then (o.ov ->> 'weight_kg')::smallint else p.weight_kg end
    as weight_kg,
  case when o.ov ? 'position' then (o.ov ->> 'position')::position_code else p.position end
    as position,
  case
    when o.ov ? 'jersey_number' then (o.ov ->> 'jersey_number')::smallint
    else p.jersey_number
  end as jersey_number,
  p.country,
  p.draft_year,
  p.draft_round,
  p.draft_pick,
  p.is_active,
  p.representative_franchise_id,
  p.wikidata_qid,
  -- 手動修正が入っているかを画面側で示せるようにする（管理画面で使う）。
  (o.ov is not null) as has_manual_override
from public.players p
left join public.player_overrides o on o.target_id = p.id;

comment on view public.players_effective is
  '選手の実効値。manual_overrides を重ねた結果。画面はこちらを参照する。';

create or replace view public.team_overrides as
select
  target_id,
  jsonb_object_agg(
    column_name,
    case when is_null_override then 'null'::jsonb else to_jsonb(value_text) end
  ) as ov
from public.manual_overrides
where target = 'team'
group by target_id;

create or replace view public.teams_effective as
select
  t.id,
  t.franchise_id,
  t.name_en,
  case when o.ov ? 'name_ja' then o.ov ->> 'name_ja' else t.name_ja end as name_ja,
  t.abbreviation,
  t.city_en,
  t.city_ja,
  t.conference,
  t.division,
  t.effective_from_season_id,
  t.effective_to_season_id,
  case when o.ov ? 'primary_color' then o.ov ->> 'primary_color' else t.primary_color end
    as primary_color,
  case when o.ov ? 'secondary_color' then o.ov ->> 'secondary_color' else t.secondary_color end
    as secondary_color,
  (o.ov is not null) as has_manual_override
from public.teams t
left join public.team_overrides o on o.target_id = t.id;

create or replace view public.pss_overrides as
select
  target_id,
  jsonb_object_agg(
    column_name,
    case when is_null_override then 'null'::jsonb else to_jsonb(value_text) end
  ) as ov
from public.manual_overrides
where target = 'player_season_stats'
group by target_id;

create or replace view public.player_season_stats_effective as
select
  s.id,
  s.player_id,
  s.season_id,
  s.season_type,
  s.stint_id,
  case when o.ov ? 'games_played' then (o.ov ->> 'games_played')::smallint else s.games_played end
    as games_played,
  case
    when o.ov ? 'games_started' then (o.ov ->> 'games_started')::smallint else s.games_started
  end as games_started,
  case when o.ov ? 'minutes' then (o.ov ->> 'minutes')::numeric else s.minutes end as minutes,
  case
    when o.ov ? 'field_goals_made' then (o.ov ->> 'field_goals_made')::integer
    else s.field_goals_made
  end as field_goals_made,
  case
    when o.ov ? 'field_goals_attempted' then (o.ov ->> 'field_goals_attempted')::integer
    else s.field_goals_attempted
  end as field_goals_attempted,
  case
    when o.ov ? 'three_pointers_made' then (o.ov ->> 'three_pointers_made')::integer
    else s.three_pointers_made
  end as three_pointers_made,
  case
    when o.ov ? 'three_pointers_attempted' then (o.ov ->> 'three_pointers_attempted')::integer
    else s.three_pointers_attempted
  end as three_pointers_attempted,
  case
    when o.ov ? 'free_throws_made' then (o.ov ->> 'free_throws_made')::integer
    else s.free_throws_made
  end as free_throws_made,
  case
    when o.ov ? 'free_throws_attempted' then (o.ov ->> 'free_throws_attempted')::integer
    else s.free_throws_attempted
  end as free_throws_attempted,
  case
    when o.ov ? 'offensive_rebounds' then (o.ov ->> 'offensive_rebounds')::integer
    else s.offensive_rebounds
  end as offensive_rebounds,
  case
    when o.ov ? 'defensive_rebounds' then (o.ov ->> 'defensive_rebounds')::integer
    else s.defensive_rebounds
  end as defensive_rebounds,
  case when o.ov ? 'assists' then (o.ov ->> 'assists')::integer else s.assists end as assists,
  case when o.ov ? 'steals' then (o.ov ->> 'steals')::integer else s.steals end as steals,
  case when o.ov ? 'blocks' then (o.ov ->> 'blocks')::integer else s.blocks end as blocks,
  case when o.ov ? 'turnovers' then (o.ov ->> 'turnovers')::integer else s.turnovers end
    as turnovers,
  case
    when o.ov ? 'personal_fouls' then (o.ov ->> 'personal_fouls')::integer else s.personal_fouls
  end as personal_fouls,
  case when o.ov ? 'points' then (o.ov ->> 'points')::integer else s.points end as points,
  case
    when o.ov ? 'box_plus_minus' then (o.ov ->> 'box_plus_minus')::numeric else s.box_plus_minus
  end as box_plus_minus,
  case
    when o.ov ? 'value_over_replacement' then (o.ov ->> 'value_over_replacement')::numeric
    else s.value_over_replacement
  end as value_over_replacement,
  s.source_id,
  (o.ov is not null) as has_manual_override
from public.player_season_stats s
left join public.pss_overrides o on o.target_id = s.id;

comment on view public.player_season_stats_effective is
  '選手成績の実効値。手動修正を重ねた結果。同期しても修正が消えないのはこの構造のため。';

-- -----------------------------------------------------------------------------
-- 2. 率・36分換算・1試合平均
--
-- 分母が 0 のときは NULL（算出不可）にする。0% にしてはいけない。
-- -----------------------------------------------------------------------------

create or replace view public.player_season_stats_derived as
select
  e.*,
  -- リバウンドは攻守の合計。どちらかが NULL なら合計も NULL にする
  -- （0 として足すと、記録が無いだけの選手を「0本」と誤って表示するため）。
  e.offensive_rebounds + e.defensive_rebounds as total_rebounds,

  -- 率。分母 0 は nullif で NULL になる = 算出不可。
  e.field_goals_made::numeric / nullif(e.field_goals_attempted, 0) as field_goal_pct,
  e.three_pointers_made::numeric / nullif(e.three_pointers_attempted, 0) as three_point_pct,
  e.free_throws_made::numeric / nullif(e.free_throws_attempted, 0) as free_throw_pct,

  -- eFG% = (FGM + 0.5 × 3PM) / FGA。3Pの価値を織り込んだ成功率。
  (e.field_goals_made + 0.5 * e.three_pointers_made)::numeric
    / nullif(e.field_goals_attempted, 0) as effective_field_goal_pct,

  -- TS% = PTS / (2 × (FGA + 0.44 × FTA))。フリースローも含めた総合的な得点効率。
  e.points::numeric
    / nullif(2 * (e.field_goals_attempted + 0.44 * e.free_throws_attempted), 0) as true_shooting_pct,

  -- 1試合平均。出場0試合は算出不可。
  e.points::numeric / nullif(e.games_played, 0) as points_per_game,
  (e.offensive_rebounds + e.defensive_rebounds)::numeric / nullif(e.games_played, 0)
    as rebounds_per_game,
  e.assists::numeric / nullif(e.games_played, 0) as assists_per_game,
  e.steals::numeric / nullif(e.games_played, 0) as steals_per_game,
  e.blocks::numeric / nullif(e.games_played, 0) as blocks_per_game,
  e.turnovers::numeric / nullif(e.games_played, 0) as turnovers_per_game,
  e.minutes / nullif(e.games_played, 0) as minutes_per_game,

  -- 36分換算。出場時間0分は算出不可。
  e.points::numeric * 36 / nullif(e.minutes, 0) as points_per_36,
  (e.offensive_rebounds + e.defensive_rebounds)::numeric * 36 / nullif(e.minutes, 0)
    as rebounds_per_36,
  e.assists::numeric * 36 / nullif(e.minutes, 0) as assists_per_36,
  e.steals::numeric * 36 / nullif(e.minutes, 0) as steals_per_36,
  e.blocks::numeric * 36 / nullif(e.minutes, 0) as blocks_per_36
from public.player_season_stats_effective e;

comment on view public.player_season_stats_derived is
  '率・36分換算・1試合平均。分母が0のときは NULL（算出不可）を返す。0%ではない。';

-- -----------------------------------------------------------------------------
-- 3. キャリア集計
--
-- 【禁止】シーズンごとの率を平均してはいけない。
-- 例: 1本中1本成功(100%)のシーズンと 100本中40本(40%)のシーズンを平均すると 70% になるが、
--     実際は 41/101 = 40.6% である。試投数の重みを無視した値は誤りになる。
--
-- 正しくは「合計してから割る」。ここでは実数を合計し、率はその合計から計算する。
-- 集計対象はシーズン合計行（stint_id が NULL）のみ。stint別の行を混ぜると二重計上になる。
-- -----------------------------------------------------------------------------

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
  sum(e.assists)::numeric / nullif(sum(e.games_played), 0) as assists_per_game
from public.player_season_stats_effective e
-- シーズン合計行のみ。stint別の行を含めると同じ成績を二重に数える。
where e.stint_id is null
group by e.player_id, e.season_type;

comment on view public.player_career_stats is
  'キャリア通算。率は合計から計算する（シーズン率の平均は誤り）。'
  'stint別の行は除外し、シーズン合計行のみを集計する（二重計上を防ぐため）。';

-- -----------------------------------------------------------------------------
-- 4. ロスター（チーム × シーズンの在籍選手）
-- -----------------------------------------------------------------------------

create or replace view public.team_rosters as
select
  st.team_id,
  st.season_id,
  st.player_id,
  st.stint_order,
  st.started_on,
  st.ended_on,
  p.slug as player_slug,
  p.full_name_en,
  p.full_name_ja,
  p.position,
  p.jersey_number,
  p.height_cm,
  p.weight_kg,
  p.birth_date,
  -- シーズン当時の年齢。開幕日が未取得なら NULL（推測で出さない）。
  -- docs/DECISIONS.md §1 の決定。他サイト（2月1日基準）とは1歳ずれることがある。
  case
    when se.regular_season_start_date is null or p.birth_date is null then null
    else extract(year from age(se.regular_season_start_date, p.birth_date))::smallint
  end as age_at_season_start,
  t.name_en as team_name_en,
  t.name_ja as team_name_ja,
  t.abbreviation as team_abbreviation
from public.stints st
join public.players_effective p on p.id = st.player_id
join public.teams_effective t on t.id = st.team_id
join public.seasons se on se.id = st.season_id;

comment on view public.team_rosters is
  'チーム×シーズンの在籍選手。年齢はシーズン開幕日基準。開幕日が無ければ NULL。';

-- -----------------------------------------------------------------------------
-- 5. 指標の縦持ち → ランキング
--
-- 指標を列で持つと、指標が増えるたびにビューを直すことになる。
-- 「1行 = 選手 × シーズン × 指標」の縦持ちにして、metric_definitions と対応させる。
-- -----------------------------------------------------------------------------

create or replace view public.player_season_metrics as
select d.player_id, d.season_id, d.season_type, d.games_played, d.minutes, m.metric_code, m.value
from public.player_season_stats_derived d
cross join lateral (
  values
    ('pts_per_game', d.points_per_game),
    ('reb_per_game', d.rebounds_per_game),
    ('ast_per_game', d.assists_per_game),
    ('stl_per_game', d.steals_per_game),
    ('blk_per_game', d.blocks_per_game),
    ('tov_per_game', d.turnovers_per_game),
    ('min_per_game', d.minutes_per_game),
    ('fg_pct', d.field_goal_pct),
    ('fg3_pct', d.three_point_pct),
    ('ft_pct', d.free_throw_pct),
    ('efg_pct', d.effective_field_goal_pct),
    ('ts_pct', d.true_shooting_pct),
    ('pts_per_36', d.points_per_36),
    ('reb_per_36', d.rebounds_per_36),
    ('ast_per_36', d.assists_per_36),
    ('bpm', d.box_plus_minus),
    ('vorp', d.value_over_replacement)
) as m (metric_code, value)
-- シーズン合計行のみを対象にする。stint別を混ぜるとランキングに同じ選手が複数出る。
where d.stint_id is null;

comment on view public.player_season_metrics is
  '指標の縦持ち。1行 = 選手 × シーズン × 指標。指標が増えてもビューの構造を変えずに済む。';

create or replace view public.player_rankings as
with base as (
  select
    m.player_id,
    m.season_id,
    m.season_type,
    m.metric_code,
    m.value,
    m.games_played,
    m.minutes,
    r.minimum_games,
    r.minimum_minutes,
    r.allows_official_exception,
    md.higher_is_better,
    -- 規定到達の判定。判定条件はここ1箇所だけに書く。
    -- 複数箇所に同じ条件を書くと、片方だけ直して食い違う。
    --
    -- 【重要】出場試合数が NULL のときは「未到達」と確定させる。
    -- `NULL >= 10` は NULL になるため、素直に比較すると is_qualified が
    -- true でも false でもない三値になり、画面側で扱いに困る。
    --
    -- ranking_rules に該当行が無い、または条件が全て NULL なら「条件なし」。
    -- 全員が対象になる（プレーオフはこの運用。docs/DECISIONS.md §4）。
    case
      when r.minimum_games is not null
        and (m.games_played is null or m.games_played < r.minimum_games) then false
      when r.minimum_minutes is not null
        and (m.minutes is null or m.minutes < r.minimum_minutes) then false
      else true
    end as is_qualified
  from public.player_season_metrics m
  join public.metric_definitions md on md.code = m.metric_code
  left join public.ranking_rules r
    on r.metric_code = m.metric_code
    and r.season_type = m.season_type
    and (r.season_id = m.season_id or r.season_id is null)
)
select
  b.*,
  -- 順位は規定到達者だけに付ける。未到達者は NULL。
  -- partition に「到達しているか」を含めることで、未到達者が順位を押し下げないようにする。
  case
    when not b.is_qualified or b.value is null then null
    else rank() over (
      partition by
        b.season_id, b.season_type, b.metric_code, (b.is_qualified and b.value is not null)
      order by case when b.higher_is_better then b.value else -b.value end desc
    )
  end as rank
from base b;

comment on view public.player_rankings is
  'ランキング。規定未到達者は rank が NULL になる。'
  'ranking_rules に条件が無ければ全員を対象にする（プレーオフの運用）。';

-- -----------------------------------------------------------------------------
-- 6. パーセンタイル
--
-- 母集団は「規定到達者のみ」（Q3 の決定）。
-- 画面には母集団と最低条件を明示すること。
-- -----------------------------------------------------------------------------

create or replace view public.player_percentiles as
select
  r.player_id,
  r.season_id,
  r.season_type,
  r.metric_code,
  r.value,
  r.is_qualified,
  -- 母集団の人数。画面に「◯人中」と出すために使う。
  count(*) filter (where r.is_qualified and r.value is not null) over (
    partition by r.season_id, r.season_type, r.metric_code
  ) as population,
  case
    when not r.is_qualified or r.value is null then null
    else round(
      (
        percent_rank() over (
          partition by r.season_id, r.season_type, r.metric_code,
            (r.is_qualified and r.value is not null)
          order by case when r.higher_is_better then r.value else -r.value end
        ) * 100
      )::numeric,
      0
    )
  end as percentile
from public.player_rankings r;

comment on view public.player_percentiles is
  'リーグ内パーセンタイル。母集団は規定到達者のみ（Q3）。'
  '画面には母集団の人数と最低条件を必ず併記すること。';
