import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { seedIfEmpty } from "./db/queries";
import "./index.css";

/**
 * 永続ストレージを要求する(7 日 ITP 消去対策。design.md §10)。
 * 拒否・未対応でも動作は変わらないため結果は待たない。
 */
function requestPersistentStorage(): void {
  navigator.storage?.persist?.().catch(() => {
    /* 未対応ブラウザでは静かに無視 */
  });
}

/** IndexedDB 初期化失敗時のエラー画面(白画面にしない。design.md §10) */
function FatalError({ error }: { error: unknown }) {
  const detail = error instanceof Error ? error.message : String(error);
  return (
    <div className="screen">
      <h1>起動に失敗しました</h1>
      <section className="card">
        <p>データベース(IndexedDB)を開けませんでした。</p>
        <p className="muted">
          プライベートブラウズでは動作しない場合があります。通常モードの Safari
          で開き直すか、端末の空き容量を確認してください。
        </p>
        <p className="muted">詳細: {detail}</p>
        <button type="button" onClick={() => window.location.reload()}>
          再読み込み
        </button>
      </section>
    </div>
  );
}

async function start() {
  const rootEl = document.getElementById("root");
  if (rootEl === null) throw new Error("#root が見つかりません");
  const root = createRoot(rootEl);

  requestPersistentStorage();

  try {
    await seedIfEmpty();
  } catch (error) {
    root.render(
      <StrictMode>
        <FatalError error={error} />
      </StrictMode>
    );
    return;
  }

  root.render(
    <StrictMode>
      <App />
    </StrictMode>
  );
}

void start();
