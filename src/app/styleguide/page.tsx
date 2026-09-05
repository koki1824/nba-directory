"use client";

import { useState } from "react";

import { Logo, LogoLockup } from "@/components/brand/Logo";
import { Button, MissingValue, Select, StatBar, Table, Tabs, Td, Th } from "@/components/ui";

/**
 * デザイントークンとUIプリミティブの見本帳（W1-3）。
 *
 * オーナーがコードを読まずに実物を確認するためのページです。
 * 検索エンジンには出しません（layout.tsx の metadata で noindex）。
 * 画面の実装が進んだら、ここは残したまま各画面が本番になります。
 */

const TOKENS = [
  { name: "canvas", hex: "#F7F4EE", note: "ページ地。全コントラスト比の基準" },
  { name: "surface", hex: "#FFFDF9", note: "カード・表ヘッダ" },
  { name: "surface-sunken", hex: "#EFEADE", note: "沈める面・棒の下地" },
  { name: "ink", hex: "#0F1D2D", note: "本文と数値。地に対し 15.50:1" },
  { name: "ink-muted", hex: "#5D6570", note: "ラベル・注記。5.37:1" },
  { name: "line", hex: "#D3CCBE", note: "装飾的な細線" },
  { name: "line-strong", hex: "#8F8878", note: "操作部品の境界。3.21:1" },
  { name: "accent", hex: "#B23A2E", note: "強調・罫線・選択状態のみ。5.41:1" },
];

const SLOTS = [
  { name: "slot-1", hex: "#B23A2E", ratio: "5.41:1" },
  { name: "slot-2", hex: "#1E4E8C", ratio: "7.58:1" },
  { name: "slot-3", hex: "#2E6B5A", ratio: "5.68:1" },
  { name: "slot-4", hex: "#8A5E14", ratio: "5.18:1" },
];

const SEASONS = [
  { value: "2025-26", label: "2025-26" },
  { value: "2024-25", label: "2024-25" },
  { value: "2023-24", label: "2023-24" },
];

const STAT_TABS = [
  { id: "all", label: "詳細スタッツ" },
  { id: "scoring", label: "得点" },
  { id: "rebound", label: "リバウンド" },
  { id: "assist", label: "アシスト" },
  { id: "defense", label: "ディフェンス" },
];

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-line border-t pt-8">
      <h2 className="mb-4 text-xl">{title}</h2>
      {children}
    </section>
  );
}

export default function StyleguidePage() {
  const [tab, setTab] = useState("all");

  return (
    <main className="mx-auto flex max-w-4xl flex-col gap-10 px-6 py-12">
      <header>
        <h1 className="text-3xl">デザイントークン見本帳</h1>
        <p className="text-ink-muted mt-2 text-sm">
          W1-3 の成果物です。モック 07_brand_direction.jpg の Direction A 「COURT
          ARCHIVE」に基づいています。色の数値は WCAG コントラスト比を実測して決めました。
        </p>
      </header>

      <Section title="ロゴ">
        <p className="text-ink-muted mb-4 text-sm">
          円＝コート、縦線＝センターライン、左の弧＝キー（赤がアクセント）、右の棒＝スタッツ、
          チェック＝出典を確認した数値。
          <strong className="text-ink">サイト名が変わってもシンボルは流用できます。</strong>
        </p>
        <div className="mb-6 flex flex-wrap items-end gap-8">
          {[16, 20, 24, 32, 48, 64].map((s) => (
            <div key={s} className="flex flex-col items-center gap-2">
              <Logo size={s} className="text-ink" />
              <span className="text-ink-muted text-[11px]">{s}px</span>
            </div>
          ))}
        </div>
        <p className="text-ink-muted mb-3 text-sm">
          20px 未満は細部が潰れるため、自動で簡略版（円・センターライン・棒のみ）に切り替わります。
          下は同じ 16px を「簡略版」と「全部入り」で並べたもの。
        </p>
        <div className="mb-6 flex items-end gap-8">
          <div className="flex flex-col items-center gap-2">
            <Logo size={16} variant="compact" className="text-ink" />
            <span className="text-ink-muted text-[11px]">16px 簡略版</span>
          </div>
          <div className="flex flex-col items-center gap-2">
            <Logo size={16} variant="full" className="text-ink" />
            <span className="text-ink-muted text-[11px]">16px 全部入り（潰れる）</span>
          </div>
        </div>
        <p className="text-ink-muted mb-3 text-sm">ヘッダー用のロックアップ</p>
        <div className="bg-surface border-line mb-4 border p-4">
          <LogoLockup />
        </div>
        <p className="text-ink-muted mb-3 text-sm">濃紺の面に置いた場合</p>
        <div className="bg-ink text-ink-inverse p-4">
          <LogoLockup />
        </div>
      </Section>

      <Section title="色">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {TOKENS.map((t) => (
            <div key={t.name} className="border-line bg-surface border p-3">
              <div className="border-line mb-2 h-12 w-full border" style={{ background: t.hex }} />
              <div className="text-xs font-medium">{t.name}</div>
              <div className="text-ink-muted text-[11px]">{t.hex}</div>
              <div className="text-ink-muted mt-1 text-[11px]">{t.note}</div>
            </div>
          ))}
        </div>
      </Section>

      <Section title="比較スロット色（最大4人）">
        <p className="text-ink-muted mb-3 text-sm">
          この4色は明度がほぼ同じで、色相でしか区別できません（相互のコントラスト比は
          1.04〜1.46:1）。色覚特性やモノクロ印刷では判別できないため、
          <strong className="text-ink">色だけで選手を区別してはいけません。</strong>
          必ず A / B / C / D のラベルか選手名を併記します。
        </p>
        <div className="flex flex-col gap-3">
          {SLOTS.map((s, i) => (
            <div key={s.name} className="flex items-center gap-3">
              <span className="w-24 shrink-0 text-xs">選手{String.fromCharCode(65 + i)}</span>
              <div className="h-8 w-16 shrink-0" style={{ background: s.hex }} />
              <span className="text-ink-muted text-xs">
                {s.name} / {s.hex} / 地に対し {s.ratio}
              </span>
            </div>
          ))}
        </div>
      </Section>

      <Section title="書体">
        <p className="text-ink-muted mb-1 text-xs">見出し（明朝体）</p>
        <p className="mb-4 font-serif text-2xl">信頼と知性を感じるタイポグラフィ</p>
        <p className="text-ink-muted mb-1 text-xs">本文（ゴシック体）</p>
        <p className="mb-4 text-sm">
          最新のスタッツ、詳細なデータ、タイポグラフィでNBAのすべてを。
        </p>
        <p className="text-ink-muted mb-1 text-xs">数値（桁を縦に揃える）</p>
        <div data-numeric className="text-2xl">
          24.8 / 8.1 / 7.6
        </div>
      </Section>

      <Section title="ボタン">
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="primary">比較に追加</Button>
          <Button variant="secondary">プレーオフ</Button>
          <Button variant="quiet">規定の詳細を見る</Button>
          <Button variant="primary" size="sm">
            小
          </Button>
          <Button variant="secondary" disabled>
            無効
          </Button>
        </div>
      </Section>

      <Section title="セレクト">
        <div className="flex flex-wrap gap-3">
          <div className="w-56">
            <Select options={SEASONS} placeholder="シーズンを選択" aria-label="シーズン" />
          </div>
          <div className="w-56">
            <Select options={SEASONS} defaultValue="2024-25" aria-label="シーズン（選択済み）" />
          </div>
        </div>
      </Section>

      <Section title="タブ">
        <Tabs items={STAT_TABS} activeId={tab} onSelect={setTab} label="スタッツのカテゴリ" />
        <p className="text-ink-muted mt-3 text-sm">選択中: {tab}</p>
      </Section>

      <Section title="スタッツバー">
        <p className="text-ink-muted mb-3 text-sm">
          比較ページの向かい合わせ表示（左が rtl、右が ltr）
        </p>
        <div className="mb-6 grid grid-cols-2 gap-4">
          <StatBar
            value={82}
            slot={1}
            direction="rtl"
            showScale
            label="選手Aの得点パーセンタイル"
          />
          <StatBar value={68} slot={2} showScale label="選手Bの得点パーセンタイル" />
        </div>
        <p className="text-ink-muted mb-3 text-sm">欠損値の3種（0 と混同させない）</p>
        <div className="flex flex-col gap-2">
          <StatBar value={0} label="0 は欠損ではない" />
          <StatBar value={null} missingReason="no_data" label="未取得のシーズン" />
          <StatBar value={null} missingReason="not_applicable" label="PO平均得点" />
          <StatBar value={null} missingReason="not_calculated" label="FG%（試投0本）" />
        </div>
      </Section>

      <Section title="欠損値の表示">
        <Table caption="欠損値の種類と表示" showCaption>
          <thead>
            <tr>
              <Th>種類</Th>
              <Th align="center">表示</Th>
              <Th>意味</Th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <Td>0</Td>
              <Td align="center" data-numeric="">
                0
              </Td>
              <Td>実際に0。欠損ではない</Td>
            </tr>
            <tr>
              <Td>no_data</Td>
              <Td align="center">
                <MissingValue reason="no_data" />
              </Td>
              <Td>値が存在しない・未取得</Td>
            </tr>
            <tr>
              <Td>not_applicable</Td>
              <Td align="center">
                <MissingValue reason="not_applicable" />
              </Td>
              <Td>概念が当てはまらない（PO未出場のPO成績など）</Td>
            </tr>
            <tr>
              <Td>not_calculated</Td>
              <Td align="center">
                <MissingValue reason="not_calculated" />
              </Td>
              <Td>算出条件を満たさない（試投0本のFG%など）</Td>
            </tr>
          </tbody>
        </Table>
      </Section>

      <Section title="表">
        <Table caption="スタッツ比較の例">
          <thead>
            <tr>
              <Th align="right">選手A</Th>
              <Th align="center">スタッツ項目</Th>
              <Th align="left">選手B</Th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <Td align="right">24.8</Td>
              <Td align="center">PTS（得点）</Td>
              <Td>23.1</Td>
            </tr>
            <tr>
              <Td align="right">8.1</Td>
              <Td align="center">REB（リバウンド）</Td>
              <Td>8.7</Td>
            </tr>
            <tr>
              <Td align="right">
                <MissingValue reason="not_calculated" />
              </Td>
              <Td align="center">FG%（フィールドゴール成功率）</Td>
              <Td>49.1</Td>
            </tr>
          </tbody>
        </Table>
      </Section>
    </main>
  );
}
