import { useRef, useState } from "react";
import { exportBundle, importBundle, isBackupBundle, listExercises } from "../db/queries";
import type { WorkoutSet } from "../db/db";
import { loadModelConfig } from "../speech/modelConfig";
import { markExported } from "../util/reminders";

/** ブラウザでファイルを1つダウンロードさせる(ユーザー自身のデータの書き出し) */
function downloadFile(filename: string, content: string, mime: string): void {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** ファイル名用の日時スタンプ(例: 20260711-1945) */
function stamp(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`;
}

/** CSV の1セルをエスケープ(カンマ・引用符・改行を含む値を安全にする) */
function csvCell(value: string): string {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

function buildCsv(sets: WorkoutSet[], nameById: Map<number, string>): string {
  const header = ["日付時刻", "種目", "重量kg", "回数", "原文"];
  const rows = sets.map((s) =>
    [
      s.performedAt,
      nameById.get(s.exerciseId) ?? "?",
      s.weightKg !== null ? String(s.weightKg) : "",
      String(s.reps),
      s.rawText ?? ""
    ]
      .map(csvCell)
      .join(",")
  );
  return [header.join(","), ...rows].join("\r\n");
}

export function SettingsScreen() {
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const modelConfig = loadModelConfig();

  async function handleExportJson() {
    setError(null);
    try {
      const bundle = await exportBundle();
      downloadFile(`whisper-gym-backup-${stamp()}.json`, JSON.stringify(bundle, null, 2), "application/json");
      markExported();
      setMessage(`エクスポートしました(種目 ${bundle.exercises.length} / 記録 ${bundle.sets.length})`);
    } catch (e) {
      setError(`エクスポートに失敗しました: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  async function handleExportCsv() {
    setError(null);
    try {
      const [bundle, exercises] = await Promise.all([exportBundle(), listExercises()]);
      const nameById = new Map(exercises.map((ex) => [ex.id, ex.name]));
      // 先頭に BOM を付け、Excel で日本語が文字化けしないようにする
      downloadFile(`whisper-gym-記録-${stamp()}.csv`, "﻿" + buildCsv(bundle.sets, nameById), "text/csv");
      markExported();
      setMessage(`CSV を書き出しました(記録 ${bundle.sets.length} 件)`);
    } catch (e) {
      setError(`CSV 書き出しに失敗しました: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  async function handleImportFile(file: File) {
    setError(null);
    setMessage(null);
    try {
      const parsed: unknown = JSON.parse(await file.text());
      if (!isBackupBundle(parsed)) {
        setError("このファイルは Whisper Gym のバックアップではないようです");
        return;
      }
      const ok = window.confirm(
        `現在のデータをこのバックアップで置き換えます。\n種目 ${parsed.exercises.length} / 記録 ${parsed.sets.length} 件\n\n今のデータは消えます。よろしいですか?`
      );
      if (!ok) return;
      const result = await importBundle(parsed);
      setMessage(`復元しました(種目 ${result.exercises} / 記録 ${result.sets})`);
    } catch (e) {
      setError(`インポートに失敗しました: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  return (
    <div className="screen">
      <h1>設定</h1>

      <section className="card">
        <h2>音声認識モデル</h2>
        <p className="muted">現在のモデル: {modelConfig.modelId}</p>
        <p className="muted">
          実行方式: {modelConfig.device.toUpperCase()} / 量子化: {modelConfig.dtype}
        </p>
        <p className="muted">モデルの切り替え UI はフェーズ5で追加予定です。</p>
      </section>

      <section className="card">
        <h2>バックアップ(エクスポート)</h2>
        <p className="muted">
          Safari のサイトデータを削除すると記録が消えます。こまめに書き出して保管してください。
        </p>
        <div className="row">
          <button type="button" onClick={handleExportJson}>
            JSON で書き出す
          </button>
          <button type="button" onClick={handleExportCsv}>
            CSV で書き出す
          </button>
        </div>
        <p className="muted">JSON は復元用、CSV は表計算ソフトで見る用です。</p>
      </section>

      <section className="card">
        <h2>復元(インポート)</h2>
        <p className="muted">JSON バックアップを読み込んで復元します。現在のデータは置き換えられます。</p>
        <input
          ref={fileInputRef}
          type="file"
          accept="application/json,.json"
          style={{ display: "none" }}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void handleImportFile(file);
            e.target.value = ""; // 同じファイルを続けて選べるようにリセット
          }}
        />
        <button type="button" onClick={() => fileInputRef.current?.click()}>
          JSON を選んで復元
        </button>
      </section>

      {message !== null && <p className="message">{message}</p>}
      {error !== null && <p className="message">{error}</p>}
    </div>
  );
}
