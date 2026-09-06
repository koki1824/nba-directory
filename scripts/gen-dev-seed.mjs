#!/usr/bin/env node
/**
 * 開発用 seed データの生成（W2-1）。
 *
 *   node scripts/gen-dev-seed.mjs        → supabase/seed/dev_seed.sql を書き出す
 *   node scripts/gen-dev-seed.mjs --check → 既存ファイルと差があれば失敗する（CI用）
 *
 * 【これは公開されるデータではありません】
 * 選手・チームはすべて**架空**です。実在の人物や球団の記録ではありません。
 *
 * 理由（docs/DECISIONS.md §12）:
 * 実在選手の名前で数値を書くと、私が思い出した誤った数字を、実在の人物の
 * 記録として公開することになります。「サンプル」と断っても誤情報は誤情報です。
 * 公開する数値は Phase 3 でAPIから取得した実データを使います。
 * ここで作るのは、画面とテストを動かすための材料です。
 *
 * 【なぜ手書きせず生成するか】
 * 24名 × 3シーズン × 2種別 ぶんの数値を手で書くと、必ずどこかで
 * 「3P成功数がFG成功数を超える」「得点が内訳と合わない」といった
 * ありえない組み合わせが混ざる。それを画面で見て「バグだ」と誤解する時間が惜しい。
 * ここでは内訳から得点を計算して、常に辻褄が合う形で作る。
 *
 * 乱数は固定の種から作るので、何度実行しても同じ結果になる。
 * 生成物（dev_seed.sql）もコミットするので、差分がレビューできる。
 */

import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const OUT = join(here, "..", "supabase", "seed", "dev_seed.sql");

// --- 決まった乱数 -------------------------------------------------------------
// 毎回同じ結果になるように、種を固定した簡単な生成器を使う。
// Math.random() だと実行するたびに差分が出て、レビューできなくなる。
function makeRandom(seed) {
  let a = seed >>> 0;
  return function random() {
    a += 0x6d2b79f5;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rand = makeRandom(20261004);

/** min以上max以下の整数 */
function int(min, max) {
  return Math.floor(rand() * (max - min + 1)) + min;
}

/** 決まった形のUUID。種類ごとに接頭辞を変えて読みやすくする。 */
function uuid(kind, n) {
  const prefix = { franchise: "f1", team: "70", player: "b1", stint: "50" }[kind];
  return `${prefix}000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
}

function sqlText(v) {
  if (v === null || v === undefined) return "null";
  return `'${String(v).replace(/'/g, "''")}'`;
}

function sqlNum(v) {
  return v === null || v === undefined ? "null" : String(v);
}

// --- 対象シーズン -------------------------------------------------------------
// 0003_reference_seed.sql で登録済みのシーズンを使う。
const SEASONS = ["2022-23", "2023-24", "2024-25"];

// --- チーム -------------------------------------------------------------------
// すべて架空。実在の球団名・略称と重ならないようにしている。
const TEAMS = [
  {
    n: 1,
    slug: "dev-harbor-anchors",
    nameEn: "Harbor City Anchors",
    nameJa: "ハーバーシティ・アンカーズ",
    abbr: "HCA",
    cityEn: "Harbor City",
    cityJa: "ハーバーシティ",
    conference: "East",
    division: "Atlantic",
    primary: "#1E4E8C",
    secondary: "#0F1D2D",
    // プレーオフに出た年。出ていない年はPOの行を作らない（N/A の検証用）
    playoffSeasons: ["2022-23", "2023-24", "2024-25"],
  },
  {
    n: 2,
    slug: "dev-summit-foxes",
    nameEn: "Summit Ridge Foxes",
    nameJa: "サミットリッジ・フォクシーズ",
    abbr: "SRF",
    cityEn: "Summit Ridge",
    cityJa: "サミットリッジ",
    conference: "West",
    division: "Pacific",
    primary: "#B23A2E",
    secondary: "#8A5E14",
    playoffSeasons: ["2022-23", "2024-25"],
  },
  {
    n: 3,
    slug: "dev-prairie-bison",
    nameEn: "Prairie Falls Bison",
    nameJa: "プレーリーフォールズ・バイソン",
    abbr: "PFB",
    cityEn: "Prairie Falls",
    cityJa: "プレーリーフォールズ",
    conference: "West",
    division: "Northwest",
    primary: "#2E6B5A",
    secondary: "#0F1D2D",
    playoffSeasons: ["2024-25"],
  },
  {
    n: 4,
    slug: "dev-delta-herons",
    nameEn: "Delta Bay Herons",
    nameJa: "デルタベイ・ヘロンズ",
    abbr: "DBH",
    cityEn: "Delta Bay",
    cityJa: "デルタベイ",
    conference: "East",
    division: "Southeast",
    primary: "#8A5E14",
    secondary: "#5D6570",
    // 一度もプレーオフに出ていない。所属選手のPO欄は「該当なし」になる
    playoffSeasons: [],
  },
];

// --- 選手 ---------------------------------------------------------------------
//
// role が数値の出方を決める:
//   star     … 主力。出場時間が長く、得点も多い
//   starter  … 先発
//   rotation … 控え
//   bench    … 出場機会が少ない
//
// flags で境界ケースを作る:
//   traded        … 2023-24 にシーズン途中で移籍（stintで分割）
//   missingBox    … 2022-23 のスティール・ブロック・ターンオーバーが未取得（NULL）
//   noAttempts    … 2024-25 に一本もシュートを打っていない（FG%は算出不可）
//   zeroGames     … 2023-24 は出場0試合（1試合平均は算出不可）
//   rookieIn      … このシーズンからプロ入り。それ以前の行を作らない
const PLAYERS = [
  // Harbor City Anchors
  {
    n: 1,
    first: "Marcus",
    last: "Hollowell",
    ja: "マーカス・ホロウェル",
    jaState: "human_verified",
    team: 1,
    pos: "G",
    role: "star",
    height: 193,
    weight: 88,
    birth: "1996-03-14",
    jersey: 7,
    draft: [2018, 1, 4],
  },
  {
    n: 2,
    first: "Andre",
    last: "Kestrel",
    ja: "アンドレ・ケストレル",
    jaState: "human_verified",
    team: 1,
    pos: "F",
    role: "star",
    height: 206,
    weight: 104,
    birth: "1994-11-02",
    jersey: 21,
    draft: [2016, 1, 9],
  },
  {
    n: 3,
    first: "Tobias",
    last: "Vance",
    ja: "トバイアス・ヴァンス",
    jaState: "machine",
    team: 1,
    pos: "C",
    role: "starter",
    height: 213,
    weight: 118,
    birth: "1997-06-28",
    jersey: 33,
    draft: [2019, 1, 22],
  },
  {
    n: 4,
    first: "Ellis",
    last: "Nakamura",
    ja: "エリス・ナカムラ",
    jaState: "human_verified",
    team: 1,
    pos: "G-F",
    role: "rotation",
    height: 198,
    weight: 95,
    birth: "1999-01-19",
    jersey: 12,
    draft: [2021, 2, 41],
  },
  {
    n: 5,
    first: "Roman",
    last: "Petrov",
    ja: null,
    jaState: "unset",
    team: 1,
    pos: "F-C",
    role: "rotation",
    height: 208,
    weight: 110,
    birth: "1998-09-05",
    jersey: 44,
    draft: [2020, 2, 38],
  },
  {
    n: 6,
    first: "Kai",
    last: "Brennan",
    ja: "カイ・ブレナン",
    jaState: "machine",
    team: 1,
    pos: "G",
    role: "bench",
    height: 188,
    weight: 82,
    birth: "2002-04-23",
    jersey: 3,
    draft: [2023, 2, 52],
    flags: ["noAttempts"],
  },

  // Summit Ridge Foxes
  {
    n: 7,
    first: "Dante",
    last: "Okafor",
    ja: "ダンテ・オカフォー",
    jaState: "human_verified",
    team: 2,
    pos: "F",
    role: "star",
    height: 203,
    weight: 101,
    birth: "1995-07-11",
    jersey: 23,
    draft: [2017, 1, 2],
  },
  {
    n: 8,
    first: "Silas",
    last: "Marchetti",
    ja: "サイラス・マルケッティ",
    jaState: "machine",
    team: 2,
    pos: "G",
    role: "starter",
    height: 190,
    weight: 84,
    birth: "1997-12-30",
    jersey: 11,
    draft: [2019, 1, 17],
  },
  {
    n: 9,
    first: "Bo",
    last: "Whitfield",
    ja: "ボー・ホイットフィールド",
    jaState: "human_verified",
    team: 2,
    pos: "C",
    role: "starter",
    height: 211,
    weight: 121,
    birth: "1993-02-17",
    jersey: 55,
    draft: [2015, 1, 12],
    flags: ["missingBox"],
  },
  {
    n: 10,
    first: "Ruben",
    last: "Castellanos",
    ja: "ルーベン・カステジャーノス",
    jaState: "machine",
    team: 2,
    pos: "F-G",
    role: "rotation",
    height: 199,
    weight: 97,
    birth: "2000-08-08",
    jersey: 8,
    draft: [2022, 1, 26],
  },
  {
    n: 11,
    first: "Idris",
    last: "Vaughn",
    ja: null,
    jaState: "unset",
    team: 2,
    pos: "G",
    role: "rotation",
    height: 185,
    weight: 79,
    birth: "1998-05-25",
    jersey: 5,
    draft: [2020, 2, 45],
  },
  {
    n: 12,
    first: "Devon",
    last: "Kestrel",
    ja: "デヴォン・ケストレル",
    jaState: "human_verified",
    team: 2,
    pos: "F",
    role: "bench",
    height: 201,
    weight: 99,
    birth: "2001-10-13",
    jersey: 30,
    draft: [2023, 1, 28],
    rookieIn: "2023-24",
  },

  // Prairie Falls Bison
  {
    n: 13,
    first: "Nikolai",
    last: "Brandt",
    ja: "ニコライ・ブラント",
    jaState: "machine",
    team: 3,
    pos: "C",
    role: "star",
    height: 215,
    weight: 124,
    birth: "1996-01-30",
    jersey: 41,
    draft: [2018, 1, 6],
  },
  {
    n: 14,
    first: "Jonah",
    last: "Reyes",
    ja: "ジョナ・レイエス",
    jaState: "human_verified",
    team: 3,
    pos: "G",
    role: "starter",
    height: 191,
    weight: 86,
    birth: "1999-03-03",
    jersey: 2,
    draft: [2021, 1, 19],
  },
  {
    n: 15,
    first: "Amari",
    last: "Lindqvist",
    ja: "アマリ・リンドクヴィスト",
    jaState: "machine",
    team: 3,
    pos: "F",
    role: "starter",
    height: 204,
    weight: 100,
    birth: "1997-11-27",
    jersey: 15,
    draft: [2019, 2, 35],
    flags: ["traded"],
  },
  {
    n: 16,
    first: "Cyrus",
    last: "Delacroix",
    ja: null,
    jaState: "unset",
    team: 3,
    pos: "F-C",
    role: "rotation",
    height: 209,
    weight: 112,
    birth: "1995-06-09",
    jersey: 24,
    draft: [2017, 2, 44],
  },
  {
    n: 17,
    first: "Theo",
    last: "Balogun",
    ja: "テオ・バログン",
    jaState: "human_verified",
    team: 3,
    pos: "G-F",
    role: "rotation",
    height: 196,
    weight: 92,
    birth: "2000-12-01",
    jersey: 9,
    draft: [2022, 2, 39],
  },
  {
    n: 18,
    first: "Marcus",
    last: "Hollowell",
    ja: "マーカス・ホロウェル",
    jaState: "human_verified",
    team: 3,
    pos: "F",
    role: "bench",
    height: 200,
    weight: 98,
    birth: "2001-05-16",
    jersey: 32,
    draft: [2023, 2, 48],
    rookieIn: "2023-24",
  },

  // Delta Bay Herons（一度もプレーオフに出ていない）
  {
    n: 19,
    first: "Rashad",
    last: "Emerson",
    ja: "ラシャド・エマーソン",
    jaState: "human_verified",
    team: 4,
    pos: "G",
    role: "star",
    height: 189,
    weight: 83,
    birth: "1998-02-21",
    jersey: 1,
    draft: [2020, 1, 8],
  },
  {
    n: 20,
    first: "Viktor",
    last: "Halloran",
    ja: "ヴィクター・ハロラン",
    jaState: "machine",
    team: 4,
    pos: "F",
    role: "starter",
    height: 205,
    weight: 103,
    birth: "1996-10-04",
    jersey: 17,
    draft: [2018, 1, 14],
  },
  {
    n: 21,
    first: "Emeka",
    last: "Sorensen",
    ja: "エメカ・ソレンセン",
    jaState: "machine",
    team: 4,
    pos: "C",
    role: "starter",
    height: 212,
    weight: 119,
    birth: "1994-04-12",
    jersey: 50,
    draft: [2016, 2, 37],
    flags: ["zeroGames"],
  },
  {
    n: 22,
    first: "Luca",
    last: "Fontaine",
    ja: "ルカ・フォンテーヌ",
    jaState: "human_verified",
    team: 4,
    pos: "G",
    role: "rotation",
    height: 187,
    weight: 80,
    birth: "2001-07-07",
    jersey: 6,
    draft: [2023, 1, 20],
    rookieIn: "2023-24",
  },
  {
    n: 23,
    first: "Osmond",
    last: "Achebe",
    ja: null,
    jaState: "unset",
    team: 4,
    pos: "F",
    role: "rotation",
    height: 202,
    weight: 96,
    birth: "1999-09-18",
    jersey: 28,
    draft: [2021, 2, 50],
    flags: ["traded"],
  },
  {
    n: 24,
    first: "Peter",
    last: "Vance",
    ja: "ピーター・ヴァンス",
    jaState: "machine",
    team: 4,
    pos: "F-C",
    role: "bench",
    height: 207,
    weight: 108,
    birth: "2002-01-26",
    jersey: 40,
    draft: [2024, 2, 55],
    rookieIn: "2024-25",
  },
];

/** 移籍先。traded の選手が 2023-24 の途中で移る先。 */
const TRADE_DESTINATION = { 15: 1, 23: 2 };

// --- 成績の作り方 -------------------------------------------------------------

const ROLE_SHAPE = {
  star: { minPerGame: [33, 37], usage: [0.29, 0.34], games: [65, 78] },
  starter: { minPerGame: [27, 32], usage: [0.21, 0.26], games: [60, 76] },
  rotation: { minPerGame: [17, 24], usage: [0.15, 0.2], games: [50, 72] },
  bench: { minPerGame: [7, 14], usage: [0.11, 0.16], games: [22, 48] },
};

/**
 * 1シーズンぶんの実数を作る。
 *
 * 【必ず守る関係】
 *   3P成功 ≤ FG成功        3Pは FG の内数
 *   成功  ≤ 試投            すべての種類で
 *   得点 = 2×FG成功 + 3P成功 + FT成功
 *          （2点×FG成功 に、3Pぶんの1点を足し、FTを足す）
 * ここを崩すと、画面で見たときに「バグだ」と誤解する時間が無駄になる。
 */
function makeLine(role, games, playoff = false) {
  const shape = ROLE_SHAPE[role];
  const minPerGame = shape.minPerGame[0] + rand() * (shape.minPerGame[1] - shape.minPerGame[0]);
  // プレーオフは出場時間が伸びる
  const minutes = Math.round(games * minPerGame * (playoff ? 1.08 : 1) * 10) / 10;

  const fga = Math.round(
    games * (shape.usage[0] + rand() * (shape.usage[1] - shape.usage[0])) * 60,
  );
  const fgPct = 0.41 + rand() * 0.12;
  const fgm = Math.min(fga, Math.round(fga * fgPct));

  // 3P試投は FG試投の一部。ビッグマンは少なく、ガードは多い、といった差は
  // ここでは付けず、幅で散らす（画面の検証には十分）。
  const tpa = Math.round(fga * (0.1 + rand() * 0.45));
  const tpPct = 0.29 + rand() * 0.12;
  const tpm = Math.min(tpa, fgm, Math.round(tpa * tpPct));

  const fta = Math.round(fga * (0.15 + rand() * 0.25));
  const ftPct = 0.68 + rand() * 0.22;
  const ftm = Math.min(fta, Math.round(fta * ftPct));

  const points = 2 * fgm + tpm + ftm;

  const oreb = Math.round(games * (0.4 + rand() * 2.2));
  const dreb = Math.round(games * (1.8 + rand() * 5.2));

  return {
    games_played: games,
    games_started: Math.min(
      games,
      Math.round(
        games * (role === "star" || role === "starter" ? 0.95 : role === "rotation" ? 0.2 : 0.05),
      ),
    ),
    minutes,
    field_goals_made: fgm,
    field_goals_attempted: fga,
    three_pointers_made: tpm,
    three_pointers_attempted: tpa,
    free_throws_made: ftm,
    free_throws_attempted: fta,
    offensive_rebounds: oreb,
    defensive_rebounds: dreb,
    assists: Math.round(games * (0.8 + rand() * 6)),
    steals: Math.round(games * (0.3 + rand() * 1.4)),
    blocks: Math.round(games * (0.1 + rand() * 1.6)),
    turnovers: Math.round(games * (0.6 + rand() * 2.6)),
    personal_fouls: Math.round(games * (1.2 + rand() * 2)),
    points,
  };
}

/** 2つの成績行を足す。stintに分けた行からシーズン合計を作るために使う。 */
function addLines(a, b) {
  const out = {};
  for (const key of Object.keys(a)) {
    out[key] = Math.round((a[key] + b[key]) * 10) / 10;
  }
  return out;
}

const STAT_COLUMNS = [
  "games_played",
  "games_started",
  "minutes",
  "field_goals_made",
  "field_goals_attempted",
  "three_pointers_made",
  "three_pointers_attempted",
  "free_throws_made",
  "free_throws_attempted",
  "offensive_rebounds",
  "defensive_rebounds",
  "assists",
  "steals",
  "blocks",
  "turnovers",
  "personal_fouls",
  "points",
];

function statValues(line) {
  return STAT_COLUMNS.map((c) => sqlNum(line[c] ?? null)).join(", ");
}

// --- 組み立て -----------------------------------------------------------------

function build() {
  const out = [];
  const teamById = new Map(TEAMS.map((t) => [t.n, t]));

  out.push(`-- =============================================================================
-- dev_seed.sql — 開発用の材料（W2-1）
--
-- ⚠️ **選手もチームもすべて架空です。実在の人物・球団の記録ではありません。**
--
-- 公開する数値は Phase 3 でAPIから取得した実データを使います
-- （docs/DECISIONS.md §12）。このファイルは画面とテストを動かすためのもので、
-- 本番に入れる必要はありません。実データが間に合わなかった場合の退避先も兼ねます。
--
-- 【編集しないでください】
-- scripts/gen-dev-seed.mjs が生成しています。直すときは生成器を直して
--   node scripts/gen-dev-seed.mjs
-- を実行してください。CIが生成物との差分を検査します。
--
-- 【入っている境界ケース】
--   ・シーズン途中の移籍（stintで分割。合計行とstint行の両方がある）
--   ・同一選手の複数シーズン
--   ・欠損（スティール等がNULLのシーズン / 一本も打っていない / 出場0試合）
--   ・レギュラーとプレーオフの両方がある選手
--   ・一度もプレーオフに出ていないチームの選手（PO欄は「該当なし」になる）
--   ・同姓同名（Marcus Hollowell が2人）と同姓（Kestrel / Vance が2人ずつ）
--   ・日本語名の状態3種（未設定 / 機械 / 人手確認済み）
--   ・手動修正が入った選手（元データは書き換わらないことの確認用）
-- =============================================================================

-- 何度実行しても同じ結果になるよう、dev の行だけ消してから入れ直す。
-- slug が 'dev-' で始まるものだけが対象なので、実データには触れない。
delete from public.player_season_stats
 where player_id in (select id from public.players where slug like 'dev-%');
delete from public.manual_overrides
 where target = 'player'
   and target_id in (select id from public.players where slug like 'dev-%');
delete from public.stints
 where player_id in (select id from public.players where slug like 'dev-%');
delete from public.players where slug like 'dev-%';
delete from public.team_season_stats
 where team_id in (
   select t.id from public.teams t
    join public.franchises f on f.id = t.franchise_id
   where f.slug like 'dev-%'
 );
delete from public.teams
 where franchise_id in (select id from public.franchises where slug like 'dev-%');
delete from public.franchises where slug like 'dev-%';
`);

  // --- フランチャイズとチーム ---
  out.push("\n-- フランチャイズ（架空）");
  out.push("insert into public.franchises (id, slug) values");
  out.push(
    TEAMS.map((t) => `  ('${uuid("franchise", t.n)}', ${sqlText(t.slug)})`).join(",\n") + ";",
  );

  out.push("\n-- チーム（架空）");
  out.push(
    "insert into public.teams (id, franchise_id, name_en, name_ja, abbreviation, city_en, city_ja, conference, division, primary_color, secondary_color) values",
  );
  out.push(
    TEAMS.map(
      (t) =>
        `  ('${uuid("team", t.n)}', '${uuid("franchise", t.n)}', ${sqlText(t.nameEn)}, ${sqlText(t.nameJa)}, ${sqlText(t.abbr)}, ${sqlText(t.cityEn)}, ${sqlText(t.cityJa)}, ${sqlText(t.conference)}, ${sqlText(t.division)}, ${sqlText(t.primary)}, ${sqlText(t.secondary)})`,
    ).join(",\n") + ";",
  );

  // --- 選手 ---
  out.push("\n-- 選手（架空）");
  out.push(
    "insert into public.players (id, slug, full_name_en, first_name_en, last_name_en, full_name_ja, name_ja_state, birth_date, height_cm, weight_kg, country, position, jersey_number, draft_year, draft_round, draft_pick, is_active, representative_franchise_id) values",
  );
  out.push(
    PLAYERS.map((p) => {
      const [dy, dr, dp] = p.draft;
      // 同姓同名がいるので slug は名前だけだと衝突する。番号を付けて必ず一意にする。
      const slug = `dev-${p.first}-${p.last}-${p.n}`.toLowerCase();
      return `  ('${uuid("player", p.n)}', ${sqlText(slug)}, ${sqlText(`${p.first} ${p.last}`)}, ${sqlText(p.first)}, ${sqlText(p.last)}, ${sqlText(p.ja)}, ${sqlText(p.jaState)}, ${sqlText(p.birth)}, ${p.height}, ${p.weight}, ${sqlText("—")}, ${sqlText(p.pos)}, ${p.jersey}, ${dy}, ${dr}, ${dp}, true, '${uuid("franchise", p.team)}')`;
    }).join(",\n") + ";",
  );

  // --- 在籍（stints）と成績 ---
  const stintRows = [];
  const statRows = [];
  let stintSeq = 0;

  for (const p of PLAYERS) {
    const flags = p.flags ?? [];

    for (const season of SEASONS) {
      // プロ入り前のシーズンは行を作らない
      if (p.rookieIn && season < p.rookieIn) continue;

      const homeTeam = teamById.get(p.team);
      const isTradeSeason = flags.includes("traded") && season === "2023-24";

      // 出場0試合のシーズン（怪我で全休）
      if (flags.includes("zeroGames") && season === "2023-24") {
        stintSeq += 1;
        stintRows.push({
          id: uuid("stint", stintSeq),
          player: p.n,
          season,
          team: p.team,
          order: 1,
        });
        statRows.push({
          player: p.n,
          season,
          type: "regular",
          stint: null,
          line: {
            games_played: 0,
            games_started: 0,
            minutes: 0,
            field_goals_made: 0,
            field_goals_attempted: 0,
            three_pointers_made: 0,
            three_pointers_attempted: 0,
            free_throws_made: 0,
            free_throws_attempted: 0,
            offensive_rebounds: 0,
            defensive_rebounds: 0,
            assists: 0,
            steals: 0,
            blocks: 0,
            turnovers: 0,
            personal_fouls: 0,
            points: 0,
          },
        });
        continue;
      }

      if (isTradeSeason) {
        // シーズン途中の移籍。移籍前と移籍後で2つの stint を作り、
        // その合計をシーズン合計行として持つ。
        const destTeamN = TRADE_DESTINATION[p.n];
        const totalGames = int(...ROLE_SHAPE[p.role].games);
        const beforeGames = Math.round(totalGames * (0.35 + rand() * 0.3));
        const afterGames = totalGames - beforeGames;

        stintSeq += 1;
        const stintA = uuid("stint", stintSeq);
        stintRows.push({
          id: stintA,
          player: p.n,
          season,
          team: p.team,
          order: 1,
          started: `${season.slice(0, 4)}-10-20`,
          ended: `${Number(season.slice(0, 4)) + 1}-01-31`,
        });

        stintSeq += 1;
        const stintB = uuid("stint", stintSeq);
        stintRows.push({
          id: stintB,
          player: p.n,
          season,
          team: destTeamN,
          order: 2,
          started: `${Number(season.slice(0, 4)) + 1}-02-01`,
          ended: `${Number(season.slice(0, 4)) + 1}-04-13`,
        });

        const lineA = makeLine(p.role, beforeGames);
        const lineB = makeLine(p.role, afterGames);

        statRows.push({ player: p.n, season, type: "regular", stint: stintA, line: lineA });
        statRows.push({ player: p.n, season, type: "regular", stint: stintB, line: lineB });
        // 合計行は必ず stint の和にする。ここがずれると
        // 「シーズン合計と内訳が合わない」という最も分かりにくい不具合になる。
        statRows.push({
          player: p.n,
          season,
          type: "regular",
          stint: null,
          line: addLines(lineA, lineB),
        });

        // 移籍後のチームがその年プレーオフに出ていれば、PO成績も持つ
        const destTeam = teamById.get(destTeamN);
        if (destTeam.playoffSeasons.includes(season)) {
          statRows.push({
            player: p.n,
            season,
            type: "playoff",
            stint: null,
            line: makeLine(p.role, int(4, 14), true),
          });
        }
        continue;
      }

      stintSeq += 1;
      stintRows.push({ id: uuid("stint", stintSeq), player: p.n, season, team: p.team, order: 1 });

      const games = int(...ROLE_SHAPE[p.role].games);
      const line = makeLine(p.role, games);

      // 一本も打っていない年（FG%が算出不可になる）
      const noShotsThisSeason = flags.includes("noAttempts") && season === "2024-25";
      if (noShotsThisSeason) {
        line.field_goals_made = 0;
        line.field_goals_attempted = 0;
        line.three_pointers_made = 0;
        line.three_pointers_attempted = 0;
        line.free_throws_made = 0;
        line.free_throws_attempted = 0;
        line.points = 0;
      }

      // 記録が残っていない項目があるシーズン（0ではなくNULL）
      if (flags.includes("missingBox") && season === "2022-23") {
        line.steals = null;
        line.blocks = null;
        line.turnovers = null;
      }

      statRows.push({ player: p.n, season, type: "regular", stint: null, line });

      // レギュラーで一本も打っていない年に、プレーオフでだけ打っているのは筋が通らない。
      // 画面で見たときに「データがおかしい」と誤解されるので、PO行も作らない。
      if (homeTeam.playoffSeasons.includes(season) && !noShotsThisSeason) {
        statRows.push({
          player: p.n,
          season,
          type: "playoff",
          stint: null,
          line: makeLine(p.role, int(4, 16), true),
        });
      }
    }
  }

  out.push("\n-- 在籍（チーム × シーズン）。途中移籍は複数行になる");
  out.push(
    "insert into public.stints (id, player_id, season_id, team_id, stint_order, started_on, ended_on) values",
  );
  out.push(
    stintRows
      .map(
        (s) =>
          `  ('${s.id}', '${uuid("player", s.player)}', ${sqlText(s.season)}, '${uuid("team", s.team)}', ${s.order}, ${sqlText(s.started ?? null)}, ${sqlText(s.ended ?? null)})`,
      )
      .join(",\n") + ";",
  );

  out.push("\n-- 成績。stint_id が NULL の行がシーズン合計、入っている行が移籍前後の内訳");
  out.push(
    `insert into public.player_season_stats
  (player_id, season_id, season_type, stint_id, ${STAT_COLUMNS.join(", ")}, source_id)
values`,
  );
  out.push(
    statRows
      .map(
        (r) =>
          `  ('${uuid("player", r.player)}', ${sqlText(r.season)}, ${sqlText(r.type)}, ${r.stint ? `'${r.stint}'` : "null"}, ${statValues(r.line)}, (select id from public.data_sources where code = 'seed'))`,
      )
      .join(",\n") + ";",
  );

  // --- チーム成績 ---
  // 【重要】個人成績の合計ではない。公式値として別に持つ（オーバーライド v3 §8）。
  // ここでも意図的に「所属選手の合計とは一致しない」値にしてある。
  // 一致させると、合計で代用してよいという誤解を生むため。
  out.push("\n-- チーム成績。所属選手の合計ではなく、公式値として別に持つ（合計で代用しない）");
  const teamStatRows = [];
  for (const t of TEAMS) {
    for (const season of SEASONS) {
      const games = 82;
      const wins = int(
        t.playoffSeasons.includes(season) ? 44 : 19,
        t.playoffSeasons.includes(season) ? 61 : 38,
      );
      const fga = int(6600, 7300);
      const fgm = Math.round(fga * (0.44 + rand() * 0.06));
      const tpa = int(2300, 3300);
      const tpm = Math.min(tpa, fgm, Math.round(tpa * (0.33 + rand() * 0.07)));
      const fta = int(1400, 2100);
      const ftm = Math.min(fta, Math.round(fta * (0.75 + rand() * 0.1)));
      const pointsFor = 2 * fgm + tpm + ftm;
      teamStatRows.push({
        team: t.n,
        season,
        games,
        wins,
        losses: games - wins,
        pointsFor,
        pointsAgainst: pointsFor + int(-420, 420),
        fgm,
        fga,
        tpm,
        tpa,
        ftm,
        fta,
        oreb: int(700, 1000),
        dreb: int(2500, 3000),
        assists: int(1900, 2400),
        steals: int(500, 700),
        blocks: int(300, 500),
        turnovers: int(1000, 1300),
      });
    }
  }
  out.push(
    `insert into public.team_season_stats
  (team_id, season_id, season_type, games_played, wins, losses, points_for, points_against,
   field_goals_made, field_goals_attempted, three_pointers_made, three_pointers_attempted,
   free_throws_made, free_throws_attempted, offensive_rebounds, defensive_rebounds,
   assists, steals, blocks, turnovers, source_id)
values`,
  );
  out.push(
    teamStatRows
      .map(
        (r) =>
          `  ('${uuid("team", r.team)}', ${sqlText(r.season)}, 'regular', ${r.games}, ${r.wins}, ${r.losses}, ${r.pointsFor}, ${r.pointsAgainst}, ${r.fgm}, ${r.fga}, ${r.tpm}, ${r.tpa}, ${r.ftm}, ${r.fta}, ${r.oreb}, ${r.dreb}, ${r.assists}, ${r.steals}, ${r.blocks}, ${r.turnovers}, (select id from public.data_sources where code = 'seed'))`,
      )
      .join(",\n") + ";",
  );

  // --- 手動修正 ---
  // 元データを書き換えず、別テーブルに持つ仕組みが効いていることを画面で確認するため。
  out.push(`
-- 手動修正の確認用。元データは書き換わらず、ビューで重ねて表示される。
-- 「同期が走っても修正が消えない」ことをこの1件で確かめられる。
insert into public.manual_overrides (target, target_id, column_name, value_text, is_null_override, reason_ja, created_by)
values
  ('player', '${uuid("player", 5)}', 'full_name_ja', 'ローマン・ペトロフ', false,
   '日本語名が未設定だったため、管理画面から補った（開発用の例）', 'dev-seed');`);

  return out.join("\n") + "\n";
}

function main() {
  const sql = build();
  const check = process.argv.includes("--check");

  if (check) {
    let current;
    try {
      current = readFileSync(OUT, "utf8");
    } catch {
      console.error("✗ supabase/seed/dev_seed.sql がありません。");
      console.error("  node scripts/gen-dev-seed.mjs を実行してコミットしてください。");
      process.exit(1);
    }
    if (current !== sql) {
      console.error("✗ dev_seed.sql が生成結果と一致しません。");
      console.error("  生成器を変えたあと、作り直してコミットするのを忘れていませんか。");
      console.error("  node scripts/gen-dev-seed.mjs");
      process.exit(1);
    }
    console.log("✓ dev_seed.sql は生成結果と一致しています。");
    return;
  }

  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, sql, "utf8");
  console.log(`✓ ${OUT} を書き出しました（${sql.split("\n").length} 行）`);
}

main();
