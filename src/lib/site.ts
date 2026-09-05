/**
 * サイトの公開URLを解決する。
 *
 * 優先順位:
 *   1. NEXT_PUBLIC_SITE_URL          … 独自ドメインを取ったらここに入れる
 *   2. VERCEL_PROJECT_PRODUCTION_URL … Vercelが自動で入れる本番ホスト名。設定不要
 *   3. http://localhost:3000         … 手元での開発時
 *
 * 環境変数は「未設定」だけでなく「空文字」でもやってくる。
 * Vercel のプロジェクト作成時に .env.example のキーが値なしで登録される、
 * といったことが実際に起きる。
 *
 * `??` は未定義のときしか代替値を使わないため、空文字はそのまま通り、
 * `new URL("")` が ERR_INVALID_URL で落ちる。これでビルドが丸ごと失敗した。
 * 環境変数の中身は信用せず、使える値かどうかを毎回確かめる。
 */

export const DEFAULT_SITE_URL = "http://localhost:3000";

/** 使える公開URLなら origin を返す。使えなければ null。 */
function toOrigin(candidate: string | undefined): string | null {
  const trimmed = candidate?.trim();
  if (!trimmed) return null;

  try {
    // 形式が不正なら例外になる。ここで捕まえる。
    const url = new URL(trimmed);
    // http/https 以外（file: や javascript: など）は公開URLとして受け付けない。
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url.origin;
  } catch {
    return null;
  }
}

export function resolveSiteUrl(
  explicit: string | undefined = process.env.NEXT_PUBLIC_SITE_URL,
  // Vercel が本番デプロイで自動的に入れるホスト名。"nba-directory.vercel.app" のように
  // スキームが付かないので、https を補ってから検証する。
  vercelHost: string | undefined = process.env.VERCEL_PROJECT_PRODUCTION_URL,
): string {
  const fromExplicit = toOrigin(explicit);
  if (fromExplicit) return fromExplicit;

  const host = vercelHost?.trim();
  if (host) {
    const fromVercel = toOrigin(host.includes("://") ? host : `https://${host}`);
    if (fromVercel) return fromVercel;
  }

  return DEFAULT_SITE_URL;
}
