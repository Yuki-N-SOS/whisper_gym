/**
 * DB アクセスの唯一の窓口。画面からはこのモジュールの関数だけを使う。
 */
import Dexie from "dexie";
import { EXERCISE_SEED } from "../parser/exercises";
import type { DictionaryEntry } from "../parser/parse";
import { db, type Exercise, type ExerciseAlias, type WorkoutSet } from "./db";

/**
 * ローカル時刻の ISO8601(タイムゾーン表記なし)。
 * performedAt は「ユーザーの体感の日付」で日別集計するため、UTC ではなくこれを使う。
 * toISOString()(UTC)だと日本時間の朝 9 時前の記録が前日扱いになる。
 */
function localISO(d: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
    `T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
  );
}

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

/** 指定種目の別名一覧(種目管理画面用) */
export async function listAliasesByExercise(exerciseId: number): Promise<ExerciseAlias[]> {
  return db.exerciseAliases.where("exerciseId").equals(exerciseId).toArray();
}

/**
 * 種目を追加する。name は一意制約(&name)。同名が既にあれば例外になるため、
 * 呼び出し側で重複チェック済みの前提。空文字は弾く。
 */
export async function addExercise(input: {
  name: string;
  category: string;
  isBodyweight: boolean;
}): Promise<number> {
  const name = input.name.trim();
  if (name === "") throw new Error("種目名を入力してください");
  return db.exercises.add({
    name,
    category: input.category,
    isBodyweight: input.isBodyweight ? 1 : 0,
    createdAt: new Date().toISOString()
  });
}

/** 別名を追加する。alias は一意制約(&alias)。空文字は弾く */
export async function addAlias(exerciseId: number, alias: string): Promise<number> {
  const trimmed = alias.trim();
  if (trimmed === "") throw new Error("別名を入力してください");
  return db.exerciseAliases.add({ exerciseId, alias: trimmed });
}

export async function deleteAlias(aliasId: number): Promise<void> {
  await db.exerciseAliases.delete(aliasId);
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
  return db.sets.add({
    exerciseId: input.exerciseId,
    weightKg: input.weightKg,
    reps: input.reps,
    rawText: input.rawText,
    performedAt: input.performedAt ?? localISO(),
    createdAt: new Date().toISOString()
  });
}

/** 指定日(YYYY-MM-DD)のセット一覧 */
export async function listSetsByDate(date: string): Promise<WorkoutSet[]> {
  return db.sets
    .where("performedAt")
    .between(`${date}T00:00:00`, `${date}T23:59:59.999`, true, true)
    .toArray();
}

/** 全セットを新しい順で(履歴画面用) */
export async function listAllSets(): Promise<WorkoutSet[]> {
  return db.sets.orderBy("performedAt").reverse().toArray();
}

/** 記録件数(バックアップ促しバナーの判定用) */
export async function countSets(): Promise<number> {
  return db.sets.count();
}

/** 同一種目の直近セット(前回参照 F5 用)。performedAt 順の最後(挿入順ではない) */
export async function lastSetOfExercise(exerciseId: number): Promise<WorkoutSet | undefined> {
  return db.sets
    .where("[exerciseId+performedAt]")
    .between([exerciseId, Dexie.minKey], [exerciseId, Dexie.maxKey])
    .last();
}

/**
 * バックアップ用の全データ束(F8)。id をそのまま含めて出力し、
 * インポート時に同じ id で復元することで sets → exercises の参照を保つ。
 */
export interface BackupBundle {
  app: "whisper_gym";
  version: number;
  exportedAt: string;
  exercises: Exercise[];
  aliases: ExerciseAlias[];
  sets: WorkoutSet[];
}

const BACKUP_VERSION = 1;

/** 全データを1つの束にまとめて返す(JSON エクスポート用) */
export async function exportBundle(): Promise<BackupBundle> {
  const [exercises, aliases, sets] = await Promise.all([
    db.exercises.toArray(),
    db.exerciseAliases.toArray(),
    db.sets.toArray()
  ]);
  return { app: "whisper_gym", version: BACKUP_VERSION, exportedAt: new Date().toISOString(), exercises, aliases, sets };
}

/** unknown を BackupBundle として検証する(壊れたファイル・別アプリの JSON を弾く) */
export function isBackupBundle(value: unknown): value is BackupBundle {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    v.app === "whisper_gym" &&
    typeof v.version === "number" &&
    Array.isArray(v.exercises) &&
    Array.isArray(v.aliases) &&
    Array.isArray(v.sets)
  );
}

/**
 * バックアップ束で現在のデータを置き換える(復元)。
 * 破壊的操作のため、呼び出し側で必ずユーザー確認を取ること。
 * id 付きで bulkAdd するので参照(exerciseId)はそのまま保たれる。
 */
export async function importBundle(bundle: BackupBundle): Promise<{ exercises: number; sets: number }> {
  await db.transaction("rw", db.exercises, db.exerciseAliases, db.sets, async () => {
    await Promise.all([db.exercises.clear(), db.exerciseAliases.clear(), db.sets.clear()]);
    await db.exercises.bulkAdd(bundle.exercises);
    await db.exerciseAliases.bulkAdd(bundle.aliases);
    await db.sets.bulkAdd(bundle.sets);
  });
  return { exercises: bundle.exercises.length, sets: bundle.sets.length };
}
