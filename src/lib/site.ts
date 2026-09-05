/**
 * サイトの公開URLを解決する。
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

export function resolveSiteUrl(raw: string | undefined = process.env.NEXT_PUBLIC_SITE_URL): string {
  const candidate = raw?.trim();
  if (!candidate) return DEFAULT_SITE_URL;

  try {
    // 形式が不正なら例外になる。ここで捕まえて既定値に倒す。
    const url = new URL(candidate);
    // http/https 以外（file: や javascript: など）は公開URLとして受け付けない。
    if (url.protocol !== "http:" && url.protocol !== "https:") return DEFAULT_SITE_URL;
    return url.origin;
  } catch {
    return DEFAULT_SITE_URL;
  }
}
