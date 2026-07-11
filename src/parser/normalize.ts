/**
 * 音声認識テキストの正規化。
 * パーサーの前段として、表記ゆらぎを吸収した比較可能な文字列に変換する。
 * 純粋関数のみ。
 */

const KANJI_DIGITS: Record<string, number> = {
  〇: 0,
  零: 0,
  一: 1,
  二: 2,
  三: 3,
  四: 4,
  五: 5,
  六: 6,
  七: 7,
  八: 8,
  九: 9
};

/** 「六十二」「百二十」など位取りを含む漢数字列(整数部)を数値にする */
function kanjiIntegerToNumber(s: string): number {
  let total = 0;
  let current = 0;
  for (const ch of s) {
    if (ch in KANJI_DIGITS) {
      current = current * 10 + KANJI_DIGITS[ch];
    } else if (ch === "十") {
      total += (current || 1) * 10;
      current = 0;
    } else if (ch === "百") {
      total += (current || 1) * 100;
      current = 0;
    } else if (ch === "千") {
      total += (current || 1) * 1000;
      current = 0;
    }
  }
  return total + current;
}

/** 「六十二点五」→ "62.5" のように、漢数字部分文字列を算用数字に変換する */
function convertKanjiNumbers(text: string): string {
  return text.replace(/[〇零一二三四五六七八九十百千]+(?:点[〇零一二三四五六七八九]+)?/g, (m) => {
    const [intPart, fracPart] = m.split("点");
    const intValue = kanjiIntegerToNumber(intPart);
    if (fracPart === undefined) return String(intValue);
    const fracDigits = [...fracPart].map((ch) => KANJI_DIGITS[ch] ?? 0).join("");
    return `${intValue}.${fracDigits}`;
  });
}

/** 全角英数字・記号を半角にする */
function toHalfWidth(text: string): string {
  return text
    .replace(/[０-９ａ-ｚＡ-Ｚ]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xfee0))
    .replace(/㎏/g, "kg")
    .replace(/．/g, ".");
}

/**
 * 正規化の入口。
 * - 全角→半角、漢数字→算用数字
 * - 数字に挟まれた「点」「てん」→ 小数点(Whisper は「62点5キロ」と出すことがある)
 * - 英字は小文字化(KG → kg)
 * - 空白・句読点・記号を除去(小数点の "." は数値の一部なので残す)
 */
export function normalize(text: string): string {
  return convertKanjiNumbers(toHalfWidth(text))
    .replace(/(\d)(?:点|てん)(?=\d)/g, "$1.")
    .toLowerCase()
    .replace(/[\s、。,!?！？・…「」『』()（）]/g, "");
}
