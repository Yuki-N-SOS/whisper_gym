import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import {
  addAlias,
  addExercise,
  deleteAlias,
  listAliasesByExercise,
  listExercises
} from "../db/queries";
import type { Exercise } from "../db/db";

const CATEGORIES = ["胸", "背中", "脚", "肩", "腕", "体幹"] as const;

/** 種目1件の別名編集(展開時のみ表示) */
function AliasEditor({ exercise }: { exercise: Exercise }) {
  const aliases = useLiveQuery(() => listAliasesByExercise(exercise.id), [exercise.id], []);
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function handleAdd() {
    setError(null);
    try {
      await addAlias(exercise.id, input);
      setInput("");
    } catch {
      // 一意制約違反(別名の重複)など
      setError("その別名は既に使われています");
    }
  }

  return (
    <div className="alias-editor">
      {aliases.length === 0 ? (
        <p className="muted">別名なし</p>
      ) : (
        <ul className="alias-list">
          {aliases.map((a) => (
            <li key={a.id}>
              <span>{a.alias}</span>
              <button type="button" className="chip-remove" onClick={() => deleteAlias(a.id)}>
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="row">
        <input
          type="text"
          value={input}
          onChange={(e) => {
            setInput(e.target.value);
            setError(null);
          }}
          placeholder="別名・誤認識ゆらぎを追加"
        />
        <button type="button" onClick={handleAdd} disabled={input.trim() === ""}>
          追加
        </button>
      </div>
      {error !== null && <p className="message">{error}</p>}
    </div>
  );
}

export function ExercisesScreen() {
  const exercises = useLiveQuery(listExercises, [], []);

  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [newName, setNewName] = useState("");
  const [newCategory, setNewCategory] = useState<(typeof CATEGORIES)[number]>("胸");
  const [newBodyweight, setNewBodyweight] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [addMessage, setAddMessage] = useState<string | null>(null);

  async function handleAddExercise() {
    setAddError(null);
    setAddMessage(null);
    try {
      const name = newName.trim();
      await addExercise({ name, category: newCategory, isBodyweight: newBodyweight });
      setAddMessage(`追加しました: ${name}`);
      setNewName("");
      setNewBodyweight(false);
    } catch {
      // name の一意制約(&name)違反など
      setAddError("その種目名は既に登録されています");
    }
  }

  const byCategory = new Map<string, Exercise[]>();
  for (const e of exercises) {
    const list = byCategory.get(e.category) ?? [];
    list.push(e);
    byCategory.set(e.category, list);
  }

  return (
    <div className="screen">
      <h1>種目</h1>

      <section className="card">
        <h2>種目を追加</h2>
        <input
          type="text"
          value={newName}
          onChange={(e) => {
            setNewName(e.target.value);
            setAddError(null);
            setAddMessage(null);
          }}
          placeholder="種目名(例: アーノルドプレス)"
        />
        <div className="row">
          <label>
            部位:
            <select
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value as (typeof CATEGORIES)[number])}
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
          <label className="check-label">
            <input
              type="checkbox"
              checked={newBodyweight}
              onChange={(e) => setNewBodyweight(e.target.checked)}
            />
            自重種目
          </label>
        </div>
        <button type="button" onClick={handleAddExercise} disabled={newName.trim() === ""}>
          追加
        </button>
        {addError !== null && <p className="message">{addError}</p>}
        {addMessage !== null && <p className="message">{addMessage}</p>}
      </section>

      {[...byCategory.entries()].map(([category, list]) => (
        <section key={category} className="card">
          <h2>{category}</h2>
          <ul className="set-list">
            {list.map((e) => (
              <li key={e.id}>
                <button
                  type="button"
                  className="exercise-row"
                  onClick={() => setExpandedId(expandedId === e.id ? null : e.id)}
                >
                  <span>
                    {e.name}
                    {e.isBodyweight === 1 && <span className="muted">(自重)</span>}
                  </span>
                  <span className="muted">{expandedId === e.id ? "▲ 別名" : "▼ 別名"}</span>
                </button>
                {expandedId === e.id && <AliasEditor exercise={e} />}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
