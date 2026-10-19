import { lazy, Suspense, useState } from "react";
import App from "./App";
const Commander = lazy(() => import("./commander/Commander"));
export default function ModeSelect() {
  const [mode, setMode] = useState<"strategy" | "commander" | null>(null);
  if (!mode)
    return (
      <div className="cmd-mode-select">
        <span className="eyebrow">ORBITAL MISSION LAB</span>
        <h1>Choose your command.</h1>
        <p>Two ways to explore a mission.</p>
        <div>
          <button onClick={() => setMode("strategy")}>
            <strong>Strategy Mode</strong>
            <span>The original Mars Explorer design-and-launch game.</span>
          </button>
          <button onClick={() => setMode("commander")}>
            <strong>Commander Mode</strong>
            <span>
              Play a guided campaign. Prepare your spacecraft, explore the Moon
              and bring science home.
            </span>
          </button>
        </div>
        <footer className="cmd-publish-footer">
          <span>Independent educational simulation · not affiliated with or endorsed by NASA</span>
          <a href="/privacy.html" target="_blank" rel="noopener noreferrer">Privacy & local saves</a>
        </footer>
      </div>
    );
  return (
    <>
      {mode === "strategy" && (
        <div className="cmd-mode-bar">
          <button
            onClick={() => {
              setMode(null);
            }}
          >
            ← Choose mode
          </button>
          <span>
            {mode === "strategy" ? "STRATEGY MODE" : "COMMANDER MODE"}
          </span>
        </div>
      )}
      {mode === "strategy" ? (
        <App />
      ) : (
        <Suspense
          fallback={<p className="cmd-builder">Loading spacecraft systems…</p>}
        >
          <Commander onExit={() => setMode(null)} />
        </Suspense>
      )}
    </>
  );
}
