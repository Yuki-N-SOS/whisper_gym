/**
 * DB アクセスの唯一の窓口。画面からはこのモジュールの関数だけを使う。
 */
import { EXERCISE_SEED } from "../parser/exercises";
import type { DictionaryEntry } from "../parser/parse";
import { db, type Exercise, type WorkoutSet } from "./db";

/** 初回起動時に種目辞書のシードを投入する(投入済みなら何もしない) */
export async function seedIfEmpty(): Promise<void> {
  const count = await db.exercises.count();
  if (count > 0) return;
  await db.transaction("rw", db.exercises, db.exerciseAliases, async () => {
    const now = new Date().toISOString();
    for (const seed of EXERCISE_SEED) {
      const exerciseId = await db.exercises.add({
        name: seed.name,
        category: seed.category,
        isBodyweight: seed.isBodyweight ? 1 : 0,
        createdAt: now
      });
      for (const alias of seed.aliases) {
        await db.exerciseAliases.add({ exerciseId, alias });
      }
    }
  });
}

/** パーサーに渡す辞書を DB から構築する */
export async function loadDictionary(): Promise<DictionaryEntry[]> {
  const [exercises, aliases] = await Promise.all([
    db.exercises.toArray(),
    db.exerciseAliases.toArray()
  ]);
  const aliasMap = new Map<number, string[]>();
  for (const a of aliases) {
    const list = aliasMap.get(a.exerciseId) ?? [];
    list.push(a.alias);
    aliasMap.set(a.exerciseId, list);
  }
  return exercises.map((e) => ({ name: e.name, aliases: aliasMap.get(e.id) ?? [] }));
}

export async function listExercises(): Promise<Exercise[]> {
  return db.exercises.orderBy("name").toArray();
}

export async function findExerciseByName(name: string): Promise<Exercise | undefined> {
  return db.exercises.where("name").equals(name).first();
}

/** 1 セットを記録する */
export async function addSet(input: {
  exerciseId: number;
  weightKg: number | null;
  reps: number;
  rawText: string | null;
  performedAt?: string;
}): Promise<number> {
  const now = new Date().toISOString();
  return db.sets.add({
    exerciseId: input.exerciseId,
    weightKg: input.weightKg,
    reps: input.reps,
    rawText: input.rawText,
    performedAt: input.performedAt ?? now,
    createdAt: now
  });
}

/** 指定日(YYYY-MM-DD)のセット一覧 */
export async function listSetsByDate(date: string): Promise<WorkoutSet[]> {
  return db.sets
    .where("performedAt")
    .between(`${date}T00:00:00`, `${date}T23:59:59.999Z`, true, true)
    .toArray();
}

/** 全セットを新しい順で(履歴画面用) */
export async function listAllSets(): Promise<WorkoutSet[]> {
  return db.sets.orderBy("performedAt").reverse().toArray();
}

/** 同一種目の直近セット(前回参照 F5 用) */
export async function lastSetOfExercise(exerciseId: number): Promise<WorkoutSet | undefined> {
  return db.sets.where("exerciseId").equals(exerciseId).last();
}
