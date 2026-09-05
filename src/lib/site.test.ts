import { describe, expect, it } from "vitest";

import { DEFAULT_SITE_URL, resolveSiteUrl } from "./site";

/**
 * 本番ビルドを止めた不具合の再発防止テスト。
 * Vercel で NEXT_PUBLIC_SITE_URL が空文字で登録され、new URL("") が
 * ERR_INVALID_URL を投げてビルドが失敗した。
 */
describe("resolveSiteUrl", () => {
  describe("NEXT_PUBLIC_SITE_URL が使えるとき", () => {
    it("正しいURLはそのまま使う", () => {
      expect(resolveSiteUrl("https://nba-directory.vercel.app")).toBe(
        "https://nba-directory.vercel.app",
      );
    });

    it("末尾のパスやスラッシュを落としてオリジンだけにする", () => {
      expect(resolveSiteUrl("https://example.com/some/path")).toBe("https://example.com");
    });

    it("Vercelのホスト名より優先される（独自ドメインを取ったとき用）", () => {
      expect(resolveSiteUrl("https://example.com", "nba-directory.vercel.app")).toBe(
        "https://example.com",
      );
    });
  });

  describe("NEXT_PUBLIC_SITE_URL が使えないとき、Vercelのホスト名に落ちる", () => {
    it("スキームなしのホスト名に https を補う", () => {
      expect(resolveSiteUrl(undefined, "nba-directory.vercel.app")).toBe(
        "https://nba-directory.vercel.app",
      );
    });

    it("空文字のときもVercelのホスト名を使う（ビルドが落ちた条件）", () => {
      expect(resolveSiteUrl("", "nba-directory.vercel.app")).toBe(
        "https://nba-directory.vercel.app",
      );
    });

    it("既にスキームが付いていれば二重に付けない", () => {
      expect(resolveSiteUrl("", "https://nba-directory.vercel.app")).toBe(
        "https://nba-directory.vercel.app",
      );
    });
  });

  describe("どちらも使えないときは既定値に倒す", () => {
    it("空文字（これでビルドが落ちた）", () => {
      expect(resolveSiteUrl("", undefined)).toBe(DEFAULT_SITE_URL);
    });

    it("空白だけの値", () => {
      expect(resolveSiteUrl("   ", "  ")).toBe(DEFAULT_SITE_URL);
    });

    it("未設定", () => {
      expect(resolveSiteUrl(undefined, undefined)).toBe(DEFAULT_SITE_URL);
    });

    it("URLとして壊れている値でも例外を投げない", () => {
      expect(resolveSiteUrl("これはURLではない", undefined)).toBe(DEFAULT_SITE_URL);
      expect(resolveSiteUrl("http://", undefined)).toBe(DEFAULT_SITE_URL);
    });

    it("http / https 以外のスキームは受け付けない", () => {
      expect(resolveSiteUrl("file:///etc/passwd", undefined)).toBe(DEFAULT_SITE_URL);
      expect(resolveSiteUrl("javascript:alert(1)", undefined)).toBe(DEFAULT_SITE_URL);
    });
  });
});
