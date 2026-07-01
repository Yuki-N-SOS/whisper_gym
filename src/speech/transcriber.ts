/**
 * 音声 → テキスト変換(フェーズ1で実装)。
 * transformers.js で Whisper 系 ONNX モデルをブラウザ内実行する予定。
 * モデル ID は設定で差し替え可能にする(design.md §6)。
 */

export interface TranscribeResult {
  text: string;
  /** 推論にかかった時間(実機計測・モデル比較用) */
  durationMs: number;
}

export const DEFAULT_MODEL_ID = "onnx-community/whisper-base";

export async function transcribe(_audio: Blob): Promise<TranscribeResult> {
  throw new Error("未実装: フェーズ1(技術検証)で transformers.js を組み込む");
}
