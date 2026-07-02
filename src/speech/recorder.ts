/**
 * マイク録音(MediaRecorder)と、Whisper 入力用の 16kHz モノラル変換。
 * design.md §6「録音フロー」: トグル式・最大 15 秒・録音開始はユーザー操作起点。
 */

/** 1 発話 = 1 セットの記録を想定した最大録音長 */
export const MAX_RECORDING_MS = 15_000;

/** Whisper が要求するサンプリングレート */
export const WHISPER_SAMPLE_RATE = 16_000;

export interface RecordingResult {
  blob: Blob;
  mimeType: string;
  /** 録音開始から停止までの実時間 */
  durationMs: number;
}

export interface RecordingHandle {
  /** 録音を終了する(結果は startRecording の onStop に渡る) */
  stop(): void;
  /** 結果を破棄して終了する */
  cancel(): void;
}

/** 実行環境で使える録音 MIME タイプを返す(iOS Safari は audio/mp4) */
export function pickRecordingMimeType(): string | null {
  if (typeof MediaRecorder === "undefined") return null;
  const candidates = ["audio/mp4", "audio/webm;codecs=opus", "audio/webm"];
  return candidates.find((t) => MediaRecorder.isTypeSupported(t)) ?? null;
}

/**
 * 録音を開始する。stop() 呼び出しか MAX_RECORDING_MS 経過で終了し、
 * どちらの場合も onStop が呼ばれる。
 * ささやき声対策(design.md §6)として echoCancellation / noiseSuppression を有効にする。
 */
export async function startRecording(onStop: (result: RecordingResult) => void): Promise<RecordingHandle> {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: {
      channelCount: 1,
      echoCancellation: true,
      noiseSuppression: true
    }
  });

  const mimeType = pickRecordingMimeType();
  const recorder = mimeType === null ? new MediaRecorder(stream) : new MediaRecorder(stream, { mimeType });

  const chunks: Blob[] = [];
  const startedAt = performance.now();
  let cancelled = false;

  recorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data);
  };

  recorder.onstop = () => {
    stream.getTracks().forEach((t) => t.stop());
    clearTimeout(timer);
    if (cancelled) return;
    onStop({
      blob: new Blob(chunks, { type: recorder.mimeType }),
      mimeType: recorder.mimeType,
      durationMs: performance.now() - startedAt
    });
  };

  const stop = () => {
    if (recorder.state !== "inactive") recorder.stop();
  };
  const timer = setTimeout(stop, MAX_RECORDING_MS);

  recorder.start();

  return {
    stop,
    cancel() {
      cancelled = true;
      stop();
    }
  };
}

/**
 * 録音 Blob をデコードし、16kHz モノラル Float32Array(Whisper 入力形式)に変換する。
 */
export async function decodeToWhisperInput(blob: Blob): Promise<{ audio: Float32Array; audioMs: number }> {
  const ctx = new AudioContext();
  let decoded: AudioBuffer;
  try {
    decoded = await ctx.decodeAudioData(await blob.arrayBuffer());
  } finally {
    await ctx.close();
  }
  if (decoded.duration === 0) throw new Error("録音データが空です");

  const offline = new OfflineAudioContext(1, Math.ceil(decoded.duration * WHISPER_SAMPLE_RATE), WHISPER_SAMPLE_RATE);
  const source = offline.createBufferSource();
  source.buffer = decoded;
  source.connect(offline.destination);
  source.start();
  const rendered = await offline.startRendering();

  return { audio: rendered.getChannelData(0), audioMs: decoded.duration * 1000 };
}
