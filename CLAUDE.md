# Whisper Gym — ささやき声トレーニング記録アプリ

## プロジェクト概要

ジムで周囲を気にせず**ささやき声**でトレーニング内容(種目・重量・回数)を
記録できる **iPhone 向けアプリ**。話した内容を音声認識 → 構造化データに変換 → 端末内に保存する。

**PWA(Web アプリ)として開発する。** Safari の「ホーム画面に追加」でネイティブアプリのように使う。
理由: 開発機が Windows(Mac なし)かつ費用ゼロ制約のため、ネイティブ iOS 開発
(Xcode 必須・Apple Developer 年額 $99)は選択肢にならない。ユーザー確認済みの決定。

## 絶対的な制約(必ず守ること)

**ランニングコストゼロ。** データベースや AI モデルの利用に一切お金を払わない。

これを実現するための技術方針:

| 領域 | 方針 | 理由 |
|---|---|---|
| 音声認識 | Whisper を **ブラウザ内でローカル実行**(transformers.js + ONNX モデル) | クラウド STT API は従量課金のため使用禁止 |
| データ保存 | 端末内 **IndexedDB**(Dexie) | クラウド DB(Firebase 有料枠, Supabase 等)は使わない |
| 音声→構造化変換 | **ルールベースのパーサー**(種目辞書+正規表現) | LLM API は従量課金のため使用禁止 |
| ホスティング | **GitHub Pages**(無料・静的配信のみ) | サーバー不要の設計。バックエンドは作らない |
| バックアップ | ローカルファイルへの JSON/CSV エクスポート | クラウド同期は実装しない |

新しいライブラリやサービスを導入する際は、**無料で恒久的に使えるか**を必ず確認すること。
「無料枠あり」のクラウドサービスは、枠超過で課金される可能性があるため原則使わない。

## 技術スタック

- **ビルド**: Vite + React + TypeScript(strict モード)
- **音声認識**: @huggingface/transformers(transformers.js)で Whisper 系 ONNX モデルを
  ブラウザ内実行(WASM / WebGPU)。モデルは初回に無料 DL し Cache Storage に保存
- **DB**: Dexie(IndexedDB ラッパー)
- **PWA**: vite-plugin-pwa(Service Worker でオフライン動作)
- **テスト**: Vitest
- **状態管理**: React hooks + Context(小規模なので外部ライブラリは入れない)
- **ターゲット**: iPhone Safari(ホーム画面追加のスタンドアロン表示)

## プロジェクト構成

```
whisper_gym/
├── CLAUDE.md            # このファイル
├── docs/
│   ├── design.md        # 設計ドキュメント(仕様の一次情報源)
│   └── roadmap.md       # 進め方・開発フェーズ・マイルストーン
├── index.html
├── vite.config.ts       # Vite + PWA + Vitest 設定
├── src/
│   ├── main.tsx / App.tsx
│   ├── screens/         # 画面(記録/履歴/種目/設定)
│   ├── db/              # Dexie スキーマ・クエリ関数・初期シード
│   ├── speech/          # 録音(MediaRecorder)・whisper 呼び出し
│   ├── parser/          # 文字起こしテキスト → 構造化データ変換
│   │   └── exercises.ts # 種目辞書の初期シード(正式名+別名・ゆらぎ)
│   └── components/
└── public/
```

## 開発コマンド

```bash
npm install          # 依存関係インストール
npm run dev          # 開発サーバー(PC ブラウザで確認)
npm test             # ユニットテスト(Vitest)— 特にパーサー
npm run typecheck    # 型チェック(tsc --noEmit)
npm run build        # 本番ビルド(型チェック込み)
```

iPhone 実機での確認は GitHub Pages にデプロイして行う
(マイク使用に HTTPS が必須のため。手順は docs/roadmap.md)。

## コーディング規約

- TypeScript strict。`any` は使わない
- UI 文言は日本語
- DB アクセスは `src/db/` のクエリ関数経由のみ(コンポーネントから直接 Dexie を触らない)
- パーサーは純粋関数として実装(テスト容易性のため)
- **パーサー変更時は必ずユニットテストを追加**(誤認識パターンをテストケースとして蓄積する)
- モデルファイルは git にコミットしない(ブラウザが実行時に DL・キャッシュする)

## 既知の技術的リスク

- **ささやき声の認識精度**: Whisper はささやき声で精度が落ちる。対策は docs/design.md 参照
  (マイクに近づけて話す運用、種目辞書によるあいまいマッチング、認識結果の確認 UI)
- **iPhone Safari のメモリ・速度制限**: 大きいモデルは載らない。whisper-base 級
  (量子化 ~60MB)を第一候補とし、日本語特化の kotoba-whisper 系と実機比較する
- **PWA スタンドアロンでのマイク権限**: iOS 16.4 以降は動作するはずだが、フェーズ 1 で
  実機検証必須。ダメなら Safari タブ運用にフォールバック
