/**
 * データ消失対策(design.md §10)のためのリマインド判定。
 * - Safari は 7 日でサイトデータを消す(ITP)。ホーム画面追加で免除される
 * - 端末内保存のみなので、定期的な JSON/CSV 書き出しを促す
 * 状態は localStorage に持つ(記録データとは別。消えても実害はない)。
 */

const LAST_EXPORT_KEY = "whisper_gym.lastExportAt";
const HOMESCREEN_DISMISS_KEY = "whisper_gym.homeScreenHintDismissed";

/** バックアップを書き出した時刻を記録する(エクスポート成功時に呼ぶ) */
export function markExported(): void {
  try {
    localStorage.setItem(LAST_EXPORT_KEY, new Date().toISOString());
  } catch {
    /* localStorage 不可でも実害なし */
  }
}

export function getLastExportAt(): string | null {
  try {
    return localStorage.getItem(LAST_EXPORT_KEY);
  } catch {
    return null;
  }
}

/** iso からの経過日数。未書き出し(null)や壊れた値は null */
export function daysSince(iso: string | null): number | null {
  if (iso === null) return null;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  return (Date.now() - t) / 86_400_000;
}

export function isHomeScreenHintDismissed(): boolean {
  try {
    return localStorage.getItem(HOMESCREEN_DISMISS_KEY) === "1";
  } catch {
    return false;
  }
}

export function dismissHomeScreenHint(): void {
  try {
    localStorage.setItem(HOMESCREEN_DISMISS_KEY, "1");
  } catch {
    /* 実害なし */
  }
}

/** iOS の Safari 本体か(Chrome/Firefox 等の iOS 版や他 OS は除外) */
export function isIosSafari(): boolean {
  const ua = navigator.userAgent;
  // iPadOS はデスクトップ UA を名乗るため maxTouchPoints でも判定する
  const iOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const webkit = /WebKit/.test(ua);
  const otherBrowser = /CriOS|FxiOS|EdgiOS|OPiOS/.test(ua);
  return iOS && webkit && !otherBrowser;
}

/** ホーム画面追加済み(スタンドアロン表示)か */
export function isStandalone(): boolean {
  if (window.matchMedia("(display-mode: standalone)").matches) return true;
  // iOS Safari の独自プロパティ(標準の display-mode を出さない版へのフォールバック)
  return "standalone" in navigator && (navigator as { standalone?: boolean }).standalone === true;
}
