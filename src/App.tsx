import { useState } from "react";
import { RecordScreen } from "./screens/RecordScreen";
import { HistoryScreen } from "./screens/HistoryScreen";
import { ExercisesScreen } from "./screens/ExercisesScreen";
import { SettingsScreen } from "./screens/SettingsScreen";
import { VerifyScreen } from "./screens/VerifyScreen";

const TABS = [
  { id: "record", label: "記録", screen: RecordScreen },
  { id: "history", label: "履歴", screen: HistoryScreen },
  { id: "exercises", label: "種目", screen: ExercisesScreen },
  { id: "settings", label: "設定", screen: SettingsScreen },
  // フェーズ1の技術検証用タブ。採用モデル決定後に削除する
  { id: "verify", label: "検証", screen: VerifyScreen }
] as const;

type TabId = (typeof TABS)[number]["id"];

export function App() {
  const [active, setActive] = useState<TabId>("record");
  const ActiveScreen = TABS.find((t) => t.id === active)?.screen ?? RecordScreen;

  return (
    <div className="app">
      <main className="content">
        <ActiveScreen />
      </main>
      <nav className="tab-bar">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={tab.id === active ? "tab active" : "tab"}
            onClick={() => setActive(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </nav>
    </div>
  );
}
