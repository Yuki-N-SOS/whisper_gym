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
        // TODO(フェーズ5): アイコン画像を追加する
        icons: []
      },
      workbox: {
        // Whisper モデル本体は transformers.js が Cache Storage に保存するため
        // Service Worker のプリキャッシュ対象はアプリ本体のみ
        globPatterns: ["**/*.{js,css,html,svg,png,woff2}"]
      }
    })
  ],
  test: {
    environment: "node"
  }
});
