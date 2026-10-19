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
              Design life support. Walk the cabin. Manage supplies and crew
              readiness.
            </span>
          </button>
        </div>
      </div>
    );
  return (
    <>
      <div className="cmd-mode-bar">
        <button
          onClick={() => {
            setMode(null);
          }}
        >
          ← Choose mode
        </button>
        <span>{mode === "strategy" ? "STRATEGY MODE" : "COMMANDER MODE"}</span>
      </div>
      {mode === "strategy" ? (
        <App />
      ) : (
        <Suspense
          fallback={<p className="cmd-builder">Loading spacecraft systems…</p>}
        >
          <Commander />
        </Suspense>
      )}
    </>
  );
}
