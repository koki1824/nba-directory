-- =============================================================================
-- 0004_fix_ranking_rule_match.sql — ランキング規定の照合を1件に絞る（不具合修正）
--
-- 【症状】
-- 0003 で「全シーズン共通の既定」（season_id が NULL の ranking_rules）を
-- 指標 × シーズン種別ごとに入れた。その後 W3-6 の管理画面で
-- 「特定シーズンだけ条件を変える」行を足すと、0002 の
--
--     left join public.ranking_rules r
--       on r.metric_code = m.metric_code
--       and r.season_type = m.season_type
--       and (r.season_id = m.season_id or r.season_id is null)
--
-- が「そのシーズンの行」と「共通の既定行」の両方に当たる。
-- left join は当たった数だけ行が増えるので、ランキングに同じ選手が2回出る。
-- さらに片方は最低条件なしなので、規定未到達の選手にも順位が付いてしまう。
--
-- 【直し方】
-- 「当たった全部」ではなく「一番ふさわしい1件」を取りに行く形にする。
-- left join lateral + limit 1 で、シーズン個別の行を優先し、
-- 無ければ共通の既定行を使う。該当が無ければ従来どおり条件なし（全員対象）。
--
-- order by (rr.season_id is null) は、false(=シーズン個別) が
-- true(=共通の既定) より先に来る昇順。つまり個別が勝つ。
--
-- 0002 は本番に適用済みでチェックサムで保護されているため、
-- 編集せず新しいファイルで create or replace view し直す。
-- 列の名前・順序・型は 0002 と同じにしてある（replace の条件であり、
-- player_percentiles がこのビューに依存しているため）。
-- =============================================================================

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
  -- 適用する規定はちょうど1件。シーズン個別 > 全シーズン共通の既定。
  left join lateral (
    select rr.minimum_games, rr.minimum_minutes, rr.allows_official_exception
    from public.ranking_rules rr
    where rr.metric_code = m.metric_code
      and rr.season_type = m.season_type
      and (rr.season_id = m.season_id or rr.season_id is null)
    order by (rr.season_id is null)
    limit 1
  ) r on true
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
  '適用する ranking_rules はちょうど1件（シーズン個別 > 全シーズン共通の既定）。'
  'ranking_rules に条件が無ければ全員を対象にする（プレーオフの運用）。';
