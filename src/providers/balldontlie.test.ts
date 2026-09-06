import { describe, expect, it } from "vitest";

import {
  BalldontlieProvider,
  heightToCm,
  parseMinutes,
  poundsToKg,
  seasonStartYear,
} from "./balldontlie";
import { ApiShapeError, type FetchLike } from "./http";

/**
 * BALLDONTLIE の読み取り。
 *
 * 本物のAPIは叩かない（この環境から外部へ接続できない）。
 * 応答を差し替えて、
 *   ・想定どおりの形なら正しく読めること
 *   ・想定と違う形なら**黙って進めず止まること**
 * を確かめる。後者のほうが大事。誤ったデータを載せないための最後の砦になる。
 */

function pages(...bodies: unknown[]): FetchLike {
  let i = 0;
  return async () => {
    const body = bodies[Math.min(i, bodies.length - 1)];
    i += 1;
    return new Response(JSON.stringify(body), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };
}

function provider(fetchImpl: FetchLike, overrides = {}) {
  return new BalldontlieProvider({
    apiKey: "test-key",
    persistenceAllowed: true,
    fetchImpl,
    sleep: async () => {},
    minIntervalMs: 0,
    ...overrides,
  });
}

const PLAYER_PAGE = {
  data: [
    {
      id: 237,
      first_name: "Sample",
      last_name: "Player",
      height_feet: 6,
      height_inches: 9,
      weight_pounds: 250,
    },
  ],
  meta: { next_cursor: null },
};

describe("選手の取得", () => {
  it("名前・身長・体重を読み取る", async () => {
    const p = provider(pages(PLAYER_PAGE));

    const players = await p.fetchPlayers();

    expect(players).toHaveLength(1);
    expect(players[0]).toMatchObject({
      externalId: "237",
      fullNameEn: "Sample Player",
      heightCm: 206,
      weightKg: 113,
    });
  });

  it("IDが数値でも文字列として扱う", async () => {
    const p = provider(pages(PLAYER_PAGE));
    const players = await p.fetchPlayers();

    expect(typeof players[0]!.externalId).toBe("string");
  });

  it("身長・体重が無ければ null（0 にしない）", async () => {
    // 0cm の選手は存在しない。取れなかったことを 0 で表すと嘘になる。
    const p = provider(
      pages({
        data: [{ id: 1, first_name: "No", last_name: "Body" }],
        meta: { next_cursor: null },
      }),
    );

    const players = await p.fetchPlayers();

    expect(players[0]!.heightCm).toBeNull();
    expect(players[0]!.weightKg).toBeNull();
    expect(players[0]!.birthDate).toBeNull();
  });

  it("複数ページを最後まで取る", async () => {
    const p = provider(
      pages(
        { data: [{ id: 1, first_name: "A", last_name: "One" }], meta: { next_cursor: 2 } },
        { data: [{ id: 2, first_name: "B", last_name: "Two" }], meta: { next_cursor: null } },
      ),
    );

    const players = await p.fetchPlayers();

    expect(players.map((x) => x.externalId)).toEqual(["1", "2"]);
  });

  it("次ページの手がかりが同じ値を繰り返したら止める", async () => {
    // 進んでいないのに叩き続けると、レート制限を使い切る。
    const p = provider(
      pages({
        data: [{ id: 1, first_name: "A", last_name: "One" }],
        meta: { next_cursor: "same" },
      }),
    );

    await expect(p.fetchPlayers()).rejects.toThrow(/繰り返しています/);
  });

  it("ページ数の上限で打ち切る", async () => {
    let n = 0;
    const fetchImpl: FetchLike = async () => {
      n += 1;
      return new Response(
        JSON.stringify({
          data: [{ id: n, first_name: "A", last_name: String(n) }],
          meta: { next_cursor: n + 1 },
        }),
        { status: 200 },
      );
    };
    const p = provider(fetchImpl, { maxPages: 3 });

    await expect(p.fetchPlayers()).rejects.toThrow(/上限/);
  });
});

describe("想定と違う形が来たとき", () => {
  it("data が配列でなければ止める", async () => {
    const p = provider(pages({ data: { id: 1 } }));

    await expect(p.fetchPlayers()).rejects.toThrow(ApiShapeError);
  });

  it("必須の項目が無ければ、実際に来たキーを添えて止める", async () => {
    // 何が来たか分からないと、直しようがない。
    const p = provider(
      pages({ data: [{ id: 1, name: "Full Name" }], meta: { next_cursor: null } }),
    );

    await expect(p.fetchPlayers()).rejects.toThrow(/id, name/);
  });

  it("止めるときのメッセージが、誤ったデータが載る危険を伝える", async () => {
    const p = provider(pages({ data: [{ id: 1 }], meta: { next_cursor: null } }));

    await expect(p.fetchPlayers()).rejects.toThrow(/誤ったデータがサイトに載ります/);
  });

  it("応答がオブジェクトでなければ止める", async () => {
    const p = provider(pages([{ id: 1 }]));

    await expect(p.fetchPlayers()).rejects.toThrow(ApiShapeError);
  });
});

describe("シーズン成績", () => {
  const STATS_PAGE = {
    data: [
      {
        player_id: 237,
        games_played: 70,
        min: "34:12",
        fgm: 9.1,
        fga: 18.3,
        pts: 25.4,
      },
    ],
    meta: { next_cursor: null },
  };

  it("実数を読み取る", async () => {
    const p = provider(pages(STATS_PAGE));

    const stats = await p.fetchSeasonStats({ seasonId: "2024-25", seasonType: "regular" });

    expect(stats[0]).toMatchObject({
      playerExternalId: "237",
      seasonId: "2024-25",
      gamesPlayed: 70,
      fieldGoalsMade: 9.1,
      points: 25.4,
    });
  });

  it("どのチームでの成績か分からないときは埋めない", async () => {
    const p = provider(pages(STATS_PAGE));
    const stats = await p.fetchSeasonStats({ seasonId: "2024-25", seasonType: "regular" });

    expect(stats[0]!.teamExternalId).toBeNull();
  });

  it("プレーオフは対応していないと明示して断る", async () => {
    // 黙ってレギュラーシーズンの値を返すと、
    // プレーオフの欄にレギュラーの数字が載る。
    const p = provider(pages(STATS_PAGE));

    await expect(
      p.fetchSeasonStats({ seasonId: "2024-25", seasonType: "playoff" }),
    ).rejects.toThrow(/プレーオフの成績に対応していません/);
  });

  it("シーズンの指定を開始年の数値に直して送る", async () => {
    let requestedUrl = "";
    const fetchImpl: FetchLike = async (url) => {
      requestedUrl = url;
      return new Response(JSON.stringify({ data: [], meta: { next_cursor: null } }), {
        status: 200,
      });
    };
    const p = provider(fetchImpl);

    await p.fetchSeasonStats({ seasonId: "2023-24", seasonType: "regular" });

    expect(requestedUrl).toContain("season=2023");
  });
});

describe("値の変換", () => {
  it("身長をセンチにする", () => {
    expect(heightToCm(6, 9)).toBe(206);
    expect(heightToCm(7, 0)).toBe(213);
  });

  it("身長が取れなければ null（0cm にしない）", () => {
    // Number(null) は 0 になる。素直に渡すと
    // 「身長が取れなかった選手」が「0cmの選手」としてサイトに載る。
    expect(heightToCm(null, null)).toBeNull();
    expect(heightToCm(undefined, 5)).toBeNull();
    expect(heightToCm("", "")).toBeNull();
    expect(heightToCm("unknown", 5)).toBeNull();
  });

  it("インチが欠けていてもフィートがあれば出す", () => {
    // 6フィートちょうどは inches が無いことがある。
    expect(heightToCm(6, null)).toBe(183);
  });

  it("体重をキログラムにする", () => {
    expect(poundsToKg(250)).toBe(113);
  });

  it("体重が取れないか、ありえない値なら null", () => {
    expect(poundsToKg(0)).toBeNull();
    expect(poundsToKg(null)).toBeNull();
    expect(poundsToKg("heavy")).toBeNull();
  });

  it("出場時間の 分:秒 を分に直す", () => {
    expect(parseMinutes("34:12")).toBe(34.2);
    expect(parseMinutes("0:30")).toBe(0.5);
  });

  it("出場時間が数値ならそのまま", () => {
    expect(parseMinutes(28.5)).toBe(28.5);
  });

  it("出場時間が読み取れなければ null（0 にしない）", () => {
    // 0分と「取れなかった」は違う。0にすると36分換算が算出不可でなく0になる。
    expect(parseMinutes("")).toBeNull();
    expect(parseMinutes(null)).toBeNull();
    expect(parseMinutes("あとで")).toBeNull();
  });

  it("シーズンの開始年を取り出す", () => {
    expect(seasonStartYear("2024-25")).toBe(2024);
  });

  it("シーズンの指定が不正なら止める", () => {
    expect(() => seasonStartYear("bad")).toThrow(/シーズンの指定/);
  });
});

describe("永続保存の許諾", () => {
  it("許諾の値をそのまま持つ（勝手に true にしない）", () => {
    const p = provider(pages(PLAYER_PAGE), { persistenceAllowed: false });

    expect(p.persistenceAllowed).toBe(false);
  });
});

describe("提供できるもの", () => {
  it("確認できていない機能は false のままにする", () => {
    const p = provider(pages(PLAYER_PAGE));

    // 取れると確認できるまで true にしない。
    // true にして取れなければ、移籍した選手の成績が片方のチームに丸ごと付く。
    expect(p.capabilities.supportsStintSplit).toBe(false);
    expect(p.capabilities.supportsPlayoffs).toBe(false);
    expect(p.capabilities.supportsTeamStats).toBe(false);
  });

  it("高度指標（BPM/VORP）は提供できるとしない", () => {
    const p = provider(pages(PLAYER_PAGE));

    expect(p.capabilities.metrics).not.toContain("bpm");
    expect(p.capabilities.metrics).not.toContain("vorp");
  });
});
