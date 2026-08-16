import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { applyTheme, readStoredTheme } from "@brim/ui-kit";
import { AppShell } from "./AppShell.js";
import "@brim/ui-kit/tokens.css";
import "./styles.css";

applyTheme(readStoredTheme());

if ("serviceWorker" in navigator) {
  void navigator.serviceWorker.register("/sw.js");
}

const root = document.getElementById("root");
if (!root) throw new Error("root element missing");
createRoot(root).render(
  <StrictMode>
    <AppShell />
  </StrictMode>,
);
