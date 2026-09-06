import { cx } from "@/lib/cx";

/**
 * サイトのロゴシンボル（W1-4）。
 *
 * モック 07_brand_direction.jpg の Direction A を、SVGとして描き直したもの。
 * 要件定義書は「画像生成案は方向性確認用であり、公開前にSVGとして
 * グリッド・線幅・小サイズ視認性を調整する」と定めているので、モックの
 * トレースではなく整えた形にしている。差分は docs/REFERENCES.md 項目12。
 *
 * 意味づけ:
 *   円      … コート／ボール
 *   縦の線  … コートのセンターライン
 *   左の弧  … キー（フリースローサークル）。下の赤い部分がアクセント
 *   右の棒  … スタッツ。左から右へ伸びる＝データで比べる
 *   チェック… 出典を確認した数値であること
 *
 * 【重要】サイト名が変わってもこのシンボルは流用できる。
 * 文字（ワードマーク）は Logo の外に置き、シンボルと混ぜないこと。
 * 公式NBAロゴ・チームロゴ・選手シルエットには似せない（要件定義書 §ロゴ）。
 *
 * 座標はすべて 48×48 のグリッド上。円の中心 (24,24)、半径 20.5。
 * 数値を動かすときは、下の「16px での見え方」を必ず再確認すること。
 */

type Props = {
  /** 表示サイズ（px）。20px 未満では自動的に簡略版に切り替わる */
  size?: number;
  /**
   * 細部の出し分け。既定の "auto" は size で判断する。
   *   full    … 弧・赤の塗り・チェックまで全部出す（24px以上向け）
   *   compact … 円・センターライン・棒だけ。faviconやヘッダーの小さい表示向け
   */
  variant?: "auto" | "full" | "compact";
  className?: string;
  /**
   * 単独で意味を持つ場合の代替テキスト。
   * サイト名を隣に文字で出しているときは省略し、装飾として扱う。
   */
  title?: string;
};

/**
 * これ未満のサイズでは細部が潰れるので簡略版にする。
 * 16 / 20 / 24 / 32 / 48 / 64px を実際に描画して確認した結果、
 * 24px 未満では棒とチェックが混ざって黒い塊になった。
 */
const COMPACT_THRESHOLD = 24;

export function Logo({ size = 32, variant = "auto", className, title }: Props) {
  const isCompact = variant === "compact" || (variant === "auto" && size < COMPACT_THRESHOLD);

  // 小さいほど線を太くしないと消える。48グリッド上での線幅。
  const stroke = isCompact ? 4.5 : 3;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      className={cx("shrink-0", className)}
      role={title ? "img" : "presentation"}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      {/* 左下の赤いセグメント。円を水平の弦で切った下側、センターラインより左。
          円は中心(24,24) 半径20.5。弦の高さから交点のx座標が決まる。
            全部入り: y=34 → x = 24 - √(20.5² - 10²) = 6.10
            簡略版  : y=30 → x = 24 - √(20.5² - 6²)  = 4.40（小さいと潰れるので広く取る）
          円より先に描いて、外周の線が赤の上に乗るようにする。 */}
      <path
        d={
          isCompact
            ? "M4.4 30H24V44.5A20.5 20.5 0 0 1 4.4 30Z"
            : "M6.1 34H24V44.5A20.5 20.5 0 0 1 6.1 34Z"
        }
        fill="var(--color-accent, #B23A2E)"
      />

      {/* 外周の円。線の中心が半径 20.5 に来るので、線幅を足しても 48 に収まる */}
      <circle cx="24" cy="24" r="20.5" stroke="currentColor" strokeWidth={stroke} />

      {/* センターライン */}
      <path d="M24 3.5V44.5" stroke="currentColor" strokeWidth={stroke} />

      {/* 簡略版はここまで。円・センターライン・赤の3要素だけにする。
          16px では棒もチェックも1px未満になり、混ざって黒い塊になるため。 */}
      {!isCompact && (
        <>
          {/* 左のキー（フリースローサークル）。中心線を弦とする半円 */}
          <path d="M24 12A9 9 0 0 0 24 30" stroke="currentColor" strokeWidth={stroke - 0.6} />

          {/* 右のスタッツ棒。左から右へ伸びる＝データで比べる。底辺は y=36 で揃える */}
          <g fill="currentColor">
            <rect x="28" y="29" width="3" height="7" />
            <rect x="32.5" y="25" width="3" height="11" />
            <rect x="37" y="21" width="3" height="15" />
          </g>

          {/* チェックマーク。棒の頂点(y=21)より上に収め、重ならないようにする */}
          <path
            d="M28.5 14.5L31 17L36.5 10.5"
            stroke="var(--color-accent, #B23A2E)"
            strokeWidth="2.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </>
      )}
    </svg>
  );
}

/**
 * ヘッダー用のロックアップ（シンボル＋サイト名）。
 *
 * サイト名は［保留］で後日変わる（docs/DECISIONS.md §3）。
 * 表示名をここ1箇所に集約しておき、確定したらこの定数だけ差し替える。
 */
export const SITE_DISPLAY_NAME = "NBA選手名鑑";

/**
 * ヘッダーのロックアップは画面幅で大きさを変える。
 *
 * サイト名は大きく太くしたい（オーナー指示 2026-09-06）が、
 * 狭い画面でそのまま大きくするとメニューが押し出されて横スクロールが出る。
 * そこで小さい画面では一段小さくする。
 *
 * SVGの width/height 属性より CSS のクラスが優先されるので、
 * size は「どこまで細部を描くか」の判断（COMPACT_THRESHOLD）に効かせたまま、
 * 実際の表示サイズはクラスで切り替えている。
 */
export function LogoLockup({ size = 36, className }: { size?: number; className?: string }) {
  return (
    <span className={cx("inline-flex items-center gap-2 sm:gap-2.5", className)}>
      <Logo size={size} className="h-8 w-8 sm:h-9 sm:w-9" />
      <span className="font-serif text-xl leading-none font-bold tracking-wide sm:text-2xl">
        {SITE_DISPLAY_NAME}
      </span>
    </span>
  );
}
