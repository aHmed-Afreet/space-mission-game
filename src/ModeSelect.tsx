import { lazy, Suspense, useState } from "react";
import App from "./App";
import "./home.css";

const Commander = lazy(() => import("./commander/Commander"));
const HistoryHub = lazy(() => import("./history/HistoryHub"));
const HowToPlay = lazy(() => import("./HowToPlay"));

type GameMode = "strategy" | "commander" | "history" | "guide";

const experiences: { id: GameMode; number: string; label: string; title: string; detail: string; meta: string }[] = [
  { id: "commander", number: "01", label: "FIRST-PERSON SIMULATION", title: "Fly as an Astronaut", detail: "Walk through a spacecraft, run flight systems, repair satellites and explore lunar terrain. Choose your destination after entering.", meta: "EARTH ORBIT · MOON · MORE PLANNED" },
  { id: "strategy", number: "02", label: "MISSION DESIGN", title: "Build & Launch Missions", detail: "Engineer a robotic Mars explorer, choose equipment and rockets, manage your budget and complete 20 sequential challenges.", meta: "20 STRATEGY LEVELS" },
  { id: "history", number: "03", label: "SPACE EXPLORATION ARCHIVE", title: "Explore Space History", detail: "Discover 55 historic space missions, then enter first-person training scenes inspired by the real events.", meta: "55 HISTORICAL MISSIONS" },
  { id: "guide", number: "04", label: "START HERE", title: "Controls & How to Play", detail: "Learn the controls, mission stages, astronaut tools and how to save progress before your first flight.", meta: "IPAD · IPHONE · LAPTOP" },
];

export default function ModeSelect() {
  const [mode, setMode] = useState<GameMode | null>(null);
  if (!mode) {
    return <div className="orbital-landing">
      <header className="orbital-landing-nav">
        <span className="orbital-mark">✦ <b>ORBITAL</b><small>MISSION LAB</small></span>
        <button type="button" onClick={() => document.getElementById("orbital-experiences")?.scrollIntoView({behavior:"smooth"})}>EXPLORE MODES <span aria-hidden="true">↗</span></button>
      </header>
      <section className="orbital-landing-hero" aria-labelledby="orbital-welcome-title">
        <div className="orbital-hero-picture" aria-hidden="true" />
        <div className="orbital-hero-content">
          <span className="orbital-hero-overline"><i /> INTERACTIVE SPACE EXPLORATION</span>
          <h1 id="orbital-welcome-title">BEYOND<br/><em>EARTH.</em></h1>
          <p>Launch a mission. Command a spacecraft. Walk on the Moon. Learn how space exploration works — by taking control.</p>
          <div className="orbital-hero-actions">
            <button type="button" className="orbital-hero-primary" onClick={() => setMode("commander")}>ENTER COMMANDER <span aria-hidden="true">↗</span></button>
            <button type="button" className="orbital-hero-secondary" onClick={() => document.getElementById("orbital-experiences")?.scrollIntoView({behavior:"smooth"})}>CHOOSE AN EXPERIENCE ↓</button>
          </div>
        </div>
        <div className="orbital-hero-bottom"><span>01 / THE NEXT FRONTIER</span><span>SCROLL TO EXPLORE ↓</span></div>
      </section>
      <section className="orbital-experiences" id="orbital-experiences" aria-labelledby="orbital-mode-heading">
        <div className="orbital-section-head">
          <span className="orbital-small-label">MISSION SELECTION / 4 EXPERIENCES</span>
          <h2 id="orbital-mode-heading">How will you <em>explore?</em></h2>
          <p>Pick how you want to play. Each mode is a different experience — all within the same space mission simulator.</p>
        </div>
        <div className="orbital-mode-grid">
          {experiences.map(item => <button type="button" className={"orbital-mode-tile orbital-mode-"+item.id} key={item.id} onClick={() => setMode(item.id)}>
            <span className="orbital-mode-top"><span>{item.label}</span><span>{item.number} / 04</span></span>
            <span className="orbital-mode-art" aria-hidden="true"><i/><b/></span>
            <strong>{item.title}</strong>
            <span className="orbital-mode-detail">{item.detail}</span>
            <span className="orbital-mode-bottom"><span>{item.meta}</span><b>EXPLORE ↗</b></span>
          </button>)}
        </div>
      </section>
      <footer className="orbital-site-footer">
        <span>✦ ORBITAL MISSION LAB</span>
        <span>Independent educational simulation · Not affiliated with NASA</span>
        <a href="/privacy.html" target="_blank" rel="noopener noreferrer">Privacy & local saves ↗</a>
      </footer>
    </div>;
  }
  if (mode === "history" || mode === "guide")
    return <Suspense fallback={<p className="cmd-builder">Loading mission records…</p>}>
      {mode === "guide" ? <HowToPlay onExit={() => setMode(null)} /> :
        <HistoryHub startIn="archive" onExit={() => setMode(null)} />}
    </Suspense>;

  return <>
    {mode === "strategy" && <div className="cmd-mode-bar">
      <button onClick={() => setMode(null)}>← Main menu</button><span>BUILD & LAUNCH · STRATEGY</span>
    </div>}
    {mode === "strategy" ? <App /> :
      <Suspense fallback={<p className="cmd-builder">Loading spacecraft systems…</p>}>
        <Commander onExit={() => setMode(null)} />
      </Suspense>}
  </>;
}
