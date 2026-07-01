import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { seedIfEmpty } from "./db/queries";
import "./index.css";

async function start() {
  await seedIfEmpty();
  const root = document.getElementById("root");
  if (root === null) throw new Error("#root が見つかりません");
  createRoot(root).render(
    <StrictMode>
      <App />
    </StrictMode>
  );
}

void start();
