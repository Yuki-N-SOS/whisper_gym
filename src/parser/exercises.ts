/**
 * 種目辞書の初期シード。
 * 実行時の辞書は DB(exercises / exerciseAliases)に持ち、初回起動時にここから投入する。
 * 別名には省略形のほか、フェーズ1で実測した音声認識の誤認識ゆらぎも追加していく。
 */

export type Category = "胸" | "背中" | "脚" | "肩" | "腕" | "体幹";

export interface ExerciseSeed {
  name: string;
  category: Category;
  isBodyweight: boolean;
  aliases: string[];
}

export const EXERCISE_SEED: ExerciseSeed[] = [
  // 胸
  { name: "ベンチプレス", category: "胸", isBodyweight: false, aliases: ["ベンチ", "ベンプレ"] },
  { name: "ダンベルプレス", category: "胸", isBodyweight: false, aliases: [] },
  { name: "インクラインベンチプレス", category: "胸", isBodyweight: false, aliases: ["インクライン", "インクラインプレス"] },
  { name: "チェストプレス", category: "胸", isBodyweight: false, aliases: [] },
  { name: "ペックフライ", category: "胸", isBodyweight: false, aliases: ["フライ", "バタフライ", "ペクトラルフライ"] },
  { name: "ケーブルクロスオーバー", category: "胸", isBodyweight: false, aliases: ["ケーブルクロス"] },
  { name: "ディップス", category: "胸", isBodyweight: true, aliases: [] },
  { name: "腕立て伏せ", category: "胸", isBodyweight: true, aliases: ["プッシュアップ", "腕立て"] },
  // 背中
  { name: "デッドリフト", category: "背中", isBodyweight: false, aliases: ["デッド"] },
  { name: "ラットプルダウン", category: "背中", isBodyweight: false, aliases: ["ラットプル", "プルダウン"] },
  { name: "シーテッドロー", category: "背中", isBodyweight: false, aliases: ["シーテッドロウ", "ロー", "ロウイング"] },
  { name: "ベントオーバーロー", category: "背中", isBodyweight: false, aliases: ["ベントロー", "ベントオーバーロウ"] },
  { name: "ダンベルロー", category: "背中", isBodyweight: false, aliases: ["ワンハンドロー", "ダンベルロウ"] },
  { name: "懸垂", category: "背中", isBodyweight: true, aliases: ["チンニング", "プルアップ", "チンアップ"] },
  // 脚
  { name: "スクワット", category: "脚", isBodyweight: false, aliases: [] },
  { name: "レッグプレス", category: "脚", isBodyweight: false, aliases: [] },
  { name: "レッグエクステンション", category: "脚", isBodyweight: false, aliases: ["エクステンション"] },
  { name: "レッグカール", category: "脚", isBodyweight: false, aliases: [] },
  { name: "カーフレイズ", category: "脚", isBodyweight: false, aliases: ["カーフ"] },
  { name: "ブルガリアンスクワット", category: "脚", isBodyweight: false, aliases: ["ブルガリアン"] },
  { name: "ランジ", category: "脚", isBodyweight: false, aliases: [] },
  // 肩
  { name: "ショルダープレス", category: "肩", isBodyweight: false, aliases: ["ショルダー"] },
  { name: "サイドレイズ", category: "肩", isBodyweight: false, aliases: ["ラテラルレイズ"] },
  { name: "リアレイズ", category: "肩", isBodyweight: false, aliases: ["リアデルト"] },
  { name: "フロントレイズ", category: "肩", isBodyweight: false, aliases: [] },
  { name: "アップライトロー", category: "肩", isBodyweight: false, aliases: ["アップライトロウ"] },
  // 腕
  { name: "アームカール", category: "腕", isBodyweight: false, aliases: ["カール", "バーベルカール", "ダンベルカール"] },
  { name: "ハンマーカール", category: "腕", isBodyweight: false, aliases: [] },
  { name: "トライセプスエクステンション", category: "腕", isBodyweight: false, aliases: ["フレンチプレス", "スカルクラッシャー"] },
  { name: "プレスダウン", category: "腕", isBodyweight: false, aliases: ["トライセプスプレスダウン", "ケーブルプレスダウン"] },
  // 体幹
  // プランク等の時間ベース種目は MVP スコープ外(sets に秒数フィールドがないため。design.md §3)
  { name: "クランチ", category: "体幹", isBodyweight: true, aliases: [] },
  { name: "シットアップ", category: "体幹", isBodyweight: true, aliases: ["腹筋"] },
  { name: "レッグレイズ", category: "体幹", isBodyweight: true, aliases: [] },
  { name: "アブローラー", category: "体幹", isBodyweight: true, aliases: ["腹筋ローラー"] }
];
