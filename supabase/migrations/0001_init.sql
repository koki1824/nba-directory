-- =============================================================================
-- 0001_init.sql — 初期スキーマ（全21テーブル）
--
-- 方針（開発方針オーバーライド v3 §0.1「仮枠を作らない」）:
--   10/4 の公開で使わないテーブル（favorites / page_seo / inquiries 等）も
--   ここで一緒に作る。後から足すときにマイグレーションが破壊的にならないようにするため。
--
-- 設計上の重要な決定:
--   1. 率（FG% など）は保存せず、made / attempted の実数だけを保存する。
--      率はビュー（W1-6）で計算する。こうすると「試投0本」を
--      「0%」ではなく「算出不可」として区別できる（オーバーライド §8）。
--   2. チーム成績は team_season_stats に公式値を保存する。
--      個人成績の合計で代用しない（要件定義書）。
--   3. シーズン途中の移籍は stints で分割する。
--      player_season_stats は stint 単位で持ち、シーズン合計はビューで作る。
--   4. 手動修正は manual_overrides に別建てで持つ。元データを上書きしない。
--      同期が走っても手動修正が消えないようにするため（T7）。
--   5. Supabase 固有の auth スキーマに依存しない。
--      CI の素の PostgreSQL でも同じSQLが通るようにするため。
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 補助関数
-- -----------------------------------------------------------------------------

create schema if not exists app;

comment on schema app is 'アプリ用の補助関数を置く。テーブルは public に置く。';

-- ログイン中のユーザーIDを返す。Supabase では JWT から取れる。
-- 素の PostgreSQL では NULL を返すだけなので、CIでも同じSQLが通る。
create or replace function app.current_user_id() returns uuid
language sql
stable
as $$
  select nullif(current_setting('request.jwt.claims', true)::json ->> 'sub', '')::uuid;
$$;

comment on function app.current_user_id() is
  'ログイン中のユーザーID。Supabase外（CIの検証用DB等）では NULL を返す。';

-- 更新時刻を自動で入れるためのトリガ関数。
create or replace function app.touch_updated_at() returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- enum（取りうる値を型で固定する。文字列の打ち間違いを型で防ぐ）
-- -----------------------------------------------------------------------------

-- レギュラーシーズンとプレーオフは、データ・表示・ランキング判定すべてで分離する。
create type season_type as enum ('regular', 'playoff');

create type position_code as enum ('G', 'F', 'C', 'G-F', 'F-G', 'F-C', 'C-F');

-- 選手名の日本語表記が、どこまで確からしいか。
-- 未決定の Q4（全件方針）がどう決まっても、この列で受けられる。
create type name_ja_state as enum (
  'unset', -- 未設定。英語名で表示する
  'machine', -- 機械的に変換した。誤変換がありうる
  'human_verified' -- 人が確認した
);

-- 画像の審査状態。人物一致の確認はAIに任せられないため、必ず人の承認を通す。
create type image_review_state as enum ('pending', 'approved', 'rejected');

-- 同期処理の実行結果。
create type sync_status as enum ('running', 'succeeded', 'failed', 'cancelled');

-- 手動修正の対象。どのテーブルの値を上書きしたかを型で縛る。
create type override_target as enum ('player', 'team', 'player_season_stats', 'team_season_stats');

-- 問い合わせの窓口（要件定義書の4窓口）。
create type inquiry_category as enum ('ad_sponsorship', 'general', 'bug', 'rights_correction');

-- =============================================================================
-- 1. seasons — シーズン
-- =============================================================================
create table public.seasons (
  id text primary key, -- '2024-25' 形式。人が読めるIDを主キーにする
  start_year smallint not null,
  end_year smallint not null,

  -- レギュラーシーズンの開幕日。
  -- 【重要】シーズン当時の年齢はこの日を基準に計算する（docs/DECISIONS.md §1）。
  -- ロックアウトやパンデミックで変則だった年があるため、推測で埋めないこと。
  -- 未取得のシーズンは NULL のままにし、年齢を表示しない。
  regular_season_start_date date,

  -- 短縮シーズンでランキングの規定試合数を比例配分するために使う（W3-10）。
  scheduled_games smallint,
  is_shortened boolean not null default false,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint seasons_years_ordered check (end_year = start_year + 1),
  constraint seasons_scheduled_games_positive check (scheduled_games is null or scheduled_games > 0)
);

comment on table public.seasons is 'NBAのシーズン。開幕日は年齢計算の基準になるため必ず実データを入れる。';
comment on column public.seasons.regular_season_start_date is
  'レギュラーシーズン開幕日。シーズン当時年齢の基準日。未取得なら NULL（推測で埋めない）。';

-- =============================================================================
-- 2. franchises — フランチャイズ（球団の継続体）
-- =============================================================================
-- チーム名や本拠地が変わっても、球団としては同じものを指す。
-- 「年代別ロスター」で過去の名称を正しく出すために、名称と分けて持つ。
create table public.franchises (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique, -- URLに使う。'lakers' など
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.franchises is
  '球団の継続体。移転・改称してもここは変わらない。名称の履歴は teams に持つ。';

-- =============================================================================
-- 3. teams — チーム（フランチャイズの、ある期間の名称）
-- =============================================================================
create table public.teams (
  id uuid primary key default gen_random_uuid(),
  franchise_id uuid not null references public.franchises (id) on delete restrict,

  name_en text not null, -- 'Los Angeles Lakers'
  name_ja text, -- 'ロサンゼルス・レイカーズ'
  abbreviation text not null, -- 'LAL'
  city_en text,
  city_ja text,
  conference text,
  division text,

  -- この名称が有効だった期間。改称・移転すると新しい行を足す。
  effective_from_season_id text references public.seasons (id) on delete restrict,
  effective_to_season_id text references public.seasons (id) on delete restrict,

  -- 画像が無い選手の代替表示に使う（W5-4）。公式ロゴは使わない。
  primary_color text,
  secondary_color text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint teams_color_is_hex check (
    (primary_color is null or primary_color ~ '^#[0-9A-Fa-f]{6}$')
    and (secondary_color is null or secondary_color ~ '^#[0-9A-Fa-f]{6}$')
  )
);

create index teams_franchise_idx on public.teams (franchise_id);
create index teams_abbreviation_idx on public.teams (abbreviation);

comment on table public.teams is
  'チーム名の履歴。フランチャイズ1つに対し、改称・移転のたびに行が増える。';

-- =============================================================================
-- 4. players — 選手
-- =============================================================================
create table public.players (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique, -- URLに使う

  full_name_en text not null,
  first_name_en text,
  last_name_en text,

  -- 日本語（カタカナ）表記。全件をどう用意するかは Q4 として未決定（期限 Week 3）。
  -- どの結論になっても、この2列で受けられるので作り直しは起きない。
  full_name_ja text,
  name_ja_state name_ja_state not null default 'unset',

  birth_date date,
  height_cm smallint,
  weight_kg smallint,
  country text,
  position position_code,
  jersey_number smallint, -- 画像が無いときの代替表示に使う（W5-4）

  draft_year smallint,
  draft_round smallint,
  draft_pick smallint,

  is_active boolean not null default true,
  -- 引退選手の代表チーム。決定アルゴリズムは［保留］なので、当面は手動で入れる。
  representative_franchise_id uuid references public.franchises (id) on delete set null,

  -- 画像取得の照合に使う（W5-1）。
  wikidata_qid text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint players_height_sane check (height_cm is null or (height_cm between 120 and 260)),
  constraint players_weight_sane check (weight_kg is null or (weight_kg between 40 and 200)),
  constraint players_draft_round_sane check (draft_round is null or draft_round between 1 and 10)
);

create index players_is_active_idx on public.players (is_active);
create index players_full_name_en_idx on public.players (full_name_en);
create index players_full_name_ja_idx on public.players (full_name_ja);
-- 同姓同名の確認に使う（W3-3 / W4-6）。
create index players_name_birth_idx on public.players (full_name_en, birth_date);

comment on column public.players.name_ja_state is
  '日本語表記の確からしさ。human_verified 以外は表示時に注意が要る。';

-- =============================================================================
-- 5. stints — 在籍期間（シーズン途中の移籍をここで分割する）
-- =============================================================================
create table public.stints (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.players (id) on delete cascade,
  season_id text not null references public.seasons (id) on delete restrict,
  team_id uuid not null references public.teams (id) on delete restrict,

  -- 同一シーズン内で複数チームに在籍した場合の順番。1から始まる。
  stint_order smallint not null default 1,

  started_on date,
  ended_on date,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint stints_order_positive check (stint_order >= 1),
  constraint stints_dates_ordered check (
    started_on is null or ended_on is null or started_on <= ended_on
  ),
  -- 同じ選手・シーズン・順番の重複を防ぐ。
  constraint stints_unique_order unique (player_id, season_id, stint_order)
);

create index stints_player_season_idx on public.stints (player_id, season_id);
create index stints_team_season_idx on public.stints (team_id, season_id);

comment on table public.stints is
  'シーズン内の在籍期間。途中移籍した選手は複数行になる。'
  'チーム別の成績を正しく出すために、成績はこの単位で持つ。';

-- =============================================================================
-- 6. player_season_stats — 選手のシーズン成績
-- =============================================================================
-- 【重要】率（FG% など）は保存しない。made / attempted の実数だけを保存する。
-- 率はビューで計算する。そうしないと「試投0本」を 0% と区別できない。
create table public.player_season_stats (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.players (id) on delete cascade,
  season_id text not null references public.seasons (id) on delete restrict,
  season_type season_type not null,
  -- NULL ならシーズン合計、値があればそのチームでの成績。
  stint_id uuid references public.stints (id) on delete cascade,

  games_played smallint,
  games_started smallint,
  minutes numeric(7, 1),

  field_goals_made integer,
  field_goals_attempted integer,
  three_pointers_made integer,
  three_pointers_attempted integer,
  free_throws_made integer,
  free_throws_attempted integer,

  offensive_rebounds integer,
  defensive_rebounds integer,
  assists integer,
  steals integer,
  blocks integer,
  turnovers integer,
  personal_fouls integer,
  points integer,

  -- 高度指標。プロバイダによっては取得できない（Q2）。
  -- 取得できない場合は NULL のままにし、画面では列ごと出さない。
  box_plus_minus numeric(5, 2),
  value_over_replacement numeric(5, 2),

  source_id uuid, -- data_sources を参照（下で外部キーを付ける）
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- 実数は負にならない。異常値を型で弾く。
  constraint pss_counts_non_negative check (
    coalesce(games_played, 0) >= 0
    and coalesce(field_goals_made, 0) >= 0
    and coalesce(field_goals_attempted, 0) >= 0
    and coalesce(points, 0) >= 0
  ),
  -- 成功数が試投数を超えることはない。データの取り違えをここで止める。
  constraint pss_made_not_over_attempted check (
    (field_goals_made is null or field_goals_attempted is null
      or field_goals_made <= field_goals_attempted)
    and (three_pointers_made is null or three_pointers_attempted is null
      or three_pointers_made <= three_pointers_attempted)
    and (free_throws_made is null or free_throws_attempted is null
      or free_throws_made <= free_throws_attempted)
  ),
  constraint pss_started_not_over_played check (
    games_started is null or games_played is null or games_started <= games_played
  )
);

-- シーズン合計行（stint_id が NULL）は、選手・シーズン・種別ごとに1行だけ。
create unique index pss_season_total_unique
  on public.player_season_stats (player_id, season_id, season_type)
  where stint_id is null;

-- チーム別の行は stint ごとに1行だけ。
create unique index pss_stint_unique
  on public.player_season_stats (stint_id, season_type)
  where stint_id is not null;

create index pss_season_lookup_idx on public.player_season_stats (season_id, season_type);
create index pss_player_idx on public.player_season_stats (player_id);

comment on table public.player_season_stats is
  '選手のシーズン成績。率は保存せず実数のみ持つ（試投0本と0%を区別するため）。'
  'stint_id が NULL の行がシーズン合計、値がある行がチーム別。';

-- =============================================================================
-- 7. team_season_stats — チームのシーズン成績（公式値）
-- =============================================================================
-- 【重要】個人成績の合計で代用しない。公式に発表された値だけを入れる。
create table public.team_season_stats (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams (id) on delete restrict,
  season_id text not null references public.seasons (id) on delete restrict,
  season_type season_type not null,

  games_played smallint,
  wins smallint,
  losses smallint,

  points_for integer,
  points_against integer,
  field_goals_made integer,
  field_goals_attempted integer,
  three_pointers_made integer,
  three_pointers_attempted integer,
  free_throws_made integer,
  free_throws_attempted integer,
  offensive_rebounds integer,
  defensive_rebounds integer,
  assists integer,
  steals integer,
  blocks integer,
  turnovers integer,

  source_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint tss_unique unique (team_id, season_id, season_type),
  constraint tss_record_matches_games check (
    games_played is null or wins is null or losses is null or wins + losses = games_played
  )
);

create index tss_season_idx on public.team_season_stats (season_id, season_type);

comment on table public.team_season_stats is
  'チームの公式シーズン成績。個人成績の合計で代用してはならない（要件定義書）。';

-- =============================================================================
-- 8. awards — 賞の定義
-- =============================================================================
create table public.awards (
  id uuid primary key default gen_random_uuid(),
  code text not null unique, -- 'MVP', 'DPOY' など
  name_en text not null,
  name_ja text,
  description_ja text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- =============================================================================
-- 9. player_awards — 選手の受賞歴
-- =============================================================================
create table public.player_awards (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.players (id) on delete cascade,
  award_id uuid not null references public.awards (id) on delete restrict,
  season_id text not null references public.seasons (id) on delete restrict,
  source_id uuid,
  created_at timestamptz not null default now(),

  constraint player_awards_unique unique (player_id, award_id, season_id)
);

create index player_awards_player_idx on public.player_awards (player_id);

-- =============================================================================
-- 10. metric_definitions — 指標の定義
-- =============================================================================
-- 表示名・小数桁・「大きい方が良いか」を1箇所で持つ。
-- 画面ごとに書き分けると、同じ指標が違う桁数で出るなどの食い違いが起きる。
create table public.metric_definitions (
  code text primary key, -- 'pts', 'fg_pct' など
  name_ja text not null,
  name_en text not null,
  unit text, -- '%' など。無ければ NULL
  decimal_places smallint not null default 1,
  higher_is_better boolean not null default true,
  -- 率かどうか。率は試投0本のとき「算出不可」になる。
  is_rate boolean not null default false,
  -- 高度指標はプロバイダによって取得できない（Q2）。取得できなければ列ごと出さない。
  is_advanced boolean not null default false,
  display_order smallint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint metric_decimal_places_sane check (decimal_places between 0 and 3)
);

comment on table public.metric_definitions is
  '指標の表示ルール。桁数や「大きい方が良いか」をここに集約し、画面ごとに書き分けない。';

-- =============================================================================
-- 11. ranking_rules — ランキングの規定
-- =============================================================================
-- レギュラーシーズンとプレーオフで別の行を持つ。
-- プレーオフは独自の最低条件を設けない（docs/DECISIONS.md §4）ため、
-- minimum_* をすべて NULL にした行で「条件なし」を表す。
create table public.ranking_rules (
  id uuid primary key default gen_random_uuid(),
  season_id text references public.seasons (id) on delete cascade, -- NULL なら全シーズン共通の既定
  metric_code text not null references public.metric_definitions (code) on delete cascade,
  season_type season_type not null,

  minimum_games smallint,
  minimum_minutes numeric(7, 1),
  -- 「1試合あたり◯回」形式の規定（例: 得点王の規定試合数）。
  minimum_per_game numeric(7, 2),

  -- 規定未満でも、必要試合数で割ってなお首位なら対象にする公式例外（W3-10）。
  allows_official_exception boolean not null default false,

  note_ja text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint ranking_rules_unique unique (season_id, metric_code, season_type)
);

comment on table public.ranking_rules is
  'ランキングの規定到達条件。minimum_* が全て NULL なら「条件なし・全選手表示」。'
  'プレーオフは条件なしで運用する（docs/DECISIONS.md §4）。';

-- =============================================================================
-- 12. ranking_snapshots — 順位の記録（前シーズン比の表示用）
-- =============================================================================
-- 10/4 では表示しない（Q6）。スキーマだけ用意しておく。
create table public.ranking_snapshots (
  id uuid primary key default gen_random_uuid(),
  season_id text not null references public.seasons (id) on delete cascade,
  season_type season_type not null,
  metric_code text not null references public.metric_definitions (code) on delete cascade,
  player_id uuid references public.players (id) on delete cascade,
  team_id uuid references public.teams (id) on delete cascade,
  rank smallint not null,
  value numeric(10, 3),
  captured_on date not null default current_date,
  created_at timestamptz not null default now(),

  -- 選手かチームのどちらか一方だけを指す。
  constraint ranking_snapshots_subject check (
    (player_id is not null and team_id is null) or (player_id is null and team_id is not null)
  )
);

create index ranking_snapshots_lookup_idx
  on public.ranking_snapshots (season_id, season_type, metric_code, captured_on);

-- =============================================================================
-- 13. data_sources — データの出典
-- =============================================================================
-- 全ページに出典を表示する義務があるため（W4-9）、どの値がどこ由来かを追えるようにする。
create table public.data_sources (
  id uuid primary key default gen_random_uuid(),
  code text not null unique, -- 'balldontlie', 'seed', 'manual'
  name_ja text not null,
  url text,
  -- 出典表示の義務がある場合の表記。
  attribution_ja text,
  -- 自社DBへの永続保存が許諾されているか（W0-1 の確認結果を反映する）。
  persistence_allowed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on column public.data_sources.persistence_allowed is
  '自社DBへの永続保存が契約上許諾されているか。false のプロバイダから保存してはならない。';

-- 成績テーブルから出典への外部キーを、ここで付ける（循環参照を避けるため後付け）。
alter table public.player_season_stats
  add constraint pss_source_fk foreign key (source_id) references public.data_sources (id) on delete set null;
alter table public.team_season_stats
  add constraint tss_source_fk foreign key (source_id) references public.data_sources (id) on delete set null;
alter table public.player_awards
  add constraint player_awards_source_fk foreign key (source_id) references public.data_sources (id) on delete set null;

-- =============================================================================
-- 14. provider_entity_ids — 外部IDと内部IDの対応
-- =============================================================================
-- プロバイダを乗り換えても内部IDを変えずに済むようにする。
-- 同姓同名の解決にも使う（W4-6）。
create table public.provider_entity_ids (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references public.data_sources (id) on delete cascade,
  entity_type text not null, -- 'player' | 'team' | 'season'
  internal_id text not null,
  provider_id text not null,
  created_at timestamptz not null default now(),

  constraint provider_entity_unique unique (source_id, entity_type, provider_id)
);

create index provider_entity_internal_idx on public.provider_entity_ids (entity_type, internal_id);

-- =============================================================================
-- 15. manual_overrides — 手動修正
-- =============================================================================
-- 【重要】元データを上書きしない。修正値を別に持ち、ビューで重ねる。
-- こうしないと、同期が走るたびに手動修正が消える（T7）。
create table public.manual_overrides (
  id uuid primary key default gen_random_uuid(),
  target override_target not null,
  target_id uuid not null, -- 対象の行のID
  column_name text not null,
  -- 値は型がまちまちなので文字列で持ち、ビューで各列の型にキャストする。
  value_text text,
  -- NULL を「意図的に空にした」として表現するためのフラグ。
  -- value_text が NULL なだけだと「未設定」と区別できない。
  is_null_override boolean not null default false,

  reason_ja text not null,
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint manual_overrides_unique unique (target, target_id, column_name)
);

create index manual_overrides_lookup_idx on public.manual_overrides (target, target_id);

comment on table public.manual_overrides is
  '手動修正。元データは書き換えず、ここに重ねる値を持つ。同期で修正が消えないようにするため。';

-- =============================================================================
-- 16. sync_runs — 同期の実行ログ
-- =============================================================================
create table public.sync_runs (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references public.data_sources (id) on delete cascade,
  status sync_status not null default 'running',

  -- 期間指定のbackfillに使う（W4-4）。
  target_season_from text references public.seasons (id) on delete set null,
  target_season_to text references public.seasons (id) on delete set null,

  started_at timestamptz not null default now(),
  finished_at timestamptz,
  records_read integer not null default 0,
  records_written integer not null default 0,
  error_message text,

  created_at timestamptz not null default now()
);

create index sync_runs_recent_idx on public.sync_runs (started_at desc);

-- =============================================================================
-- 17. image_licenses — 使用を許可するライセンスの一覧
-- =============================================================================
-- 許可リストに載っているライセンスの画像しか保存しない（要件定義書）。
create table public.image_licenses (
  code text primary key, -- 'CC-BY-SA-4.0' など
  name_en text not null,
  requires_attribution boolean not null default true,
  is_allowed boolean not null default false,
  note_ja text,
  created_at timestamptz not null default now()
);

comment on table public.image_licenses is
  '画像ライセンスの許可リスト。is_allowed が true のものだけ保存・表示してよい。';

-- =============================================================================
-- 18. player_images — 選手の画像
-- =============================================================================
create table public.player_images (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.players (id) on delete cascade,

  source_url text not null,
  storage_path text,
  license_code text references public.image_licenses (code) on delete restrict,
  author_text text,
  credit_text text,

  -- 人物が本人かどうかの確認は人が行う。AIの判定を承認扱いにしない。
  review_state image_review_state not null default 'pending',
  reviewed_by text,
  reviewed_at timestamptz,

  width smallint,
  height smallint,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index player_images_player_idx on public.player_images (player_id, review_state);
-- 承認済みの画像は選手あたり1枚だけにする。
create unique index player_images_one_approved
  on public.player_images (player_id)
  where review_state = 'approved';

comment on column public.player_images.review_state is
  '人物一致の確認状態。approved 以外は表示しない（代替表示を使う）。';

-- =============================================================================
-- 19. favorites — お気に入り（公開後の機能）
-- =============================================================================
-- 10/4 では使わない。スキーマだけ先に引いておく（オーバーライド §0.1）。
create table public.favorites (
  id uuid primary key default gen_random_uuid(),
  -- Supabase の auth.users を直接参照しない（CIの素のPostgreSQLでも通るようにするため）。
  user_id uuid not null,
  player_id uuid references public.players (id) on delete cascade,
  team_id uuid references public.teams (id) on delete cascade,
  created_at timestamptz not null default now(),

  constraint favorites_subject check (
    (player_id is not null and team_id is null) or (player_id is null and team_id is not null)
  ),
  constraint favorites_unique_player unique (user_id, player_id),
  constraint favorites_unique_team unique (user_id, team_id)
);

create index favorites_user_idx on public.favorites (user_id);

-- =============================================================================
-- 20. page_seo — ページごとのSEO制御
-- =============================================================================
create table public.page_seo (
  id uuid primary key default gen_random_uuid(),
  path text not null unique, -- '/players/xxx' など
  should_index boolean not null default true,
  canonical_path text,
  title_override text,
  description_override text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.page_seo is
  'ページ単位の index/noindex と canonical。自動生成の比較ページを noindex にするために使う。';

-- =============================================================================
-- 21. inquiries — 問い合わせ
-- =============================================================================
-- 運用はメール転送のみ（Q9）。本文はDBに保存せず、送信の記録だけを残す。
create table public.inquiries (
  id uuid primary key default gen_random_uuid(),
  category inquiry_category not null,
  -- 本文と個人情報は保存しない。転送できたかどうかだけを記録する。
  forwarded_at timestamptz,
  forward_succeeded boolean,
  error_message text,
  created_at timestamptz not null default now()
);

create index inquiries_recent_idx on public.inquiries (created_at desc);

comment on table public.inquiries is
  '問い合わせの送信記録。本文や個人情報は保存しない（メール転送のみ運用・Q9）。';

-- =============================================================================
-- updated_at の自動更新
-- =============================================================================
do $$
declare
  t text;
begin
  foreach t in array array[
    'seasons', 'franchises', 'teams', 'players', 'stints',
    'player_season_stats', 'team_season_stats', 'awards',
    'metric_definitions', 'ranking_rules', 'data_sources',
    'manual_overrides', 'player_images', 'page_seo'
  ]
  loop
    execute format(
      'create trigger %I before update on public.%I for each row execute function app.touch_updated_at()',
      t || '_touch_updated_at', t
    );
  end loop;
end;
$$;

-- =============================================================================
-- 行レベルセキュリティ（RLS）
--
-- 方針: 既定は「全部拒否」。公開してよいものだけ読み取りを許す。
-- 書き込みは service role（RLSを迂回する鍵）からのみ行う。
-- ポリシーを1つも作らないテーブルは、匿名からは読めない。
-- =============================================================================

-- 公開してよいテーブル（サイトの表示に必要なもの）
do $$
declare
  t text;
begin
  foreach t in array array[
    'seasons', 'franchises', 'teams', 'players', 'stints',
    'player_season_stats', 'team_season_stats', 'awards', 'player_awards',
    'metric_definitions', 'ranking_rules', 'ranking_snapshots',
    'data_sources', 'image_licenses', 'page_seo'
  ]
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format(
      'create policy %I on public.%I for select using (true)',
      t || '_public_read', t
    );
  end loop;
end;
$$;

-- 画像は「承認済み」だけを公開する。審査中・却下は出さない。
alter table public.player_images enable row level security;
create policy player_images_public_read on public.player_images
  for select using (review_state = 'approved');

-- 運用系。匿名からは読めない（ポリシーを作らない = 全拒否）。
alter table public.manual_overrides enable row level security;
alter table public.sync_runs enable row level security;
alter table public.provider_entity_ids enable row level security;
alter table public.inquiries enable row level security;

-- お気に入りは本人のものだけ。
alter table public.favorites enable row level security;
create policy favorites_owner_select on public.favorites
  for select using (user_id = app.current_user_id());
create policy favorites_owner_insert on public.favorites
  for insert with check (user_id = app.current_user_id());
create policy favorites_owner_delete on public.favorites
  for delete using (user_id = app.current_user_id());
