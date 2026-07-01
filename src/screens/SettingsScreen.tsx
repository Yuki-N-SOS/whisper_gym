export function SettingsScreen() {
  return (
    <div className="screen">
      <h1>設定</h1>
      <section className="card">
        <h2>音声認識モデル</h2>
        <p className="muted">モデルの選択・ダウンロード管理はフェーズ1〜5で実装予定</p>
      </section>
      <section className="card">
        <h2>エクスポート</h2>
        <p className="muted">
          JSON/CSV での書き出しはフェーズ5で実装予定。
          Safari のサイトデータを削除すると記録が消えるため、定期的なエクスポートを推奨します
        </p>
      </section>
    </div>
  );
}
