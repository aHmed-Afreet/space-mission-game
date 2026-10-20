import { lazy, Suspense, useState } from "react";
import App from "./App";
const Commander = lazy(() => import("./commander/Commander"));
const HistoryHub = lazy(() => import("./history/HistoryHub"));
const HowToPlay = lazy(() => import("./HowToPlay"));
export default function ModeSelect() {
  const [mode, setMode] = useState<"strategy" | "commander" | "history" | "guide" | null>(null);
  if (!mode)
    return (
      <div className="cmd-mode-select">
        <span className="eyebrow">ORBITAL MISSION LAB</span>
        <h1>Choose your command.</h1>
        <p>Build a spacecraft, command astronaut missions, or explore real spaceflight history.</p>
        <div className="cmd-mode-cards">
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
          <button onClick={() => setMode("history")}>
            <strong>Space History &amp; Stories</strong>
            <span>Read 55 real space mission histories or switch to Live the Story for interactive training decisions.</span>
          </button>
          <button onClick={() => setMode("guide")}>
            <strong>How to Play</strong>
            <span>Learn Strategy, Commander, mobile controls, missions, progress and science.</span>
          </button>
        </div>
        <footer className="cmd-publish-footer">
          <span>Independent educational simulation · not affiliated with or endorsed by NASA</span>
          <a href="/privacy.html" target="_blank" rel="noopener noreferrer">Privacy & local saves</a>
        </footer>
      </div>
    );
  if (mode === "history" || mode === "guide") {
    return <Suspense fallback={<p className="cmd-builder">Loading mission records…</p>}>
      {mode === "guide" ? <HowToPlay onExit={() => setMode(null)} /> :
        <HistoryHub startIn="archive" onExit={() => setMode(null)} />}
    </Suspense>;
  }
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
