-- =============================================================================
-- 0003_reference_seed.sql — 基礎データ（W1-7）
--
-- ここに入れるのは「事実」ではなく「取り決め」です。
--   ・シーズンのID（'2024-25' という書き方の規則）
--   ・指標の表示ルール（小数何桁で出すか、大きい方が良いか）
--   ・データ出典の登録
--   ・ランキングの規定条件
--
-- 【重要】AIが調べた事実は入れません。
-- オーバーライド v3 は「AIが生成した推測値をそのまま公開しない」と定めています。
-- 開幕日・選手・成績といった「外の世界の事実」は、
-- 出典を確認できる形で別途投入します（W2-1 / Phase 3）。
--
-- 再実行しても壊れないように、すべて on conflict 付きで書いています。
-- =============================================================================

-- -----------------------------------------------------------------------------
-- データの出典
-- -----------------------------------------------------------------------------
insert into public.data_sources (code, name_ja, url, attribution_ja, persistence_allowed)
values
  (
    'seed',
    '手入力のサンプルデータ',
    null,
    'このサイトが用意したサンプルデータです。公式記録ではありません。',
    true
  ),
  (
    'manual',
    '管理画面からの手動入力',
    null,
    '運営者が確認して入力した値です。',
    true
  ),
  (
    'balldontlie',
    'BALLDONTLIE API',
    'https://www.balldontlie.io/',
    'Data provided by BALLDONTLIE',
    -- W0-1 の書面確認で、自社DBへの永続保存が許諾されている（docs/DECISIONS.md §8）。
    true
  )
on conflict (code) do update set
  name_ja = excluded.name_ja,
  url = excluded.url,
  attribution_ja = excluded.attribution_ja,
  persistence_allowed = excluded.persistence_allowed;

-- -----------------------------------------------------------------------------
-- 指標の表示ルール
--
-- 小数の桁数と「大きい方が良いか」をここで決める。画面ごとに書き分けない。
-- turnovers（ターンオーバー）だけは少ない方が良いので higher_is_better = false。
-- -----------------------------------------------------------------------------
insert into public.metric_definitions
  (code, name_ja, name_en, unit, decimal_places, higher_is_better, is_rate, is_advanced, display_order)
values
  ('pts_per_game', '得点', 'PTS', null, 1, true, false, false, 10),
  ('reb_per_game', 'リバウンド', 'REB', null, 1, true, false, false, 20),
  ('ast_per_game', 'アシスト', 'AST', null, 1, true, false, false, 30),
  ('stl_per_game', 'スティール', 'STL', null, 1, true, false, false, 40),
  ('blk_per_game', 'ブロック', 'BLK', null, 1, true, false, false, 50),
  -- ターンオーバーは少ない方が良い。ランキングやパーセンタイルの向きが逆になる。
  ('tov_per_game', 'ターンオーバー', 'TOV', null, 1, false, false, false, 60),
  ('min_per_game', '平均出場時間', 'MIN', null, 1, true, false, false, 70),

  ('fg_pct', 'フィールドゴール成功率', 'FG%', '%', 1, true, true, false, 110),
  ('fg3_pct', '3ポイント成功率', '3P%', '%', 1, true, true, false, 120),
  ('ft_pct', 'フリースロー成功率', 'FT%', '%', 1, true, true, false, 130),
  ('efg_pct', '実効フィールドゴール成功率', 'eFG%', '%', 1, true, true, false, 140),
  ('ts_pct', 'トゥルーシューティング%', 'TS%', '%', 1, true, true, false, 150),

  ('pts_per_36', '36分換算 得点', 'PTS/36', null, 1, true, false, false, 210),
  ('reb_per_36', '36分換算 リバウンド', 'REB/36', null, 1, true, false, false, 220),
  ('ast_per_36', '36分換算 アシスト', 'AST/36', null, 1, true, false, false, 230),

  -- 高度指標。プロバイダによっては取得できない（Q2）。
  -- 取得できなければ画面に列ごと出さない。
  ('bpm', 'ボックスプラスマイナス', 'BPM', null, 1, true, false, true, 310),
  ('vorp', '勝利貢献値', 'VORP', null, 1, true, false, true, 320)
on conflict (code) do update set
  name_ja = excluded.name_ja,
  name_en = excluded.name_en,
  unit = excluded.unit,
  decimal_places = excluded.decimal_places,
  higher_is_better = excluded.higher_is_better,
  is_rate = excluded.is_rate,
  is_advanced = excluded.is_advanced,
  display_order = excluded.display_order;

-- -----------------------------------------------------------------------------
-- シーズン
--
-- ID・開始年・終了年は「取り決め」なので機械的に作れる。
--
-- 【重要】開幕日（regular_season_start_date）は入れません。
-- これは調べれば分かる事実ですが、AIの記憶で埋めると誤った年齢が表示されます。
-- docs/DECISIONS.md §1 が「推測値で埋めないこと」と定めています。
-- 未入力の間、シーズン当時年齢は表示されません（ビューが NULL を返す）。
--
-- → 開幕日の投入は、出典を確認したうえで別途行います。
--   オーナーの確認が必要な項目として docs/SCHEMA.md に記載しています。
--
-- 対象は 2015-16 以降。10/4 公開のseedは現役選手が中心のため、
-- それ以前は必要になった時点で足します（足しても既存は壊れません）。
-- -----------------------------------------------------------------------------
insert into public.seasons (id, start_year, end_year, scheduled_games, is_shortened)
select
  format('%s-%s', y, lpad(((y + 1) % 100)::text, 2, '0')),
  y,
  y + 1,
  null, -- 予定試合数も事実なので入れない（短縮シーズンの判断に関わる）
  false
from generate_series(2015, 2025) as y
on conflict (id) do nothing;

comment on table public.seasons is
  'NBAのシーズン。開幕日と予定試合数は未入力（事実の投入は出典確認後に行う）。'
  '開幕日が入るまでシーズン当時年齢は表示されない。';

-- -----------------------------------------------------------------------------
-- ランキングの規定条件
--
-- プレーオフは「条件なし・全選手表示＋試合数明示」で確定している
-- （docs/DECISIONS.md §4）。minimum_* を全て NULL にした行がその意思表示になる。
-- 行が無くても条件なしとして扱われるが、明示的に置くことで
-- 「決め忘れ」ではなく「そう決めた」と分かるようにする。
--
-- レギュラーシーズンの具体的な数値は、W3-6（管理画面）で設定し、
-- W3-12 でオーナーが妥当性を確認する。ここでは条件なしで登録しておく。
-- 中途半端な数値を入れて「規定を満たしていない選手が消える」方が危険なため。
-- -----------------------------------------------------------------------------
insert into public.ranking_rules (season_id, metric_code, season_type, note_ja)
select
  null, -- 全シーズン共通の既定
  md.code,
  'playoff',
  'プレーオフは独自の最低条件を設けない。全選手を表示し、試合数を併記する（docs/DECISIONS.md §4）。'
from public.metric_definitions md
on conflict (season_id, metric_code, season_type) do nothing;

insert into public.ranking_rules (season_id, metric_code, season_type, note_ja)
select
  null,
  md.code,
  'regular',
  '最低条件は未設定。W3-6 の管理画面で設定し、W3-12 でオーナーが妥当性を確認する。'
from public.metric_definitions md
on conflict (season_id, metric_code, season_type) do nothing;

-- -----------------------------------------------------------------------------
-- 画像ライセンスの許可リスト
--
-- ここに載っていて is_allowed = true のライセンスの画像しか保存・表示しない。
-- 判断に迷うものは false のままにする（表示しない方に倒す）。
-- -----------------------------------------------------------------------------
insert into public.image_licenses (code, name_en, requires_attribution, is_allowed, note_ja)
values
  ('CC0-1.0', 'CC0 1.0 Universal', false, true, 'パブリックドメイン相当。クレジット表示は任意。'),
  ('CC-BY-4.0', 'Creative Commons Attribution 4.0', true, true, 'クレジット表示が必須。'),
  ('CC-BY-SA-4.0', 'Creative Commons Attribution-ShareAlike 4.0', true, true, 'クレジット表示が必須。'),
  ('CC-BY-3.0', 'Creative Commons Attribution 3.0', true, true, 'クレジット表示が必須。'),
  ('CC-BY-SA-3.0', 'Creative Commons Attribution-ShareAlike 3.0', true, true, 'クレジット表示が必須。'),
  -- 以下は使わない。判断に迷うものは表示しない方に倒す。
  ('CC-BY-NC', 'Creative Commons NonCommercial', true, false, '非商用限定のため使用しない。'),
  ('CC-BY-ND', 'Creative Commons NoDerivatives', true, false, '改変不可のため使用しない（サムネイル生成が改変にあたる）。'),
  ('UNKNOWN', 'ライセンス不明', true, false, '不明なものは使用しない。')
on conflict (code) do update set
  name_en = excluded.name_en,
  requires_attribution = excluded.requires_attribution,
  is_allowed = excluded.is_allowed,
  note_ja = excluded.note_ja;
