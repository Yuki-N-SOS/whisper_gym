import { describe, expect, it } from "vitest";
import { isHallucinationOnly, stripHallucinations } from "./hallucination";
import { EXERCISE_SEED } from "./exercises";
import { parse, type DictionaryEntry } from "./parse";

const dict: DictionaryEntry[] = EXERCISE_SEED.map((e) => ({ name: e.name, aliases: e.aliases }));

describe("R-B2: 全文が幻覚のケース", () => {
  // 実測で出た幻覚はここに追加していく(CLAUDE.md: 誤認識パターンをテストに蓄積)
  const knownHallucinations = [
    "ご視聴ありがとうございました",
    "ご視聴ありがとうございました。",
    "最後までご視聴いただきありがとうございました。",
    "ご清聴ありがとうございました",
    "チャンネル登録お願いします",
    "高評価、チャンネル登録よろしくお願いします。",
    "ありがとうございました",
    "本日はありがとうございました",
    "また次の動画でお会いしましょう",
    "お疲れ様でした。",
    "おやすみなさい",
    "字幕視聴者",
    "Thank you for watching!",
    "(音楽)",
    "♪♪♪",
    "ご視聴ありがとうございました。チャンネル登録お願いします。"
  ];

  it.each(knownHallucinations)("「%s」は丸ごと除去される", (text) => {
    expect(stripHallucinations(text)).toBe("");
    expect(isHallucinationOnly(text)).toBe(true);
  });

  it("空文字は幻覚ではない(無音として扱う)", () => {
    expect(isHallucinationOnly("")).toBe(false);
    expect(stripHallucinations("")).toBe("");
  });
});

describe("R-B2: 幻覚が発話に混ざるケース", () => {
  it("末尾に付いた幻覚だけを落とす", () => {
    expect(stripHallucinations("ベンチプレス60キロ10回。ご視聴ありがとうございました。")).toBe(
      "ベンチプレス60キロ10回"
    );
  });

  it("先頭に付いた幻覚だけを落とす", () => {
    expect(stripHallucinations("ご視聴ありがとうございました。スクワット80キロ8回")).toBe(
      "スクワット80キロ8回"
    );
  });

  it("除去後のテキストはパーサーが従来どおり解釈できる", () => {
    const cleaned = stripHallucinations("ご視聴ありがとうございました。ベンチプレス 60キロ 10回");
    const r = parse(cleaned, dict);
    expect(r.exerciseName).toBe("ベンチプレス");
    expect(r.weightKg).toBe(60);
    expect(r.reps).toBe(10);
    expect(r.confidence).toBe("exact");
  });

  it("混在テキストは isHallucinationOnly にならない", () => {
    expect(isHallucinationOnly("ベンチプレス60キロ10回。ご視聴ありがとうございました。")).toBe(false);
  });
});

describe("R-B2: 正常な発話を壊さない", () => {
  const normal = [
    "ベンチプレス 60キロ 10回",
    "ラットプルダウン、40キロ、12回。",
    "腕立て伏せ 20回",
    "デッドリフト 百二十キロ 五回"
  ];

  it.each(normal)("「%s」はそのまま残る", (text) => {
    expect(stripHallucinations(text)).toBe(text.replace(/。$/, ""));
    expect(isHallucinationOnly(text)).toBe(false);
  });

  it("種目名の一部が幻覚フレーズに巻き込まれない", () => {
    const r = parse(stripHallucinations("チンニング 10回"), dict);
    expect(r.reps).toBe(10);
    expect(r.exerciseName).not.toBeNull();
  });
});
