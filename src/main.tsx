import { createRoot } from "react-dom/client";
import "./index.css";

const BOOT_RECOVERY_SESSION_KEY = "levela-boot-recovery-attempted";

declare global {
  interface Window {
    __LEVELA_BOOT_READY__?: () => void;
  }
}

function markBootReady() {
  if (typeof window === "undefined") return;
  window.__LEVELA_BOOT_READY__?.();
}

function getErrorMessage(reason: unknown) {
  if (reason instanceof Error) return reason.message;
  if (typeof reason === "string") return reason;
  try {
    return JSON.stringify(reason);
  } catch {
    return String(reason);
  }
}

function isChunkLoadLikeError(reason: unknown) {
  const message = getErrorMessage(reason).toLowerCase();
  return (
    message.includes("failed to fetch dynamically imported module")
    || message.includes("importing a module script failed")
    || message.includes("loading chunk")
    || message.includes("chunkloaderror")
  );
}

function attemptBootRecovery(reason: unknown) {
  if (typeof window === "undefined") return false;
  if (!isChunkLoadLikeError(reason)) return false;

  try {
    const alreadyAttempted = window.sessionStorage.getItem(BOOT_RECOVERY_SESSION_KEY) === "1";
    if (alreadyAttempted) return false;

    window.sessionStorage.setItem(BOOT_RECOVERY_SESSION_KEY, "1");
    const url = new URL(window.location.href);
    url.searchParams.set("boot_recovery", Date.now().toString());
    window.location.replace(url.toString());
    return true;
  } catch {
    return false;
  }
}

function renderFatalBootScreen(reason: unknown) {
  if (typeof document === "undefined") return;

  const message = getErrorMessage(reason);
  const root = document.getElementById("root");
  if (!root) return;

  root.innerHTML = `
    <div style="min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px;background:#050b12;color:#e8f2ff;font-family:Inter,system-ui,-apple-system,Segoe UI,Roboto,sans-serif;">
      <div style="width:100%;max-width:520px;border:1px solid rgba(88,117,146,.35);border-radius:24px;background:rgba(10,22,34,.92);padding:20px;">
        <h1 style="margin:0 0 8px 0;font-size:24px;line-height:1.2;">Levela couldn't start</h1>
        <p style="margin:0 0 14px 0;font-size:14px;line-height:1.5;color:#aac2da;">
          A startup error blocked the app from loading. Reload to recover. If this keeps happening, use the latest APK.
        </p>
        <pre style="margin:0 0 16px 0;padding:12px;border-radius:14px;background:#07121e;color:#90adc9;white-space:pre-wrap;word-break:break-word;font-size:12px;line-height:1.4;">${message}</pre>
        <button id="levela-startup-reload-btn" style="height:40px;border:0;border-radius:12px;background:#34d1c6;color:#02151f;font-weight:600;padding:0 16px;cursor:pointer;">
          Reload app
        </button>
      </div>
    </div>
  `;

  const reloadButton = document.getElementById("levela-startup-reload-btn");
  reloadButton?.addEventListener("click", () => window.location.reload());
}

window.addEventListener("error", (event) => {
  if (attemptBootRecovery(event.error || event.message)) {
    event.preventDefault();
  }
});

window.addEventListener("unhandledrejection", (event) => {
  if (attemptBootRecovery(event.reason)) {
    event.preventDefault();
  }
});

async function bootstrapApp() {
  try {
    const rootElement = document.getElementById("root");
    if (!rootElement) {
      throw new Error("Root container #root was not found.");
    }

    const appModule = await import("./App.tsx");
    const App = appModule.default;
    createRoot(rootElement).render(<App />);
    markBootReady();

    try {
      window.sessionStorage.removeItem(BOOT_RECOVERY_SESSION_KEY);
    } catch {
      // Ignore storage failures.
    }
  } catch (error) {
    if (!attemptBootRecovery(error)) {
      renderFatalBootScreen(error);
    }
  }
}

void bootstrapApp();
