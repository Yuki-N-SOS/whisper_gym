/**
 * 音声 → テキスト変換。transformers.js で Whisper 系 ONNX モデルをブラウザ内実行する。
 * モデル ID は差し替え可能(design.md §6・§11)。
 * モデル本体は Hugging Face から初回ダウンロードされ、ブラウザのキャッシュに保存される。
 */
import {
  pipeline,
  type AutomaticSpeechRecognitionPipeline,
  type ProgressInfo
} from "@huggingface/transformers";

export interface TranscribeResult {
  text: string;
  /** 推論にかかった時間(実機計測・モデル比較用) */
  durationMs: number;
}

export type Device = "wasm" | "webgpu";
export type Dtype = "q8" | "q4" | "fp32";

export interface ModelOptions {
  device: Device;
  dtype: Dtype;
}

export const DEFAULT_MODEL_ID = "onnx-community/whisper-base";

/** フェーズ1で実機比較するモデル候補(design.md §6) */
export const MODEL_PRESETS: ReadonlyArray<{ id: string; label: string }> = [
  { id: "onnx-community/whisper-base", label: "whisper-base(第一候補)" },
  { id: "onnx-community/kotoba-whisper-v2.2-ONNX", label: "kotoba-whisper v2.2(日本語特化)" },
  { id: "onnx-community/whisper-small", label: "whisper-small(大きめ・メモリ注意)" }
];

interface LoadedModel {
  modelId: string;
  options: ModelOptions;
  pipe: AutomaticSpeechRecognitionPipeline;
}

// iPhone Safari のメモリ制約のため、同時に保持するモデルは 1 つだけ
let loaded: LoadedModel | null = null;

export function getLoadedModelId(): string | null {
  return loaded?.modelId ?? null;
}

/**
 * モデルを読み込む。別モデルが読み込み済みの場合は先に破棄してメモリを空ける。
 * onProgress にはダウンロード進捗(status: "progress_total" で全体 %)が届く。
 */
export async function loadModel(
  modelId: string,
  options: ModelOptions,
  onProgress?: (info: ProgressInfo) => void
): Promise<void> {
  if (loaded !== null) {
    if (
      loaded.modelId === modelId &&
      loaded.options.device === options.device &&
      loaded.options.dtype === options.dtype
    ) {
      return;
    }
    await loaded.pipe.dispose();
    loaded = null;
  }

  const pipe = await pipeline("automatic-speech-recognition", modelId, {
    device: options.device,
    dtype: options.dtype,
    progress_callback: onProgress
  });
  loaded = { modelId, options, pipe };
}

/** pipeline の出力(型定義が緩いため実行時に検証する)からテキストを取り出す */
function extractText(output: unknown): string {
  if (Array.isArray(output)) return output.map(extractText).join("");
  if (
    typeof output === "object" &&
    output !== null &&
    "text" in output &&
    typeof (output as { text: unknown }).text === "string"
  ) {
    return (output as { text: string }).text;
  }
  throw new Error("音声認識の出力形式が想定外でした");
}

/**
 * 16kHz モノラルの音声データを文字起こしする(recorder.ts の decodeToWhisperInput で変換する)。
 */
export async function transcribe(audio: Float32Array): Promise<TranscribeResult> {
  if (loaded === null) throw new Error("モデルが読み込まれていません");

  const start = performance.now();
  const output: unknown = await loaded.pipe(audio, {
    language: "japanese",
    task: "transcribe"
  });
  return {
    text: extractText(output).trim(),
    durationMs: performance.now() - start
  };
}
