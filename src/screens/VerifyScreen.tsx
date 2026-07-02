/**
 * フェーズ1の技術検証画面(検証完了後に削除予定)。
 * - Whisper 系モデルを切り替えて、ささやき声の認識率・処理時間を実機計測する
 * - 比較ベースラインとして Web Speech API でも同じ発話を計測する
 * 判断基準: 種目名+数値が 8 割以上拾えれば OK(docs/roadmap.md)
 */
import { useRef, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { loadDictionary } from "../db/queries";
import { parse } from "../parser/parse";
import { decodeToWhisperInput, pickRecordingMimeType, startRecording, type RecordingHandle } from "../speech/recorder";
import { loadModel, transcribe, MODEL_PRESETS, DEFAULT_MODEL_ID, type Device, type Dtype } from "../speech/transcriber";
import { isWebSpeechAvailable, startWebSpeech, type WebSpeechHandle } from "../speech/webSpeech";

interface TrialLog {
  id: number;
  engine: string;
  text: string;
  audioMs: number | null;
  processMs: number;
  parsedSummary: string;
}

type ModelState = "unloaded" | "loading" | "ready";
type RecordState = "idle" | "recording" | "transcribing";

function formatMb(bytes: number): string {
  return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
}

function formatSec(ms: number): string {
  return `${(ms / 1000).toFixed(1)}秒`;
}

export function VerifyScreen() {
  const dictionary = useLiveQuery(loadDictionary, [], []);

  const [modelChoice, setModelChoice] = useState<string>(DEFAULT_MODEL_ID);
  const [customModelId, setCustomModelId] = useState("");
  const [device, setDevice] = useState<Device>("wasm");
  // q8 は transformers.js 4.2.0 同梱の onnxruntime でセッション作成に失敗する
  // (whisper-base で確認。design.md §6)ため q4 を既定にする
  const [dtype, setDtype] = useState<Dtype>("q4");
  const [modelState, setModelState] = useState<ModelState>("unloaded");
  const [progress, setProgress] = useState<{ pct: number | null; label: string } | null>(null);
  const [loadMs, setLoadMs] = useState<number | null>(null);

  const [recordState, setRecordState] = useState<RecordState>("idle");
  const [webSpeechActive, setWebSpeechActive] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [logs, setLogs] = useState<TrialLog[]>([]);

  const recordingRef = useRef<RecordingHandle | null>(null);
  const webSpeechRef = useRef<WebSpeechHandle | null>(null);
  const logIdRef = useRef(0);

  const modelId = modelChoice === "custom" ? customModelId.trim() : modelChoice;

  function appendLog(engine: string, text: string, audioMs: number | null, processMs: number) {
    const parsed = parse(text, dictionary);
    const parsedSummary =
      text === ""
        ? "(空)"
        : `種目: ${parsed.exerciseName ?? "不明"} / ` +
          `${parsed.weightKg !== null ? `${parsed.weightKg}kg` : "—"} / ` +
          `${parsed.reps !== null ? `${parsed.reps}回` : "—"}`;
    logIdRef.current += 1;
    setLogs((prev) => [{ id: logIdRef.current, engine, text, audioMs, processMs, parsedSummary }, ...prev]);
  }

  async function handleLoadModel() {
    if (modelId === "") {
      setMessage("モデル ID を入力してください");
      return;
    }
    setMessage(null);
    setModelState("loading");
    setLoadMs(null);
    setProgress({ pct: null, label: "読み込み中…(キャッシュ済みなら数秒)" });
    const start = performance.now();
    try {
      await loadModel(modelId, { device, dtype }, (info) => {
        if (info.status === "progress_total") {
          setProgress({
            pct: info.progress,
            label: `ダウンロード中 ${formatMb(info.loaded)} / ${formatMb(info.total)}`
          });
        }
      });
      setLoadMs(performance.now() - start);
      setModelState("ready");
      setProgress(null);
    } catch (e) {
      setModelState("unloaded");
      setProgress(null);
      setMessage(`モデル読み込み失敗: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  async function handleRecordToggle() {
    if (recordState === "recording") {
      recordingRef.current?.stop();
      return;
    }
    if (recordState !== "idle") return;
    setMessage(null);
    try {
      recordingRef.current = await startRecording(async (result) => {
        recordingRef.current = null;
        setRecordState("transcribing");
        try {
          const { audio, audioMs } = await decodeToWhisperInput(result.blob);
          const { text, durationMs } = await transcribe(audio);
          appendLog(`Whisper (${modelId})`, text, audioMs, durationMs);
        } catch (e) {
          setMessage(`認識失敗: ${e instanceof Error ? e.message : String(e)}`);
        } finally {
          setRecordState("idle");
        }
      });
      setRecordState("recording");
    } catch (e) {
      setMessage(`マイクを使えません: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  function handleWebSpeechToggle() {
    if (webSpeechActive) {
      webSpeechRef.current?.stop();
      return;
    }
    setMessage(null);
    const handle = startWebSpeech(
      (result) => {
        setWebSpeechActive(false);
        appendLog("Web Speech API", result.text, null, result.durationMs);
      },
      (msg) => {
        setWebSpeechActive(false);
        setMessage(msg);
      }
    );
    if (handle === null) {
      setMessage("この環境では Web Speech API を使えません");
      return;
    }
    webSpeechRef.current = handle;
    setWebSpeechActive(true);
  }

  const isStandalone = window.matchMedia("(display-mode: standalone)").matches;
  const hasWebGpu = "gpu" in navigator;

  return (
    <div className="screen">
      <h1>検証(フェーズ1)</h1>

      <section className="card">
        <h2>環境情報</h2>
        <ul className="info-list">
          <li>WebGPU: {hasWebGpu ? "対応" : "非対応(WASM を使用)"}</li>
          <li>表示モード: {isStandalone ? "スタンドアロン(ホーム画面)" : "ブラウザタブ"}</li>
          <li>録音形式: {pickRecordingMimeType() ?? "MediaRecorder 非対応!"}</li>
          <li>Web Speech API: {isWebSpeechAvailable() ? "対応" : "非対応"}</li>
        </ul>
        <p className="muted">{navigator.userAgent}</p>
      </section>

      <section className="card">
        <h2>1. モデルを読み込む</h2>
        <select value={modelChoice} onChange={(e) => setModelChoice(e.target.value)} disabled={modelState === "loading"}>
          {MODEL_PRESETS.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
          <option value="custom">カスタム(ID を直接入力)</option>
        </select>
        {modelChoice === "custom" && (
          <input
            type="text"
            value={customModelId}
            onChange={(e) => setCustomModelId(e.target.value)}
            placeholder="例: onnx-community/whisper-tiny"
          />
        )}
        <div className="row">
          <label>
            実行:
            <select value={device} onChange={(e) => setDevice(e.target.value as Device)} disabled={modelState === "loading"}>
              <option value="wasm">WASM</option>
              <option value="webgpu">WebGPU</option>
            </select>
          </label>
          <label>
            量子化:
            <select value={dtype} onChange={(e) => setDtype(e.target.value as Dtype)} disabled={modelState === "loading"}>
              <option value="q4">q4(推奨)</option>
              <option value="q8">q8</option>
              <option value="fp32">fp32</option>
            </select>
          </label>
        </div>
        <p className="muted">初回は数十〜数百 MB をダウンロードします。Wi-Fi 推奨。2 回目以降はキャッシュから読みます。</p>
        <button type="button" onClick={handleLoadModel} disabled={modelState === "loading"}>
          {modelState === "loading" ? "読み込み中…" : "モデルを読み込む"}
        </button>
        {progress !== null && (
          <div className="progress-area">
            <div className="progress-track">
              <div className="progress-fill" style={{ width: `${progress.pct ?? 0}%` }} />
            </div>
            <p className="muted">{progress.label}</p>
          </div>
        )}
        {modelState === "ready" && loadMs !== null && (
          <p className="message">読み込み完了({formatSec(loadMs)})</p>
        )}
      </section>

      <section className="card">
        <h2>2. Whisper で計測</h2>
        <p className="muted">口元 10cm でささやいてください。例: 「ベンチプレス 60キロ 10回」(最大 15 秒)</p>
        <button
          type="button"
          className={recordState === "recording" ? "record-button recording" : "record-button"}
          onClick={handleRecordToggle}
          disabled={modelState !== "ready" || recordState === "transcribing"}
        >
          {recordState === "recording"
            ? "■ 停止して認識する"
            : recordState === "transcribing"
              ? "認識中…"
              : modelState === "ready"
                ? "● 録音開始"
                : "先にモデルを読み込んでください"}
        </button>
      </section>

      <section className="card">
        <h2>3. Web Speech API で計測(比較用)</h2>
        <button type="button" className="record-button" onClick={handleWebSpeechToggle} disabled={!isWebSpeechAvailable()}>
          {webSpeechActive ? "■ 停止" : "● 認識開始"}
        </button>
      </section>

      {message !== null && <p className="message">{message}</p>}

      <section className="card">
        <h2>試行ログ(新しい順)</h2>
        {logs.length === 0 ? (
          <p className="muted">まだ試行がありません</p>
        ) : (
          <ul className="set-list">
            {logs.map((log) => (
              <li key={log.id}>
                <div className="muted">
                  {log.engine} / 処理 {formatSec(log.processMs)}
                  {log.audioMs !== null ? ` / 音声 ${formatSec(log.audioMs)}` : ""}
                </div>
                <div>「{log.text}」</div>
                <div className="muted">{log.parsedSummary}</div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
