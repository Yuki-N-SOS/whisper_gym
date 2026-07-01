import { useLiveQuery } from "dexie-react-hooks";
import { listExercises } from "../db/queries";
import type { Exercise } from "../db/db";

export function ExercisesScreen() {
  const exercises = useLiveQuery(listExercises, [], []);

  const byCategory = new Map<string, Exercise[]>();
  for (const e of exercises) {
    const list = byCategory.get(e.category) ?? [];
    list.push(e);
    byCategory.set(e.category, list);
  }

  return (
    <div className="screen">
      <h1>種目</h1>
      <p className="muted">種目の追加・別名編集はフェーズ4で実装予定</p>
      {[...byCategory.entries()].map(([category, list]) => (
        <section key={category} className="card">
          <h2>{category}</h2>
          <ul className="set-list">
            {list.map((e) => (
              <li key={e.id}>
                {e.name}
                {e.isBodyweight === 1 && <span className="muted">(自重)</span>}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
