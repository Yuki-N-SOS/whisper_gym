import { describe, expect, it } from "vitest";
import { normalize } from "./normalize";

describe("normalize", () => {
  it("空白・句読点を除去する", () => {
    expect(normalize("ベンチプレス 60キロ 10回。")).toBe("ベンチプレス60キロ10回");
  });

  it("全角英数字を半角にする", () => {
    expect(normalize("ベンチプレス６０ｋｇ")).toBe("ベンチプレス60kg");
    expect(normalize("60㎏")).toBe("60kg");
  });

  it("英字を小文字化する", () => {
    expect(normalize("60KG")).toBe("60kg");
  });

  it("漢数字を算用数字にする", () => {
    expect(normalize("六十キロ")).toBe("60キロ");
    expect(normalize("六十二キロ")).toBe("62キロ");
    expect(normalize("百二十キロ")).toBe("120キロ");
    expect(normalize("十回")).toBe("10回");
    expect(normalize("八回")).toBe("8回");
  });

  it("漢数字の小数(点)を変換する", () => {
    expect(normalize("六十二点五キロ")).toBe("62.5キロ");
    expect(normalize("二点五キロ")).toBe("2.5キロ");
  });

  it("算用数字+「点」の小数を変換する(Whisper の頻出パターン)", () => {
    expect(normalize("62点5キロ")).toBe("62.5キロ");
    expect(normalize("10てん5")).toBe("10.5");
    expect(normalize("六十二点5キロ")).toBe("62.5キロ");
  });

  it("数字に挟まれていない「点」は変換しない", () => {
    expect(normalize("3点セット")).toBe("3点セット");
    expect(normalize("要点")).toBe("要点");
  });

  it("数字を含まないテキストはそのまま", () => {
    expect(normalize("スクワット")).toBe("スクワット");
  });
});
