/**
 * 音声認識モデルの選択(モデル ID・実行方式・量子化)を localStorage に保存する。
 * 記録画面と設定画面で同じ設定を共有するための唯一の窓口。
 * フェーズ1の実機比較で採用モデルが決まったら DEFAULT_CONFIG を更新する。
 */
import { DEFAULT_MODEL_ID, type Device, type Dtype } from "./transcriber";

export interface ModelConfig {
  modelId: string;
  device: Device;
  dtype: Dtype;
}

const STORAGE_KEY = "whisper_gym.modelConfig";

export const DEFAULT_CONFIG: ModelConfig = {
  modelId: DEFAULT_MODEL_ID,
  // q8 は同梱 onnxruntime でセッション作成に失敗するため q4 を既定にする(VerifyScreen と同じ判断)
  device: "wasm",
  dtype: "q4"
};

export function loadModelConfig(): ModelConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === null) return DEFAULT_CONFIG;
    const parsed = JSON.parse(raw) as Partial<ModelConfig>;
    return {
      modelId:
        typeof parsed.modelId === "string" && parsed.modelId.trim() !== ""
          ? parsed.modelId
          : DEFAULT_CONFIG.modelId,
      device: parsed.device === "webgpu" ? "webgpu" : "wasm",
      dtype: parsed.dtype === "q8" || parsed.dtype === "fp32" ? parsed.dtype : "q4"
    };
  } catch {
    // JSON 破損・localStorage 不可(プライベートモード等)では既定にフォールバック
    return DEFAULT_CONFIG;
  }
}

export function saveModelConfig(config: ModelConfig): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  } catch {
    /* 保存できなくても動作は続けられるため無視 */
  }
}
