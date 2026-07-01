import { useLiveQuery } from "dexie-react-hooks";
import { listAllSets, listExercises } from "../db/queries";

export function HistoryScreen() {
  const sets = useLiveQuery(listAllSets, [], []);
  const exercises = useLiveQuery(listExercises, [], []);
  const nameById = new Map(exercises.map((e) => [e.id, e.name]));

  // 日付(YYYY-MM-DD)ごとにまとめる
  const byDate = new Map<string, typeof sets>();
  for (const s of sets) {
    const date = s.performedAt.slice(0, 10);
    const list = byDate.get(date) ?? [];
    list.push(s);
    byDate.set(date, list);
  }

  return (
    <div className="screen">
      <h1>履歴</h1>
      {byDate.size === 0 ? (
        <p className="muted">まだ記録がありません</p>
      ) : (
        [...byDate.entries()].map(([date, daySets]) => (
          <section key={date} className="card">
            <h2>{date}</h2>
            <ul className="set-list">
              {daySets.map((s) => (
                <li key={s.id}>
                  {nameById.get(s.exerciseId) ?? "?"}{" "}
                  {s.weightKg !== null ? `${s.weightKg}kg × ` : ""}
                  {s.reps}回
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}
