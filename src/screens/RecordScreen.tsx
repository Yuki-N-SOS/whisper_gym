import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { parse } from "../parser/parse";
import {
  addSet,
  findExerciseByName,
  listExercises,
  listSetsByDate,
  loadDictionary
} from "../db/queries";

const CONFIDENCE_LABEL: Record<string, string> = {
  exact: "完全一致",
  alias: "別名一致",
  partial: "部分一致",
  fuzzy: "あいまい一致(要確認)",
  none: "種目不明"
};

function today(): string {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

export function RecordScreen() {
  const [text, setText] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  const dictionary = useLiveQuery(loadDictionary, [], []);
  const exercises = useLiveQuery(listExercises, [], []);
  const todaySets = useLiveQuery(() => listSetsByDate(today()), [], []);

  const parsed = text.trim() === "" ? null : parse(text, dictionary);
  const canSave = parsed !== null && parsed.exerciseName !== null && parsed.reps !== null;

  const exerciseNameById = new Map(exercises.map((e) => [e.id, e.name]));

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

  return (
    <div className="screen">
      <h1>記録</h1>

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

      <button type="button" className="record-button" disabled>
        ● 録音(フェーズ1で実装)
      </button>

      <section className="card">
        <h2>テキストで試す</h2>
        <p className="muted">音声認識ができるまでは、発話内容をここに打ってパーサーを確認できます</p>
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
            <div>重量: {parsed.weightKg !== null ? `${parsed.weightKg} kg` : "—"}</div>
            <div>回数: {parsed.reps !== null ? `${parsed.reps} 回` : "—"}</div>
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
