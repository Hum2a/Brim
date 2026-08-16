import { StrictMode, lazy, Suspense } from "react";
import { createRoot } from "react-dom/client";
import { EstimatePage } from "./pages/EstimatePage.js";
import "@brim/ui-kit/tokens.css";
import "./styles.css";

const KitchenSink = lazy(() => import("./pages/KitchenSink.js").then((m) => ({ default: m.KitchenSink })));
const HistoryPage = lazy(() => import("./pages/HistoryPage.js").then((m) => ({ default: m.HistoryPage })));
const AccountPage = lazy(() => import("./pages/AccountPage.js").then((m) => ({ default: m.AccountPage })));

function Router() {
  const path = window.location.pathname;
  if (path.startsWith("/kitchen-sink")) return <KitchenSink />;
  if (path.startsWith("/history")) return <HistoryPage />;
  if (path.startsWith("/account")) return <AccountPage />;
  return <EstimatePage />;
}

if ("serviceWorker" in navigator) {
  void navigator.serviceWorker.register("/sw.js");
}

const root = document.getElementById("root");
if (!root) throw new Error("root element missing");
createRoot(root).render(
  <StrictMode>
    <Suspense fallback={<p className="p-4">Loading…</p>}>
      <Router />
    </Suspense>
  </StrictMode>,
);
