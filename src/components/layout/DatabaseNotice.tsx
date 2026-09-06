/**
 * データベースにつながっていないときの表示。
 *
 * 【なぜ画面を落とさないか】
 * 接続先が未設定なだけで真っ白なエラー画面になると、
 * オーナーは「作りかけで壊れている」と受け取る。
 * 何が足りないかと、誰が何をすればよいかを画面に出す。
 *
 * この状態は公開前の一時的なもので、`DATABASE_URL` を設定すれば消える。
 */
export function DatabaseNotice() {
  return (
    <div className="border-line bg-surface border p-6">
      <h2 className="text-lg">データベースの接続先が設定されていません</h2>
      <p className="text-ink-muted mt-3 text-sm leading-relaxed">
        この画面は選手データを読み込んで表示します。まだ接続先が設定されていないため、
        中身を出せていません。<strong className="text-ink">不具合ではありません。</strong>
      </p>
      <div className="border-line mt-4 border-l-2 pl-4">
        <p className="text-ink-muted text-xs leading-relaxed">
          設定するもの: 環境変数 <code className="text-ink">DATABASE_URL</code>
          <br />
          公開サイト側は Vercel の環境変数に、手元で動かす場合は{" "}
          <code className="text-ink">.env.local</code> に追加します。
          <br />
          接続文字列の取り方は <code className="text-ink">docs/ROADMAP.md</code>{" "}
          の「既知の注意点」にまとめてあります。
        </p>
      </div>
    </div>
  );
}
