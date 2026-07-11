import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { countSets } from "../db/queries";
import {
  daysSince,
  dismissHomeScreenHint,
  getLastExportAt,
  isHomeScreenHintDismissed,
  isIosSafari,
  isStandalone
} from "../util/reminders";

/** これ以上バックアップしていないと促す日数 */
const EXPORT_STALE_DAYS = 7;

/**
 * データ消失対策のバナー(記録画面の先頭に出す)。
 * - ホーム画面追加の案内(iOS Safari・未追加のときだけ)
 * - バックアップ促し(記録があり、未書き出し or 前回から一定日数経過)
 */
export function Reminders() {
  const setCount = useLiveQuery(countSets, [], 0);
  const [homeDismissed, setHomeDismissed] = useState(isHomeScreenHintDismissed());

  const lastExport = getLastExportAt();
  const days = daysSince(lastExport);
  const showExportNudge = setCount > 0 && (days === null || days >= EXPORT_STALE_DAYS);
  const showHomeHint = isIosSafari() && !isStandalone() && !homeDismissed;

  if (!showExportNudge && !showHomeHint) return null;

  return (
    <div className="banners">
      {showHomeHint && (
        <div className="banner">
          <span>
            ホーム画面に追加すると、Safari のデータ自動消去(7 日)を防げます。共有ボタン →「ホーム画面に追加」
          </span>
          <button
            type="button"
            className="chip-remove"
            aria-label="閉じる"
            onClick={() => {
              dismissHomeScreenHint();
              setHomeDismissed(true);
            }}
          >
            ×
          </button>
        </div>
      )}
      {showExportNudge && (
        <div className="banner banner-warn">
          <span>
            {lastExport === null
              ? "記録がまだ書き出されていません。"
              : `前回のバックアップから ${Math.floor(days ?? 0)} 日経過。`}
            設定からバックアップをおすすめします。
          </span>
        </div>
      )}
    </div>
  );
}
