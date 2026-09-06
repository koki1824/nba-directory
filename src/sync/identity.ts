import type { PoolClient } from "pg";

/**
 * 外部のIDと、このサイトの中のIDを対応づける（W4-6）。
 *
 * 【なぜ名前で照合しないか】
 * 同姓同名の選手が実在する。名前で結びつけると、
 * **別人の成績が1人にまとまる**という、見つけにくく被害の大きい壊れ方をする。
 * 逆に、結婚・改名・表記ゆれで同じ人が別人に分かれることもある。
 *
 * 身元は**取得元が付けているID**で決める。名前は表示のためだけに使う。
 * その対応表が provider_entity_ids。
 *
 * 【同じ人を2回登録しないために】
 * (取得元, 種類, 外部ID) に一意制約があるので、
 * 同じ組み合わせで2回登録しようとしても増えない。
 * 同期を何度流しても同じ結果になる（冪等）のは、この制約が土台になっている。
 */

export type EntityType = "player" | "team" | "season";

/**
 * 外部IDから、このサイトの中のIDを引く。
 * 対応が無ければ null。呼び出し側が新しく作るか、飛ばすかを決める。
 */
export async function findInternalId(
  client: PoolClient,
  params: { sourceId: string; entityType: EntityType; externalId: string },
): Promise<string | null> {
  const { rows } = await client.query<{ internal_id: string }>(
    `select internal_id from public.provider_entity_ids
      where source_id = $1 and entity_type = $2 and provider_id = $3`,
    [params.sourceId, params.entityType, params.externalId],
  );
  return rows[0]?.internal_id ?? null;
}

/**
 * 対応を記録する。すでにあれば何もしない。
 *
 * 【上書きしない理由】
 * 一度«この外部IDはこの選手»と決めたものを黙って書き換えると、
 * それまでに積み上げた成績が別の選手のものになる。
 * 対応を変えたいときは、管理画面から人が確認して変える。
 */
export async function linkInternalId(
  client: PoolClient,
  params: {
    sourceId: string;
    entityType: EntityType;
    externalId: string;
    internalId: string;
  },
): Promise<{ created: boolean; internalId: string }> {
  const { rows } = await client.query<{ internal_id: string }>(
    `insert into public.provider_entity_ids (source_id, entity_type, provider_id, internal_id)
     values ($1, $2, $3, $4)
     on conflict (source_id, entity_type, provider_id) do nothing
     returning internal_id`,
    [params.sourceId, params.entityType, params.externalId, params.internalId],
  );

  if (rows.length > 0) return { created: true, internalId: rows[0]!.internal_id };

  // すでに対応がある。既存のほうを正とする。
  const existing = await findInternalId(client, params);
  return { created: false, internalId: existing ?? params.internalId };
}

/**
 * 同じ名前の選手が既にいるかを調べる。
 *
 * 【自動で結びつけないための関数】
 * 見つかっても自動では結びつけない。人が確認するための材料として返す。
 * 名前が同じというだけで同一人物とみなすと、別人の成績が混ざる。
 *
 * 生年月日が分かれば、同姓同名でも区別できる可能性が上がる。
 * 判断できる材料をすべて返し、決めるのは人に任せる。
 */
export async function findSameNameCandidates(
  client: PoolClient,
  params: { fullNameEn: string; birthDate: string | null },
): Promise<
  {
    id: string;
    slug: string;
    fullNameEn: string;
    birthDate: string | null;
    sameBirthDate: boolean;
  }[]
> {
  const { rows } = await client.query<{
    id: string;
    slug: string;
    full_name_en: string;
    birth_date: string | null;
  }>(
    `select id, slug, full_name_en, birth_date::text as birth_date
       from public.players
      where lower(full_name_en) = lower($1)`,
    [params.fullNameEn],
  );

  return rows.map((r) => ({
    id: r.id,
    slug: r.slug,
    fullNameEn: r.full_name_en,
    birthDate: r.birth_date,
    // 生年月日まで一致するなら同一人物の可能性が高い。
    // ただし「高い」だけで、確定ではない。決めるのは人。
    sameBirthDate:
      params.birthDate !== null && r.birth_date !== null && params.birthDate === r.birth_date,
  }));
}

/**
 * URLに使う slug を作る。
 *
 * 同姓同名がいるので、名前だけでは一意にならない。
 * 重複したら連番を足す。**既存のslugは絶対に変えない**
 * （変えるとその選手のURLが切れ、共有されたリンクが死ぬ）。
 */
export async function buildUniqueSlug(client: PoolClient, fullNameEn: string): Promise<string> {
  const base =
    fullNameEn
      .toLowerCase()
      .normalize("NFKD")
      // 記号と空白をハイフンに寄せる。URLに使えない文字を残さない。
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "player";

  const { rows } = await client.query<{ slug: string }>(
    `select slug from public.players where slug = $1 or slug like $1 || '-%'`,
    [base],
  );

  if (rows.length === 0) return base;

  const taken = new Set(rows.map((r) => r.slug));
  if (!taken.has(base)) return base;

  for (let i = 2; i < 1000; i += 1) {
    const candidate = `${base}-${i}`;
    if (!taken.has(candidate)) return candidate;
  }
  throw new Error(`slug を決められませんでした: ${fullNameEn}`);
}
