#!/usr/bin/env node
/**
 * 公開前の点検（W5-12 の前倒し）。
 *
 *   node scripts/check-launch.mjs
 *
 * 【何のためか】
 * 「あとで埋める」つもりで空にした箇所は、必ず忘れる。
 * 公開直前に慌てて探すのではなく、いつでも残りを一覧できるようにしておく。
 *
 * 【CIを落とさない理由】
 * 未記入なのは今の時点では正しい状態で、失敗ではない。
 * 落とすと「いつも赤い」状態に慣れてしまい、本物の失敗を見逃す。
 * 公開判断（W5-13）のときに、このコマンドで残りを確認する。
 *
 * 終了コードは常に0。`--strict` を付けたときだけ、
 * 未完了があれば1で終わる（公開直前のチェックに使う）。
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");

const items = [];

function add(name, done, detail) {
  items.push({ name, done, detail });
}

/**
 * TypeScript を読み込まずに値を取り出す。
 * 点検のためだけにビルドの仕組みを増やしたくないので、
 * 素直に文字列として読む。
 */
function readLegalFacts() {
  const source = readFileSync(join(root, "src", "config", "legal.ts"), "utf8");
  const facts = [];
  const blocks = source.split("{").slice(1);

  for (const block of blocks) {
    const label = block.match(/label:\s*"([^"]*)"/)?.[1];
    const value = block.match(/value:\s*"([^"]*)"/)?.[1];
    const required = /requiredForLaunch:\s*true/.test(block);
    if (label === undefined || value === undefined) continue;
    facts.push({ label, value, required });
  }
  return facts;
}

function main() {
  const strict = process.argv.includes("--strict");

  // --- 運営者が埋める事実 ---
  const facts = readLegalFacts();
  for (const fact of facts) {
    add(
      `${fact.label}${fact.required ? "" : "（任意）"}`,
      fact.value.trim().length > 0,
      fact.required ? "公開前に必須" : "無くても公開できる",
    );
  }

  // --- 法務ページが草案のままでないか ---
  const legalPages = [
    ["利用について", "terms"],
    ["プライバシーポリシー", "privacy"],
    ["データ出典", "data-sources"],
    ["画像クレジット", "image-credits"],
    ["免責事項", "disclaimer"],
    ["訂正の方針", "corrections"],
    ["お問い合わせ", "contact"],
  ];
  for (const [name, dir] of legalPages) {
    const source = readFileSync(join(root, "src", "app", dir, "page.tsx"), "utf8");
    add(
      `${name}: オーナーの確認済み`,
      /reviewed\s*$|reviewed(\s*=\s*\{?true)/.test(source),
      "確認が済んだら LegalPage に reviewed を付ける",
    );
  }

  // --- 実データか開発用データか ---
  const seedApplied = (() => {
    try {
      const wf = readFileSync(join(root, ".github", "workflows", "sync.yml"), "utf8");
      return wf.length > 0;
    } catch {
      return false;
    }
  })();
  add("実データの取得（Phase 3）", seedApplied, "未実装のうちは架空の選手を表示している");

  // --- 出力 ---
  const done = items.filter((i) => i.done);
  const todo = items.filter((i) => !i.done);

  console.log("公開前の点検\n");
  for (const item of items) {
    console.log(`  ${item.done ? "✓" : "○"} ${item.name}${item.done ? "" : ` — ${item.detail}`}`);
  }
  console.log(`\n${done.length} / ${items.length} 件完了`);

  if (todo.length > 0) {
    console.log(`\n残り ${todo.length} 件:`);
    for (const item of todo) console.log(`  ○ ${item.name}`);
    console.log("\n未完了があるのは、今の時点では正しい状態です。");
    console.log("公開判断（W5-13）のときに、この一覧が全部 ✓ になっていることを確認します。");
  }

  if (strict && todo.length > 0) process.exit(1);
}

main();
