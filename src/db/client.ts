import { Pool, type QueryResultRow } from "pg";

import "server-only";

/**
 * データベースへの接続（W2-5 以降の画面が使う）。
 *
 * 【なぜ Supabase のクライアントライブラリではなく pg を使うか】
 * 画面が読むのはほぼすべてビュー（率・キャリア集計・ランキング）です。
 * PostgREST 経由だとビューへの権限まわり（RLS がビューにどう効くか、
 * anon ロールへの grant が要るか）が絡み、それを**この開発環境からは確かめられません**。
 * 手元と CI で確かめられないものを本番の経路にすると、
 * 「本番でだけ空になる」という最悪の壊れ方をします。
 *
 * pg で直接つなげば、手元の PostgreSQL・CI・本番で同じ SQL が同じ結果を返します。
 *
 * 【接続文字列について】
 * Vercel のようなサーバーレスでは、リクエストのたびに新しい実行環境が立ち上がりえます。
 * 直接続だと接続数がすぐ上限に達するので、**Supabase のプーラー経由**にしてください。
 * 詳しい見分け方は docs/ROADMAP.md の「既知の注意点」にあります。
 *
 * 【prepared statement について】
 * pgbouncer のトランザクションモードは名前付き prepared statement を扱えません。
 * node-postgres は `name` を渡さない限り名前を付けないので、
 * ここでは**常に名前なしで問い合わせます**。query() に name を足さないこと。
 */

declare global {
  // 開発中はモジュールが再読み込みされるため、そのたびに新しいプールを作ると
  // 接続が積み上がって上限に達する。グローバルに1つだけ持たせて使い回す。
  var __nbaPool: Pool | undefined;
}

export class MissingDatabaseUrlError extends Error {
  constructor() {
    super(
      "DATABASE_URL が設定されていません。\n" +
        "  手元: .env.local に DATABASE_URL を書いてください（.env.example を参照）\n" +
        "  本番: Vercel の環境変数に DATABASE_URL を追加してください\n" +
        "  接続文字列は Supabase の Connect ボタンから取得します（docs/ROADMAP.md 既知の注意点）",
    );
    this.name = "MissingDatabaseUrlError";
  }
}

function createPool(connectionString: string): Pool {
  return new Pool({
    connectionString,
    // サーバーレスでは1つの実行環境が同時に捌く数は多くない。
    // 大きくしても効かず、接続数の上限を圧迫するだけなので小さく取る。
    max: 4,
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 10_000,
    // Supabase は証明書チェーンの検証に追加設定が要るため、
    // ローカル以外では検証を緩める。接続自体は TLS で暗号化される。
    ssl: connectionString.includes("localhost") ? false : { rejectUnauthorized: false },
  });
}

export function getPool(): Pool {
  const connectionString = process.env.DATABASE_URL?.trim();
  if (!connectionString) throw new MissingDatabaseUrlError();

  if (!globalThis.__nbaPool) {
    globalThis.__nbaPool = createPool(connectionString);
  }
  return globalThis.__nbaPool;
}

/**
 * 問い合わせ。読み取り専用の用途しか想定していない。
 *
 * 値の埋め込みは必ず $1, $2 … のプレースホルダを使うこと。
 * 文字列を連結して SQL を組み立てると、選手名やURLのクエリに
 * 仕込まれた文字列がそのまま SQL として実行される余地が生まれる。
 */
export async function query<T extends QueryResultRow>(
  text: string,
  params: readonly unknown[] = [],
): Promise<T[]> {
  const result = await getPool().query<T>(text, params as unknown[]);
  return result.rows;
}

/** 1行だけ取る。無ければ null。 */
export async function queryOne<T extends QueryResultRow>(
  text: string,
  params: readonly unknown[] = [],
): Promise<T | null> {
  const rows = await query<T>(text, params);
  return rows[0] ?? null;
}
