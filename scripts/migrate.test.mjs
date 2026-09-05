import { describe, expect, it } from "vitest";

import { describeConnection } from "./migrate.mjs";

/**
 * Supabase の3種類の接続文字列を取り違えたときに気づけるようにするテスト。
 * 見た目が似ているのに挙動が違い、間違えると「接続できない」としか分からない形で失敗する。
 */
describe("describeConnection", () => {
  it("Session pooler（pooler かつ :5432）は正しいので警告しない", () => {
    const result = describeConnection(
      "postgresql://postgres.abcdefgh:pw@aws-0-ap-northeast-1.pooler.supabase.com:5432/postgres",
    );

    expect(result.kind).toBe("session-pooler");
    expect(result.warning).toBeNull();
  });

  it("Transaction pooler（:6543）は警告する", () => {
    const result = describeConnection(
      "postgresql://postgres.abcdefgh:pw@aws-0-ap-northeast-1.pooler.supabase.com:6543/postgres",
    );

    expect(result.kind).toBe("transaction-pooler");
    expect(result.warning).toContain("Session pooler");
  });

  it("Direct connection は IPv6 のみなので警告する", () => {
    const result = describeConnection(
      "postgresql://postgres:pw@db.coqummbmkwqdvgrxeuqz.supabase.co:5432/postgres",
    );

    expect(result.kind).toBe("direct");
    expect(result.warning).toContain("IPv6");
  });

  it("URI形式でない値（Node.jsのコード片など）は形式ごと指摘する", () => {
    const result = describeConnection("const client = new Client({ host: 'aws-0.pooler...' })");

    expect(result.kind).toBe("not-a-uri");
    expect(result.warning).toContain("URI");
  });

  it("postgres:// でも postgresql:// でも通す", () => {
    expect(
      describeConnection("postgres://postgres.ab:pw@aws-0.pooler.supabase.com:5432/postgres").kind,
    ).toBe("session-pooler");
    expect(
      describeConnection("postgresql://postgres.ab:pw@aws-0.pooler.supabase.com:5432/postgres")
        .kind,
    ).toBe("session-pooler");
  });

  it("ローカルのPostgreSQLなどSupabase以外は通す（CIの検証用DB）", () => {
    const result = describeConnection("postgres://postgres:postgres@localhost:5432/verify");

    expect(result.kind).toBe("other");
    expect(result.warning).toBeNull();
  });

  it("パスワードに @ や : が含まれていても、ホストを取り違えない", () => {
    const result = describeConnection(
      "postgresql://postgres.abcdefgh:p@ss:word@aws-0-ap-northeast-1.pooler.supabase.com:5432/postgres",
    );

    expect(result.kind).toBe("session-pooler");
  });
});
