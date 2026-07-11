/**
 * 文字起こしテキスト → 構造化データ変換(このアプリの心臓部)。
 * 副作用なしの純粋関数のみ。辞書は引数で受け取る(実行時は DB から構築)。
 */
import { normalize } from "./normalize";

/** マッチ方法。UI 側で確認の強度を変えるために保持する */
export type Confidence = "exact" | "alias" | "partial" | "fuzzy" | "ambiguous" | "none";

export interface ParsedSet {
  exerciseName: string | null;
  weightKg: number | null;
  reps: number | null;
  rawText: string;
  confidence: Confidence;
  /** confidence が "ambiguous" のときの種目候補(それ以外は空配列)。確認 UI で選択させる */
  candidates: string[];
}

export interface DictionaryEntry {
  name: string;
  aliases: string[];
}

const WEIGHT_RE = /(\d+(?:\.\d+)?)(?:キロ|きろ|kg)(?:グラム)?/;
const REPS_RE = /(\d+)(?:回|かい|レップ|rep(?:s)?)/;

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const curr = [i, ...new Array<number>(n).fill(0)];
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
    }
    prev = curr;
  }
  return prev[n];
}

interface Match {
  name: string;
  confidence: Confidence;
  candidates: string[];
}

function noMatch(): Match {
  return { name: "", confidence: "none", candidates: [] };
}

/**
 * 種目名候補を辞書に突き合わせる。
 * 完全一致 → 別名一致 → 部分一致 → あいまいマッチ(編集距離)の順でフォールバック。
 * 部分一致・あいまいマッチで複数種目が同格の候補になった場合は 1 件を勝手に選ばず
 * "ambiguous" として候補リストを返す(確認 UI で選択させる)。
 */
function matchExercise(candidate: string, dictionary: DictionaryEntry[]): Match {
  if (candidate.length === 0) return noMatch();

  for (const entry of dictionary) {
    if (normalize(entry.name) === candidate) {
      return { name: entry.name, confidence: "exact", candidates: [] };
    }
  }
  for (const entry of dictionary) {
    if (entry.aliases.some((a) => normalize(a) === candidate)) {
      return { name: entry.name, confidence: "alias", candidates: [] };
    }
  }
  // 部分一致(3文字以上のときのみ。「ロー」等の短い別名の誤爆を防ぐ)
  if (candidate.length >= 3) {
    const hits: string[] = [];
    for (const entry of dictionary) {
      const terms = [entry.name, ...entry.aliases].map(normalize).filter((t) => t.length >= 3);
      if (terms.some((t) => candidate.includes(t) || t.includes(candidate))) {
        hits.push(entry.name);
      }
    }
    if (hits.length === 1) return { name: hits[0], confidence: "partial", candidates: [] };
    if (hits.length > 1) return { name: "", confidence: "ambiguous", candidates: hits };
  }
  // あいまいマッチ: 編集距離が文字数の 1/3 以内なら採用。
  // 最小距離の種目が複数あるときは ambiguous(同率 1 位を勝手に選ばない)
  let bestDist = Infinity;
  const bestNames: string[] = [];
  for (const entry of dictionary) {
    let entryDist = Infinity;
    for (const term of [entry.name, ...entry.aliases]) {
      entryDist = Math.min(entryDist, levenshtein(candidate, normalize(term)));
    }
    if (entryDist < bestDist) {
      bestDist = entryDist;
      bestNames.length = 0;
      bestNames.push(entry.name);
    } else if (entryDist === bestDist) {
      bestNames.push(entry.name);
    }
  }
  if (bestDist <= Math.max(1, Math.floor(candidate.length / 3))) {
    if (bestNames.length === 1) return { name: bestNames[0], confidence: "fuzzy", candidates: [] };
    return { name: "", confidence: "ambiguous", candidates: [...bestNames] };
  }
  return noMatch();
}

/**
 * 発話テキストを 1 セットの記録に変換する。
 * 「ベンチプレス 60キロ 10回」→ { exerciseName: "ベンチプレス", weightKg: 60, reps: 10 }
 * 取れなかったフィールドは null(推測で埋めない。UI 側で入力を促す)。
 */
export function parse(rawText: string, dictionary: DictionaryEntry[]): ParsedSet {
  let text = normalize(rawText);

  const weightMatch = text.match(WEIGHT_RE);
  const weightKg = weightMatch ? Number(weightMatch[1]) : null;
  if (weightMatch) text = text.replace(weightMatch[0], "");

  const repsMatch = text.match(REPS_RE);
  const reps = repsMatch ? Number(repsMatch[1]) : null;
  if (repsMatch) text = text.replace(repsMatch[0], "");

  // 残りから数字・単位の食べ残しを落として種目名候補にする
  const candidate = text.replace(/[\d.]/g, "").replace(/(キロ|きろ|kg|回|かい|レップ)/g, "");

  const match = matchExercise(candidate, dictionary);
  return {
    exerciseName: match.name === "" ? null : match.name,
    weightKg,
    reps,
    rawText,
    confidence: match.confidence,
    candidates: match.candidates
  };
}
