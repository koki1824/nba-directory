import { BalldontlieProvider } from "./balldontlie";
import { createSeedProvider, type SqlRunner } from "./seed-provider";
import type { DataProvider, ProviderId } from "./types";

/**
 * どのプロバイダを使うかを決める場所（W1-9）。
 *
 * ここに**永続保存の許諾ガード**を置く。
 * オーバーライド v3 と 11_OPEN_QUESTIONS §11.3 が
 * 「自社DBへの永続保存が許諾されない場合は Phase 3 全体を止める」と定めている。
 *
 * 許諾の有無をコードのあちこちで確認すると、必ずどこかで漏れる。
 * プロバイダを取得する入口で1回だけ確認し、条件を満たさなければ起動を止める。
 */

export type ProviderEnv = {
  /** 使用するプロバイダ。未設定なら seed */
  dataProvider: string | undefined;
  /** 外部プロバイダのデータを自社DBへ保存してよいか */
  persistenceAllowed: string | undefined;
  /** BALLDONTLIE のAPIキー */
  balldontlieApiKey?: string | undefined;
};

const KNOWN_PROVIDERS: readonly ProviderId[] = ["seed", "balldontlie"];

/** 外部プロバイダかどうか。seed は自前なので許諾を問わない。 */
function requiresConsent(id: ProviderId): boolean {
  return id !== "seed";
}

export function parseProviderId(raw: string | undefined): ProviderId {
  const value = raw?.trim();
  // 未設定なら seed。10/4 の公開はこれで動く。
  if (!value) return "seed";
  if ((KNOWN_PROVIDERS as readonly string[]).includes(value)) return value as ProviderId;
  throw new Error(
    `DATA_PROVIDER の値 "${value}" は未知のプロバイダです。` +
      `使える値: ${KNOWN_PROVIDERS.join(" | ")}`,
  );
}

/**
 * 環境変数の真偽値。"true" のみを true とみなす。
 * "1" や "yes" を通すと、意図せず許諾扱いになる余地が増えるため厳しくする。
 */
export function parseConsent(raw: string | undefined): boolean {
  return raw?.trim().toLowerCase() === "true";
}

/**
 * 永続保存の許諾を確認する。条件を満たさなければ例外を投げて起動を止める。
 *
 * 「動くけれど保存してはいけないデータを保存している」状態が最悪なので、
 * 曖昧なまま進ませず、はっきり止める。
 */
export function assertPersistenceConsent(id: ProviderId, env: ProviderEnv): void {
  if (!requiresConsent(id)) return;
  if (parseConsent(env.persistenceAllowed)) return;

  throw new Error(
    `プロバイダ "${id}" のデータを自社DBへ保存する許諾が確認できていません。\n` +
      "  契約条件を書面で確認したうえで、環境変数 PROVIDER_PERSISTENCE_ALLOWED=true を設定してください。\n" +
      "  許諾が取れていない場合は DATA_PROVIDER=seed のまま運用してください（10/4の公開はこれで動きます）。",
  );
}

export function resolveProvider(run: SqlRunner, env: ProviderEnv): DataProvider {
  const id = parseProviderId(env.dataProvider);
  assertPersistenceConsent(id, env);

  switch (id) {
    case "seed":
      return createSeedProvider(run);
    case "balldontlie": {
      const apiKey = env.balldontlieApiKey?.trim();
      // キーが無いまま進めると、認証エラーが取得の途中で出て
      // 「どこまで入ったか分からない」状態になる。入口で止める。
      if (!apiKey) {
        throw new Error(
          "BALLDONTLIE_API_KEY が設定されていません。\n" +
            "  GitHub Secrets（同期の実行時）または .env.local（手元）に設定してください。\n" +
            "  キーが無いあいだは DATA_PROVIDER=seed のまま運用してください。",
        );
      }
      return new BalldontlieProvider({ apiKey, persistenceAllowed: true });
    }
  }
}

/** 実行環境の環境変数から設定を読む。 */
export function providerEnvFromProcess(): ProviderEnv {
  return {
    dataProvider: process.env.DATA_PROVIDER,
    persistenceAllowed: process.env.PROVIDER_PERSISTENCE_ALLOWED,
    balldontlieApiKey: process.env.BALLDONTLIE_API_KEY,
  };
}
