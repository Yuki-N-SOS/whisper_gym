/**
 * Dexie(IndexedDB)スキーマ定義。
 * コンポーネントからは直接触らず、queries.ts のクエリ関数経由でアクセスする。
 */
import Dexie, { type EntityTable } from "dexie";

export interface Exercise {
  id: number;
  name: string;
  category: string;
  isBodyweight: 0 | 1; // IndexedDB のインデックスは boolean 不可のため数値
  createdAt: string; // ISO8601
}

export interface ExerciseAlias {
  id: number;
  exerciseId: number;
  alias: string;
}

export interface WorkoutSet {
  id: number;
  exerciseId: number;
  weightKg: number | null; // 自重種目は null
  reps: number;
  performedAt: string; // ローカル時刻の ISO8601(TZ 表記なし)。日別表示はこれで集計
  rawText: string | null; // 認識テキスト原文(デバッグ・辞書改善用)
  createdAt: string;
}

export const db = new Dexie("whisper_gym") as Dexie & {
  exercises: EntityTable<Exercise, "id">;
  exerciseAliases: EntityTable<ExerciseAlias, "id">;
  sets: EntityTable<WorkoutSet, "id">;
};

db.version(1).stores({
  exercises: "++id, &name",
  exerciseAliases: "++id, exerciseId, &alias",
  sets: "++id, exerciseId, performedAt"
});
