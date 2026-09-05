import { describe, expect, it } from "vitest";

import { DEFAULT_SITE_URL, resolveSiteUrl } from "./site";

/**
 * 本番ビルドを止めた不具合の再発防止テスト。
 * Vercel で NEXT_PUBLIC_SITE_URL が空文字で登録され、new URL("") が
 * ERR_INVALID_URL を投げてビルドが失敗した。
 */
describe("resolveSiteUrl", () => {
  it("正しいURLはそのまま使う", () => {
    expect(resolveSiteUrl("https://nba-directory.vercel.app")).toBe(
      "https://nba-directory.vercel.app",
    );
  });

  it("末尾のパスやスラッシュを落としてオリジンだけにする", () => {
    expect(resolveSiteUrl("https://example.com/some/path")).toBe("https://example.com");
  });

  it("空文字は既定値に倒す（これでビルドが落ちた）", () => {
    expect(resolveSiteUrl("")).toBe(DEFAULT_SITE_URL);
  });

  it("空白だけの値も既定値に倒す", () => {
    expect(resolveSiteUrl("   ")).toBe(DEFAULT_SITE_URL);
  });

  it("未設定なら既定値に倒す", () => {
    expect(resolveSiteUrl(undefined)).toBe(DEFAULT_SITE_URL);
  });

  it("URLとして壊れている値でも例外を投げない", () => {
    expect(resolveSiteUrl("これはURLではない")).toBe(DEFAULT_SITE_URL);
    expect(resolveSiteUrl("http://")).toBe(DEFAULT_SITE_URL);
  });

  it("http / https 以外のスキームは受け付けない", () => {
    expect(resolveSiteUrl("file:///etc/passwd")).toBe(DEFAULT_SITE_URL);
    expect(resolveSiteUrl("javascript:alert(1)")).toBe(DEFAULT_SITE_URL);
  });
});
