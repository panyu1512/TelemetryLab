import { useTelemetry } from "./hooks/useTelemetry";
import { WS_URL } from "./config";

/** True when running inside the Tauri WebView (vs. a plain browser tab). */
const isTauri =
  typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

async function windowAction(action: "minimize" | "close") {
  if (!isTauri) return;
  // Imported lazily so a plain browser dev session never touches the Tauri API.
  const { getCurrentWindow } = await import("@tauri-apps/api/window");
  const w = getCurrentWindow();
  if (action === "minimize") await w.minimize();
  if (action === "close") await w.close();
}

export default function App() {
  const { data, connected, iracingActive } = useTelemetry();

  let status: { label: string; color: string };
  if (!connected) {
    status = { label: "Connecting to bridge…", color: "var(--warning)" };
  } else if (!iracingActive) {
    status = { label: "Waiting for iRacing…", color: "var(--muted)" };
  } else {
    status = { label: "Live", color: "var(--accent)" };
  }

  return (
    <div style={styles.app}>
      {/* Custom frameless title bar (the native one is disabled). */}
      <header style={styles.titlebar} data-tauri-drag-region>
        <div style={styles.brand} data-tauri-drag-region>
          <span style={{ color: "var(--accent)" }}>●</span>
          <span>iRacing Telemetry</span>
        </div>
        <div style={styles.statusPill}>
          <span style={{ ...styles.dot, background: status.color }} />
          <span style={{ color: status.color }}>{status.label}</span>
        </div>
        {isTauri && (
          <div style={styles.windowControls}>
            <button
              style={styles.winBtn}
              onClick={() => windowAction("minimize")}
              aria-label="Minimize"
            >
              –
            </button>
            <button
              style={{ ...styles.winBtn, ...styles.closeBtn }}
              onClick={() => windowAction("close")}
              aria-label="Close"
            >
              ✕
            </button>
          </div>
        )}
      </header>

      <main style={styles.main}>
        {!connected && (
          <div style={styles.center}>
            <h1 style={styles.h1}>Connecting…</h1>
            <p style={styles.muted}>
              Trying to reach the telemetry bridge at <code>{WS_URL}</code>
            </p>
          </div>
        )}

        {connected && !iracingActive && (
          <div style={styles.center}>
            <h1 style={styles.h1}>Waiting for iRacing…</h1>
            <p style={styles.muted}>
              The bridge is connected. Start a session in iRacing (or run the
              mock bridge) to see live data.
            </p>
          </div>
        )}

        {connected && iracingActive && data && (
          <div style={styles.dataView}>
            <p style={styles.muted}>
              Raw telemetry frame — UI components will render this data later.
            </p>
            <pre style={styles.pre}>{JSON.stringify(data, null, 2)}</pre>
          </div>
        )}
      </main>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  app: {
    display: "flex",
    flexDirection: "column",
    height: "100%",
    background: "var(--bg)",
    color: "var(--text)",
  },
  titlebar: {
    display: "flex",
    alignItems: "center",
    gap: 16,
    height: 40,
    padding: "0 12px",
    background: "var(--bg-elevated)",
    borderBottom: "1px solid var(--border)",
    flex: "0 0 auto",
  },
  brand: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    fontWeight: 600,
    fontSize: 13,
    letterSpacing: 0.5,
  },
  statusPill: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    fontSize: 12,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: "50%",
    display: "inline-block",
  },
  windowControls: {
    marginLeft: "auto",
    display: "flex",
    gap: 4,
  },
  winBtn: {
    width: 28,
    height: 24,
    background: "transparent",
    color: "var(--muted)",
    border: "none",
    borderRadius: 4,
    cursor: "pointer",
    fontSize: 14,
    lineHeight: 1,
  },
  closeBtn: {
    color: "var(--text)",
  },
  main: {
    flex: "1 1 auto",
    overflow: "auto",
    padding: 24,
  },
  center: {
    height: "100%",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    textAlign: "center",
    gap: 8,
  },
  h1: {
    margin: 0,
    fontSize: 24,
    fontWeight: 600,
    color: "var(--accent)",
  },
  muted: {
    margin: 0,
    color: "var(--muted)",
    fontSize: 13,
  },
  dataView: {
    display: "flex",
    flexDirection: "column",
    gap: 12,
  },
  pre: {
    margin: 0,
    padding: 16,
    background: "var(--bg-elevated)",
    border: "1px solid var(--border)",
    borderRadius: 8,
    fontSize: 12,
    lineHeight: 1.5,
    color: "var(--accent)",
    overflow: "auto",
    userSelect: "text",
  },
};
