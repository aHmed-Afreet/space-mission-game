import { lazy, Suspense, useState } from "react";
import LoadingScreen from "./LoadingScreen";
import "./home.css";

const JuniorOutpost = lazy(() => import("./outpost/JuniorOutpost"));
const Commander = lazy(() => import("./commander/Commander"));
const Strategy = lazy(() => import("./App"));
const HistoryHub = lazy(() => import("./history/HistoryHub"));
const HowToPlay = lazy(() => import("./HowToPlay"));

type GameMode = "outpost" | "strategy" | "commander" | "history" | "history_all" | "guide";

const experiences: { id: GameMode; number: string; label: string; title: string; detail: string; meta: string }[] = [
  { id: "outpost", number: "01", label: "NASA SPACE APPS CHALLENGE THEME", title: "Junior Astronaut — Space Outpost", detail: "Manage a Moon or Mars base. Balance life support, radiation shielding, power and greenhouse food production.", meta: "2 WORLDS · 10-SOL SURVIVAL MISSIONS" },
  { id: "commander", number: "02", label: "PLAY IN FIRST PERSON", title: "Commander — Be the Astronaut", detail: "Move through a spacecraft, operate controls, repair equipment and explore the Moon.", meta: "18 MISSIONS · 6 CAMPAIGNS" },
  { id: "strategy", number: "03", label: "DESIGN AND MAKE DECISIONS", title: "Mission Planner — Build & Launch", detail: "Choose spacecraft systems, balance resources and make engineering decisions. You do not fly in this mode.", meta: "20 PLANNING CHALLENGES" },
  { id: "history", number: "04", label: "START WITH THE HIGHLIGHTS", title: "Featured Space Stories", detail: "Discover 10 real missions. Watch footage or an animation inside the game, then experience the mission.", meta: "10 FEATURED STORIES" },
  { id: "history_all", number: "05", label: "BROWSE EVERY STORY", title: "Full Story Archive", detail: "Search all 55 historical missions. Read their history or try a playable reconstruction.", meta: "55 STORIES · SEARCH & FILTERS" },
  { id: "guide", number: "06", label: "LEARN THE CONTROLS", title: "How to Play", detail: "Learn how to move, INTERACT, follow mission objectives and save your progress.", meta: "IPAD · IPHONE · LAPTOP" },
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
          <h1 id="orbital-welcome-title">SPACE<br/><em>MISSIONS.</em></h1>
          <p>Build a sustainable Moon or Mars outpost, run spacecraft missions, or explore real space history. Balance oxygen, water, radiation protection, electricity and food to succeed. Progress is saved on this device.</p>
          <div className="orbital-hero-actions">
            <button type="button" className="orbital-hero-primary" onClick={() => setMode("outpost")}>RUN SPACE OUTPOST <span aria-hidden="true">↗</span></button>
            <button type="button" className="orbital-hero-secondary" onClick={() => document.getElementById("orbital-experiences")?.scrollIntoView({behavior:"smooth"})}>CHOOSE AN EXPERIENCE ↓</button>
          </div>
        </div>
        <div className="orbital-hero-bottom"><span>01 / THE NEXT FRONTIER</span><span>SCROLL TO EXPLORE ↓</span></div>
      </section>
      <section className="orbital-experiences" id="orbital-experiences" aria-labelledby="orbital-mode-heading">
        <div className="orbital-section-head">
          <span className="orbital-small-label">MISSION SELECTION / 6 EXPERIENCES</span>
          <h2 id="orbital-mode-heading">Choose your <em>experience.</em></h2>
          <p>Each experience has different controls and objectives. Choose one to begin.</p>
        </div>
        <div className="orbital-mode-grid">
          {experiences.map(item => <button type="button" className={"orbital-mode-tile orbital-mode-"+item.id} key={item.id} onClick={() => setMode(item.id)}>
            <span className="orbital-mode-top"><span>{item.label}</span><span>{item.number} / 06</span></span>
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
        <a href="./assets/backgrounds/ATTRIBUTION.txt" target="_blank" rel="noopener noreferrer">Background photo credit ↗</a>
        <a href="/privacy.html" target="_blank" rel="noopener noreferrer">Privacy & local saves ↗</a>
      </footer>
    </div>;
  }
  if (mode === "outpost") return <Suspense fallback={<LoadingScreen detail="Preparing the Moon and Mars outpost systems…" />}><JuniorOutpost onExit={() => setMode(null)} /></Suspense>;
  if (mode === "history" || mode === "history_all" || mode === "guide")
    return <Suspense fallback={<LoadingScreen detail="Opening your mission records…" />}>
      {mode === "guide" ? <HowToPlay onExit={() => setMode(null)} /> :
        <HistoryHub startIn="archive" startCollection={mode==="history_all"?"archive":"featured"} onExit={() => setMode(null)} />}
    </Suspense>;

  return <>
    {mode === "strategy" && <div className="cmd-mode-bar">
      <button onClick={() => setMode(null)}>← Main menu</button><span>ENGINEERING SUPPORT · ASTRONAUT FLIES</span>
    </div>}
    <Suspense fallback={<LoadingScreen detail={mode==="strategy"?"Loading mission planning…":"Loading spacecraft systems…"} />}>
        {mode==="strategy" ? <Strategy /> : <Commander onExit={() => setMode(null)} />}
      </Suspense>
  </>;
}
