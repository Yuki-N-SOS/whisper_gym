import { describe, expect, it } from "vitest";
import {
  computePeak,
  computeRms,
  isTooQuiet,
  MAX_NORMALIZE_GAIN,
  NORMALIZE_TARGET_PEAK,
  normalizePeak,
  prepareWhisperAudio,
  SILENCE_RMS_THRESHOLD
} from "./audio";
import { AUDIO_CONSTRAINTS } from "./recorder";

/** 振幅 amp の矩形波(RMS = amp, ピーク = amp)。計算値を検証しやすい波形 */
function square(amp: number, length = 1000): Float32Array {
  const a = new Float32Array(length);
  for (let i = 0; i < length; i++) a[i] = i % 2 === 0 ? amp : -amp;
  return a;
}

describe("R-A1: 録音の音声制約", () => {
  it("autoGainControl が有効", () => {
    expect(AUDIO_CONSTRAINTS.autoGainControl).toBe(true);
  });

  it("既存のノイズ対策設定は維持している", () => {
    expect(AUDIO_CONSTRAINTS.channelCount).toBe(1);
    expect(AUDIO_CONSTRAINTS.echoCancellation).toBe(true);
    expect(AUDIO_CONSTRAINTS.noiseSuppression).toBe(true);
  });
});

describe("computeRms / computePeak", () => {
  it("矩形波の RMS は振幅に一致する", () => {
    expect(computeRms(square(0.5))).toBeCloseTo(0.5, 6);
  });

  it("無音は 0", () => {
    expect(computeRms(new Float32Array(100))).toBe(0);
    expect(computePeak(new Float32Array(100))).toBe(0);
  });

  it("空配列でも落ちない", () => {
    expect(computeRms(new Float32Array(0))).toBe(0);
  });

  it("ピークは絶対値の最大", () => {
    expect(computePeak(new Float32Array([0.1, -0.7, 0.3]))).toBeCloseTo(0.7, 6);
  });
});

describe("R-B1: RMS 音量ゲート", () => {
  it("閾値未満は tooQuiet", () => {
    expect(isTooQuiet(SILENCE_RMS_THRESHOLD - 0.0001)).toBe(true);
    expect(isTooQuiet(0)).toBe(true);
  });

  it("閾値以上は通す", () => {
    expect(isTooQuiet(SILENCE_RMS_THRESHOLD)).toBe(false);
    expect(isTooQuiet(0.05)).toBe(false);
  });

  it("ほぼ無音の録音はゲートで止まり、正規化もされない", () => {
    const quiet = square(0.001);
    const r = prepareWhisperAudio(quiet);
    expect(r.tooQuiet).toBe(true);
    expect(r.rms).toBeCloseTo(0.001, 6);
    // 正規化して大きくしてから返すと、幻覚の元になる無音が Whisper に届いてしまう
    expect(r.audio).toBe(quiet);
    expect(computePeak(r.audio)).toBeCloseTo(0.001, 6);
  });

  it("判定は正規化より前段(正規化後の音量では判定しない)", () => {
    // 正規化後はピーク 0.9 になる音量でも、生の RMS が小さければ弾く
    const quiet = square(0.001);
    expect(prepareWhisperAudio(quiet).tooQuiet).toBe(true);
    expect(computePeak(normalizePeak(quiet))).toBeGreaterThan(SILENCE_RMS_THRESHOLD);
  });

  it("ささやき声相当(閾値以上)は通してピーク正規化する", () => {
    const whisper = square(0.02);
    const r = prepareWhisperAudio(whisper);
    expect(r.tooQuiet).toBe(false);
    expect(r.rms).toBeCloseTo(0.02, 6);
    expect(computePeak(r.audio)).toBeGreaterThan(computePeak(whisper));
  });

  it("閾値は呼び出し側で差し替えられる(実機較正用)", () => {
    expect(prepareWhisperAudio(square(0.02), 0.1).tooQuiet).toBe(true);
  });
});

describe("R-A2: ピーク正規化", () => {
  it("ピークを目標値まで持ち上げる", () => {
    const out = normalizePeak(new Float32Array([0.1, -0.2, 0.15]));
    expect(computePeak(out)).toBeCloseTo(NORMALIZE_TARGET_PEAK, 6);
  });

  it("波形の形(比率と符号)は変えない", () => {
    const out = normalizePeak(new Float32Array([0.1, -0.2, 0.05]));
    expect(out[1] / out[0]).toBeCloseTo(-2, 6);
    expect(out[2] / out[0]).toBeCloseTo(0.5, 6);
  });

  it("大きすぎる入力は下げる(クリップ回避)", () => {
    expect(computePeak(normalizePeak(square(1)))).toBeCloseTo(NORMALIZE_TARGET_PEAK, 6);
  });

  it("ゲインには上限があり、ノイズを無制限に増幅しない", () => {
    const tiny = square(0.001); // 本来なら 900 倍必要
    expect(computePeak(normalizePeak(tiny))).toBeCloseTo(0.001 * MAX_NORMALIZE_GAIN, 6);
  });

  it("無音は変更しない(0 除算・NaN を出さない)", () => {
    const silence = new Float32Array(10);
    const out = normalizePeak(silence);
    expect(out).toBe(silence);
    expect([...out].every((v) => v === 0)).toBe(true);
  });

  it("入力の Float32Array は破壊しない", () => {
    const src = new Float32Array([0.1, -0.2]);
    normalizePeak(src);
    expect(src[0]).toBeCloseTo(0.1, 6);
    expect(src[1]).toBeCloseTo(-0.2, 6);
  });

  it("目標ピークを指定できる", () => {
    expect(computePeak(normalizePeak(square(0.3), 0.5))).toBeCloseTo(0.5, 6);
  });
});
