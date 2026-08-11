/**
 * 幻覚(ハルシネーション)フレーズの除去(design.md §6 / whisper-accuracy-requirements.md R-B2)。
 *
 * Whisper は YouTube 字幕を大量に学習しているため、無音・小音量の日本語音声に対して
 * 「ご視聴ありがとうございました」等の字幕定型句を出力する既知の問題がある。
 * ささやき声はこの発生条件に近いので、パーサーに渡す前にここで落とす。
 *
 * 純粋関数のみ。実測で出た幻覚はこの配列に追加し、**必ずユニットテストも足す**
 * (CLAUDE.md「誤認識パターンをテストケースとして蓄積する」)。
 */

/**
 * 既知の幻覚フレーズ。**長い複合形を先に**置くこと。
 * 先に「ありがとうございました」を消すと「ご視聴」だけが残り、
 * 複合形のパターンが一致しなくなるため。
 */
export const HALLUCINATION_PATTERNS: readonly RegExp[] = [
  // 動画の締めの定型句(日本語 Whisper で最頻出)
  /(?:最後まで)?ご(?:視聴|清聴|覧)(?:いただき|くださり)?(?:まして)?ありがとうございま(?:した|す)/g,
  /(?:本日|今日)は(?:どうも)?ありがとうございま(?:した|す)/g,
  /(?:高評価(?:と|や|、)?)?チャンネル登録(?:と高評価)?(?:の)?(?:ほど)?(?:を)?(?:よろしく)?お願いしま(?:す|した)?/g,
  /(?:また)?次の動画で(?:お会いしましょう|会いましょう)/g,
  /ありがとうございま(?:した|す)/g,
  /お疲れ様でした/g,
  /おやすみなさい/g,
  // 字幕クレジット
  /字幕(?:視聴者|提供|翻訳)/g,
  /amara\.org/gi,
  /(?:thank you|thanks) for watching[!.]*/gi,
  // 効果音・音楽マーカー
  /[[(（【]?(?:音楽|拍手|bgm)[\])）\]】]?/gi,
  /♪+/g
];

/** 文字・数字が 1 つでも残っているか(残りが記号だけなら「中身なし」とみなす) */
function hasContent(text: string): boolean {
  return /[\p{L}\p{N}]/u.test(text);
}

/** 前後の空白・句読点や、フレーズ除去で生じた連続句読点を整える */
function tidy(text: string): string {
  return text
    .replace(/\s+/g, " ")
    .replace(/([、。,.!?！？])\s*(?=[、。,.!?！？])/g, "")
    .replace(/^[\s、。,.!?！？]+/, "")
    .replace(/[\s、。,.!?！？]+$/, "");
}

/**
 * 既知の幻覚フレーズを取り除く。
 * 除去後に意味のある文字が残らなければ「全文が幻覚」とみなして空文字を返す
 * (呼び出し側は R-B1 と同じ再録音案内を出す)。
 */
export function stripHallucinations(text: string): string {
  let out = text;
  for (const pattern of HALLUCINATION_PATTERNS) {
    out = out.replace(pattern, "");
  }
  const tidied = tidy(out);
  return hasContent(tidied) ? tidied : "";
}

/**
 * 認識テキストが丸ごと幻覚か(= 除去後に中身が残らないか)。
 * 空文字は幻覚ではなく「そもそも何も認識されなかった」なので false。
 */
export function isHallucinationOnly(text: string): boolean {
  return text.trim() !== "" && stripHallucinations(text) === "";
}
