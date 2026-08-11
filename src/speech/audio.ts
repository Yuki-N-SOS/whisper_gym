/**
 * Whisper へ渡す前の音声前処理(docs/whisper-accuracy-requirements.md R-A2 / R-B1)。
 * 副作用なしの純粋関数のみ(ユニットテスト可能にするため Web Audio API に依存しない)。
 *
 * 処理順序は「音量ゲート判定 → ピーク正規化」で固定する。
 * 正規化してから RMS を測ると、どんな小さい入力もゲートを通過してしまうため。
 */

/**
 * 音量ゲートの閾値(RMS、-1..1 のフルスケール基準)。
 *
 * 0.005 ≒ -46 dBFS。マイク自体のノイズフロア(おおむね -60 dBFS 前後)より上、
 * 口元 10cm のささやき声(実測待ち)より下、を狙った暫定値。
 * **実機のささやき声サンプルで較正すること**(VerifyScreen の試行ログに RMS を表示している)。
 * 高すぎると本物のささやき声を弾き、低すぎると無音が Whisper に届いて幻覚を招く。
 */
export const SILENCE_RMS_THRESHOLD = 0.005;

/** ピーク正規化の目標振幅。1.0 だとクリップ感が出るため少し余裕を持たせる */
export const NORMALIZE_TARGET_PEAK = 0.9;

/**
 * ピーク正規化で許す最大ゲイン。
 * ゲートを通ったギリギリの小音量を無制限に持ち上げると、環境ノイズまで
 * 同じ倍率で増幅されて S/N が改善しないため上限を設ける。
 */
export const MAX_NORMALIZE_GAIN = 20;

/** 実効値(二乗平均平方根)。録音全体の平均的な音量を表す */
export function computeRms(audio: Float32Array): number {
  if (audio.length === 0) return 0;
  let sum = 0;
  for (let i = 0; i < audio.length; i++) {
    sum += audio[i] * audio[i];
  }
  return Math.sqrt(sum / audio.length);
}

/** 最大振幅(絶対値) */
export function computePeak(audio: Float32Array): number {
  let peak = 0;
  for (let i = 0; i < audio.length; i++) {
    const v = Math.abs(audio[i]);
    if (v > peak) peak = v;
  }
  return peak;
}

/** RMS が閾値未満か(= 推論に回さず録り直しを促す) */
export function isTooQuiet(rms: number, threshold: number = SILENCE_RMS_THRESHOLD): boolean {
  return rms < threshold;
}

/**
 * ピーク正規化(R-A2)。最大振幅が NORMALIZE_TARGET_PEAK になるようスケールする。
 * 端末側の AGC(R-A1)が効かない環境でも入力レベルを底上げするための保険。
 * 無音(ピーク 0)はそのまま返し、ゲインは MAX_NORMALIZE_GAIN で頭打ちにする。
 */
export function normalizePeak(
  audio: Float32Array,
  targetPeak: number = NORMALIZE_TARGET_PEAK
): Float32Array {
  const peak = computePeak(audio);
  if (peak === 0) return audio;
  const gain = Math.min(targetPeak / peak, MAX_NORMALIZE_GAIN);
  if (gain === 1) return audio;
  const out = new Float32Array(audio.length);
  for (let i = 0; i < audio.length; i++) {
    out[i] = audio[i] * gain;
  }
  return out;
}

export interface PreparedAudio {
  /** Whisper に渡す音声(tooQuiet のときは正規化せず元のまま) */
  audio: Float32Array;
  /** 正規化前の RMS(閾値較正・ログ用) */
  rms: number;
  /** 音量ゲートに引っかかった(推論に回してはいけない) */
  tooQuiet: boolean;
}

/**
 * 録音デコード後の音声を Whisper 入力に整える。
 * 1. 生の音声で RMS 音量ゲートを判定する(R-B1)
 * 2. 通過したものだけピーク正規化する(R-A2)
 */
export function prepareWhisperAudio(
  audio: Float32Array,
  threshold: number = SILENCE_RMS_THRESHOLD
): PreparedAudio {
  const rms = computeRms(audio);
  if (isTooQuiet(rms, threshold)) {
    return { audio, rms, tooQuiet: true };
  }
  return { audio: normalizePeak(audio), rms, tooQuiet: false };
}
