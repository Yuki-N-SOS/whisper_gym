/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  // GitHub Pages(サブパス配信)でも動くよう相対パスにする
  base: "./",
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      manifest: {
        name: "Whisper Gym",
        short_name: "WhisperGym",
        description: "ささやき声でジムのトレーニングを記録",
        lang: "ja",
        display: "standalone",
        orientation: "portrait",
        background_color: "#111827",
        theme_color: "#111827",
        // 仮アイコン(フェーズ1のホーム画面検証用。本アイコンはフェーズ5で差し替え)
        icons: [
          { src: "pwa-192x192.png", sizes: "192x192", type: "image/png" },
          { src: "pwa-512x512.png", sizes: "512x512", type: "image/png", purpose: "any" }
        ]
      },
      workbox: {
        // Whisper モデル本体は transformers.js が Cache Storage に保存するため
        // Service Worker のプリキャッシュ対象はアプリ本体のみ。
        // ただし onnxruntime の WASM(約24MB)は推論に必須なので、
        // オフライン動作(機内モード・ジムの圏外)のためにプリキャッシュに含める
        globPatterns: ["**/*.{js,css,html,svg,png,woff2,wasm}"],
        maximumFileSizeToCacheInBytes: 30 * 1024 * 1024
      }
    })
  ],
  // onnxruntime-web(transformers.js 内部)は Vite の依存事前バンドルと相性が悪いため除外
  optimizeDeps: {
    exclude: ["@huggingface/transformers"]
  },
  test: {
    environment: "node"
  }
});
