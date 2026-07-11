import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { parse } from "../parser/parse";
import {
  addSet,
  findExerciseByName,
  lastSetOfExercise,
  listExercises,
  listSetsByDate,
  loadDictionary
} from "../db/queries";
import { decodeToWhisperInput, startRecording, type RecordingHandle } from "../speech/recorder";
import { getLoadedModelId, loadModel, transcribe } from "../speech/transcriber";
import { loadModelConfig } from "../speech/modelConfig";
import { Reminders } from "../components/Reminders";

const CONFIDENCE_LABEL: Record<string, string> = {
  exact: "完全一致",
  alias: "別名一致",
  partial: "部分一致",
  fuzzy: "あいまい一致(要確認)",
  ambiguous: "候補が複数(要選択)",
  none: "種目不明"
};

type ModelState = "unloaded" | "loading" | "ready";
type RecordState = "idle" | "recording" | "transcribing";

function today(): string {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

export function RecordScreen() {
  const [text, setText] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  // 音声認識(モデル読み込みは大きな DL のため初回だけ明示的に実行する)
  const [modelState, setModelState] = useState<ModelState>(() =>
    getLoadedModelId() !== null ? "ready" : "unloaded"
  );
  const [progress, setProgress] = useState<{ pct: number | null; label: string } | null>(null);
  const [recordState, setRecordState] = useState<RecordState>("idle");
  const [recording, setRecording] = useState<RecordingHandle | null>(null);

  const dictionary = useLiveQuery(loadDictionary, [], []);
  const exercises = useLiveQuery(listExercises, [], []);
  const todaySets = useLiveQuery(() => listSetsByDate(today()), [], []);

  const parsed = text.trim() === "" ? null : parse(text, dictionary);
  const canSave = parsed !== null && parsed.exerciseName !== null && parsed.reps !== null;

  const exerciseNameById = new Map(exercises.map((e) => [e.id, e.name]));

  // 前回参照(F5): 認識/入力された種目の直近セットを表示する
  const prevSet = useLiveQuery(async () => {
    if (parsed === null || parsed.exerciseName === null) return null;
    const exercise = await findExerciseByName(parsed.exerciseName);
    if (exercise === undefined) return null;
    return (await lastSetOfExercise(exercise.id)) ?? null;
  }, [parsed?.exerciseName], null);

  async function handleLoadModel() {
    const config = loadModelConfig();
    setMessage(null);
    setModelState("loading");
    setProgress({ pct: null, label: "音声認識の準備中…(初回はモデルをダウンロード)" });
    try {
      await loadModel(config.modelId, { device: config.device, dtype: config.dtype }, (info) => {
        if (info.status === "progress_total") {
          const mb = (n: number) => `${(n / 1024 / 1024).toFixed(1)}MB`;
          setProgress({ pct: info.progress, label: `ダウンロード中 ${mb(info.loaded)} / ${mb(info.total)}` });
        }
      });
      setModelState("ready");
      setProgress(null);
    } catch (e) {
      setModelState("unloaded");
      setProgress(null);
      setMessage(`音声認識の準備に失敗しました: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  async function handleRecordToggle() {
    if (recordState === "recording") {
      recording?.stop();
      return;
    }
    if (recordState !== "idle" || modelState !== "ready") return;
    setMessage(null);
    try {
      const handle = await startRecording(async (result) => {
        setRecording(null);
        setRecordState("transcribing");
        try {
          const { audio } = await decodeToWhisperInput(result.blob);
          const { text: recognized } = await transcribe(audio);
          if (recognized === "") {
            setMessage("うまく聞き取れませんでした。もう一度話すか、下の欄に入力してください");
          } else {
            setText(recognized);
            setMessage("認識しました。内容を確認して保存してください");
          }
        } catch (e) {
          setMessage(`認識に失敗しました: ${e instanceof Error ? e.message : String(e)}`);
        } finally {
          setRecordState("idle");
        }
      });
      setRecording(handle);
      setRecordState("recording");
    } catch (e) {
      setMessage(`マイクを使えません: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  async function handleSave() {
    if (parsed === null || parsed.exerciseName === null || parsed.reps === null) return;
    const exercise = await findExerciseByName(parsed.exerciseName);
    if (exercise === undefined) {
      setMessage("種目が見つかりませんでした");
      return;
    }
    await addSet({
      exerciseId: exercise.id,
      weightKg: parsed.weightKg,
      reps: parsed.reps,
      rawText: parsed.rawText
    });
    setText("");
    setMessage(`保存しました: ${parsed.exerciseName}`);
  }

  const recordButtonLabel =
    recordState === "recording"
      ? "■ 停止して認識する"
      : recordState === "transcribing"
        ? "認識中…"
        : "● 録音開始";

  return (
    <div className="screen">
      <h1>記録</h1>

      <Reminders />

      <section className="card">
        <h2>今日の記録</h2>
        {todaySets.length === 0 ? (
          <p className="muted">まだ記録がありません</p>
        ) : (
          <ul className="set-list">
            {todaySets.map((s) => (
              <li key={s.id}>
                {exerciseNameById.get(s.exerciseId) ?? "?"}{" "}
                {s.weightKg !== null ? `${s.weightKg}kg × ` : ""}
                {s.reps}回
              </li>
            ))}
          </ul>
        )}
      </section>

      {modelState === "ready" ? (
        <button
          type="button"
          className={recordState === "recording" ? "record-button recording" : "record-button"}
          onClick={handleRecordToggle}
          disabled={recordState === "transcribing"}
        >
          {recordButtonLabel}
        </button>
      ) : (
        <>
          <button type="button" className="record-button" onClick={handleLoadModel} disabled={modelState === "loading"}>
            {modelState === "loading" ? "準備中…" : "🎤 音声認識を準備(初回のみDL)"}
          </button>
          {modelState === "unloaded" && (
            <p className="muted">初回はモデル(数十 MB)をダウンロードします。Wi-Fi 推奨。2 回目以降はキャッシュから起動します。</p>
          )}
        </>
      )}
      {progress !== null && (
        <div className="progress-area">
          <div className="progress-track">
            <div className="progress-fill" style={{ width: `${progress.pct ?? 0}%` }} />
          </div>
          <p className="muted">{progress.label}</p>
        </div>
      )}

      <section className="card">
        <h2>{modelState === "ready" ? "認識結果の確認・修正" : "テキストで入力"}</h2>
        <p className="muted">
          {modelState === "ready"
            ? "認識テキストをここで直せます。手入力でも記録できます"
            : "音声認識の準備前でも、発話内容を打って記録できます"}
        </p>
        <input
          type="text"
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setMessage(null);
          }}
          placeholder="例: ベンチプレス 60キロ 10回"
        />
        {parsed !== null && (
          <div className="parse-result">
            <div>
              種目: <strong>{parsed.exerciseName ?? "不明"}</strong>{" "}
              <span className="muted">({CONFIDENCE_LABEL[parsed.confidence]})</span>
            </div>
            {parsed.confidence === "ambiguous" && (
              <div className="muted">候補: {parsed.candidates.join(" / ")}</div>
            )}
            <div>重量: {parsed.weightKg !== null ? `${parsed.weightKg} kg` : "—"}</div>
            <div>回数: {parsed.reps !== null ? `${parsed.reps} 回` : "—"}</div>
            {prevSet !== null && prevSet !== undefined && (
              <div className="muted">
                直近の記録: {prevSet.weightKg !== null ? `${prevSet.weightKg}kg × ` : ""}
                {prevSet.reps}回({prevSet.performedAt.slice(0, 10)})
              </div>
            )}
            <button type="button" onClick={handleSave} disabled={!canSave}>
              保存
            </button>
          </div>
        )}
        {message !== null && <p className="message">{message}</p>}
      </section>
    </div>
  );
}
