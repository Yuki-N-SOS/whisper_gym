import { describe, expect, it } from "vitest";
import { EXERCISE_SEED } from "./exercises";
import { parse, type DictionaryEntry } from "./parse";

const dict: DictionaryEntry[] = EXERCISE_SEED.map((e) => ({
  name: e.name,
  aliases: e.aliases
}));

describe("parse: 基本形", () => {
  it("種目 + 重量 + 回数", () => {
    const r = parse("ベンチプレス 60キロ 10回", dict);
    expect(r.exerciseName).toBe("ベンチプレス");
    expect(r.weightKg).toBe(60);
    expect(r.reps).toBe(10);
    expect(r.confidence).toBe("exact");
  });

  it("句読点付き(Whisper がよく付ける)", () => {
    const r = parse("ラットプルダウン、40キロ、12回。", dict);
    expect(r.exerciseName).toBe("ラットプルダウン");
    expect(r.weightKg).toBe(40);
    expect(r.reps).toBe(12);
  });

  it("kg 表記・小数の重量", () => {
    const r = parse("スクワット 82.5kg 8回", dict);
    expect(r.exerciseName).toBe("スクワット");
    expect(r.weightKg).toBe(82.5);
    expect(r.reps).toBe(8);
  });

  it("漢数字の発話", () => {
    const r = parse("デッドリフト 百二十キロ 五回", dict);
    expect(r.exerciseName).toBe("デッドリフト");
    expect(r.weightKg).toBe(120);
    expect(r.reps).toBe(5);
  });

  it("漢数字の小数", () => {
    const r = parse("ベンチプレス 六十二点五キロ 十回", dict);
    expect(r.weightKg).toBe(62.5);
    expect(r.reps).toBe(10);
  });
});

describe("parse: 自重種目・欠損フィールド", () => {
  it("重量なし(自重)", () => {
    const r = parse("腕立て伏せ 20回", dict);
    expect(r.exerciseName).toBe("腕立て伏せ");
    expect(r.weightKg).toBeNull();
    expect(r.reps).toBe(20);
  });

  it("回数なし → reps は null(推測で埋めない)", () => {
    const r = parse("ベンチプレス 60キロ", dict);
    expect(r.exerciseName).toBe("ベンチプレス");
    expect(r.weightKg).toBe(60);
    expect(r.reps).toBeNull();
  });

  it("種目が辞書になければ exerciseName は null", () => {
    const r = parse("謎の運動 30キロ 10回", dict);
    expect(r.exerciseName).toBeNull();
    expect(r.confidence).toBe("none");
    expect(r.weightKg).toBe(30);
    expect(r.reps).toBe(10);
  });

  it("空文字列", () => {
    const r = parse("", dict);
    expect(r.exerciseName).toBeNull();
    expect(r.weightKg).toBeNull();
    expect(r.reps).toBeNull();
  });
});

describe("parse: 別名・ゆらぎの吸収", () => {
  it("別名(ベンチ → ベンチプレス)", () => {
    const r = parse("ベンチ 60キロ 10回", dict);
    expect(r.exerciseName).toBe("ベンチプレス");
    expect(r.confidence).toBe("alias");
  });

  it("別名(ラットプル → ラットプルダウン)", () => {
    const r = parse("ラットプル 40キロ 12回", dict);
    expect(r.exerciseName).toBe("ラットプルダウン");
  });

  it("別名(チンニング → 懸垂)", () => {
    const r = parse("チンニング 8回", dict);
    expect(r.exerciseName).toBe("懸垂");
  });

  it("部分一致: 語尾の誤認識でも既知の別名を含めば吸収する", () => {
    // 「ベンチプレフ」は別名「ベンチ」を含むため部分一致で拾える
    const r = parse("ベンチプレフ 60キロ 10回", dict);
    expect(r.exerciseName).toBe("ベンチプレス");
    expect(r.confidence).toBe("partial");
  });

  it("あいまいマッチ: 1文字の誤認識を編集距離で吸収する", () => {
    // Whisper がささやき声で誤認識しがちなパターンの想定。
    // フェーズ1の実測で本物の誤認識サンプルに置き換え・追加していく
    const r = parse("スクワッド 80キロ 8回", dict);
    expect(r.exerciseName).toBe("スクワット");
    expect(r.confidence).toBe("fuzzy");
  });

  it("あいまいマッチ: 遠すぎる文字列は種目不明にする", () => {
    const r = parse("ジョギング 10回", dict);
    expect(r.exerciseName).toBeNull();
  });
});

describe("parse: rawText の保持", () => {
  it("原文をそのまま保持する(デバッグ・辞書改善用)", () => {
    const raw = "ベンチプレス 60キロ 10回。";
    expect(parse(raw, dict).rawText).toBe(raw);
  });
});
