import { describe, expect, it, vi } from "vitest";

import {
  assertPersistenceConsent,
  parseConsent,
  parseProviderId,
  resolveProvider,
} from "./registry";
import { supportsMetric } from "./types";

const noopRunner = vi.fn(async () => []);

describe("parseProviderId", () => {
  it("未設定なら seed（10/4の公開はこれで動く）", () => {
    expect(parseProviderId(undefined)).toBe("seed");
    expect(parseProviderId("")).toBe("seed");
    expect(parseProviderId("   ")).toBe("seed");
  });

  it("既知のプロバイダ名を受け付ける", () => {
    expect(parseProviderId("seed")).toBe("seed");
    expect(parseProviderId("balldontlie")).toBe("balldontlie");
  });

  it("未知の値は黙って無視せず、使える値を示して止める", () => {
    expect(() => parseProviderId("nba-official")).toThrow(/未知のプロバイダ/);
    expect(() => parseProviderId("nba-official")).toThrow(/seed \| balldontlie/);
  });
});

describe("parseConsent", () => {
  it('"true" のときだけ許諾とみなす', () => {
    expect(parseConsent("true")).toBe(true);
    expect(parseConsent("TRUE")).toBe(true);
    expect(parseConsent(" true ")).toBe(true);
  });

  it("紛らわしい値は許諾とみなさない（意図せず保存させないため）", () => {
    for (const value of ["1", "yes", "y", "on", "false", "", undefined]) {
      expect(parseConsent(value)).toBe(false);
    }
  });
});

describe("assertPersistenceConsent（永続保存の起動時ガード）", () => {
  it("seed は自前のデータなので許諾を問わない", () => {
    expect(() =>
      assertPersistenceConsent("seed", { dataProvider: "seed", persistenceAllowed: undefined }),
    ).not.toThrow();
  });

  it("外部プロバイダは許諾が無いと起動を止める", () => {
    expect(() =>
      assertPersistenceConsent("balldontlie", {
        dataProvider: "balldontlie",
        persistenceAllowed: undefined,
      }),
    ).toThrow(/許諾が確認できていません/);
  });

  it("止めるときは対処法まで示す", () => {
    try {
      assertPersistenceConsent("balldontlie", {
        dataProvider: "balldontlie",
        persistenceAllowed: "false",
      });
      throw new Error("例外が投げられなかった");
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      expect(message).toContain("PROVIDER_PERSISTENCE_ALLOWED=true");
      expect(message).toContain("DATA_PROVIDER=seed");
    }
  });

  it("許諾があれば通る", () => {
    expect(() =>
      assertPersistenceConsent("balldontlie", {
        dataProvider: "balldontlie",
        persistenceAllowed: "true",
      }),
    ).not.toThrow();
  });
});

describe("resolveProvider", () => {
  it("既定では SeedProvider を返す", () => {
    const provider = resolveProvider(noopRunner, {
      dataProvider: undefined,
      persistenceAllowed: undefined,
    });

    expect(provider.id).toBe("seed");
    expect(provider.persistenceAllowed).toBe(true);
  });

  it("許諾なしで外部プロバイダを指定すると起動しない", () => {
    expect(() =>
      resolveProvider(noopRunner, {
        dataProvider: "balldontlie",
        persistenceAllowed: undefined,
      }),
    ).toThrow(/許諾が確認できていません/);
  });

  it("APIキーが無いまま外部プロバイダを指定すると、入口で止める", () => {
    // キーが無いまま進めると、認証エラーが取得の途中で出て
    // 「どこまで入ったか分からない」状態になる。
    expect(() =>
      resolveProvider(noopRunner, {
        dataProvider: "balldontlie",
        persistenceAllowed: "true",
        balldontlieApiKey: undefined,
      }),
    ).toThrow(/BALLDONTLIE_API_KEY/);
  });

  it("許諾とキーが揃えば外部プロバイダを返す", () => {
    const provider = resolveProvider(noopRunner, {
      dataProvider: "balldontlie",
      persistenceAllowed: "true",
      balldontlieApiKey: "test-key",
    });

    expect(provider.id).toBe("balldontlie");
    expect(provider.persistenceAllowed).toBe(true);
  });

  it("黙って seed に落とさない", () => {
    // seed を返すと、実データが表示されていると誤認する。
    const provider = resolveProvider(noopRunner, {
      dataProvider: "balldontlie",
      persistenceAllowed: "true",
      balldontlieApiKey: "test-key",
    });

    expect(provider.id).not.toBe("seed");
  });
});

describe("提供できる指標の出し分け（Q2）", () => {
  const provider = resolveProvider(noopRunner, {
    dataProvider: "seed",
    persistenceAllowed: undefined,
  });

  it("seed が提供する指標は true", () => {
    expect(supportsMetric(provider, "pts_per_game")).toBe(true);
    expect(supportsMetric(provider, "ts_pct")).toBe(true);
  });

  it("高度指標(BPM/VORP)は seed では提供しない（根拠のない数字を出さないため）", () => {
    expect(supportsMetric(provider, "bpm")).toBe(false);
    expect(supportsMetric(provider, "vorp")).toBe(false);
  });
});
