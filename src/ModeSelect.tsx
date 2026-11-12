import { lazy, Suspense, useState } from "react";
import LoadingScreen from "./LoadingScreen";
import GlobalGraphics from "./GlobalGraphics";
import "./home.css";

const JuniorOutpost = lazy(() => import("./outpost/JuniorOutpost"));
const Commander = lazy(() => import("./commander/Commander"));
const Strategy = lazy(() => import("./App"));
const HistoryHub = lazy(() => import("./history/HistoryHub"));
const HowToPlay = lazy(() => import("./HowToPlay"));

type GameMode = "outpost" | "strategy" | "commander" | "history" | "history_all" | "guide";

const experiences: { id: GameMode; number: string; label: string; title: string; detail: string; meta: string }[] = [
  { id: "outpost", number: "01", label: "SURFACE OPERATIONS", title: "Junior Astronaut — Space Outpost", detail: "Manage a Moon or Mars base. Balance life support, radiation shielding, power and greenhouse food production.", meta: "2 WORLDS · 10-SOL SURVIVAL MISSIONS" },
  { id: "commander", number: "02", label: "PLAY IN FIRST PERSON", title: "Commander — Be the Astronaut", detail: "Move through a spacecraft, operate controls, repair equipment and explore the Moon.", meta: "18 MISSIONS · 6 CAMPAIGNS" },
  { id: "strategy", number: "03", label: "DESIGN AND MAKE DECISIONS", title: "Mission Planner — Build & Launch", detail: "Configure spacecraft systems, balance resources and solve engineering challenges from mission control.", meta: "20 PLANNING CHALLENGES" },
  { id: "history", number: "04", label: "START WITH THE HIGHLIGHTS", title: "Featured Space Stories", detail: "Explore ten pivotal missions through historical records, original footage and playable reconstructions.", meta: "10 FEATURED STORIES" },
  { id: "history_all", number: "05", label: "BROWSE EVERY STORY", title: "Full Story Archive", detail: "Trace the history of exploration through 55 missions, from early capsules to robotic probes.", meta: "55 STORIES · SEARCH & FILTERS" },
  { id: "guide", number: "06", label: "LEARN THE CONTROLS", title: "How to Play", detail: "Learn how to move, INTERACT, follow mission objectives and save your progress.", meta: "IPAD · IPHONE · LAPTOP" },
];

function MissionArrow() {
  return <svg className="orbital-arrow" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" aria-hidden="true"><path d="M3 13 13 3M3 3h10v10"/></svg>;
}

function MissionGlyph({ mode }: { mode: GameMode }) {
  return <svg viewBox="0 0 120 100" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true">
    {mode === "outpost" ? <><path d="M10 80h100M20 80V53l10-14h36l12 14v27M28 80V54h42v26M38 80V61h22v19M78 61h23v19M87 61V45m-8 0h16M14 87h73"/><circle cx="93" cy="20" r="11"/><path d="M33 39V28h8v11m9 0V28h8v11M31 54h36"/></> :
      mode === "commander" ? <><path d="m60 8 29 34 9 39H22l9-39L60 8ZM31 42h58M33 81l-9 9m63-9 9 9M45 42V27m30 15V27M60 43v27m-15-2h30M38 74h44"/><path d="m45 27 15-8 15 8-6 10H51l-6-10Z"/><circle cx="38" cy="55" r="3"/><circle cx="81" cy="55" r="3"/></> :
      mode === "strategy" ? <><path d="M60 7c-9 10-12 23-12 38v33h24V45c0-15-3-28-12-38ZM48 56 35 72v15l13-9m24-22 13 16v15L72 78M48 47h24M53 27h14M55 83v10m10-10v10M12 46h20m56 0h20M24 41v10m72-10v10"/><circle cx="60" cy="36" r="4"/><path d="M18 17h17m-17 0v17m84 49H85m17 0V66"/></> :
      mode === "history" ? <><circle cx="60" cy="50" r="28"/><ellipse cx="60" cy="50" rx="50" ry="13" transform="rotate(-28 60 50)"/><path d="m51 33 17 3 7 17-10 15-20-7-2-17 8-11Z"/><circle cx="95" cy="32" r="4"/><path d="M13 83h35m-35 5h23M94 78v13m-6-6h12"/></> :
      mode === "history_all" ? <><path d="M25 20h64v67H25V20Zm8-9h64v68M40 36h34M40 44h23M40 71h34"/><circle cx="48" cy="58" r="5"/><path d="m53 58 17-4m-17 4 13 5M13 29v42"/></> :
      <><circle cx="60" cy="50" r="36"/><path d="M60 28v30m-7 0h14M56 69h8M18 50h9m66 0h9M60 8v9m0 66v9"/><circle cx="60" cy="50" r="46" strokeDasharray="1 7"/></>}
  </svg>;
}

export default function ModeSelect() {
  const [mode, setMode] = useState<GameMode | null>(null);
  if (!mode) {
    const start = (next: GameMode) => setMode(next);
    const scrollToMissions = () => document.getElementById("orbital-experiences")?.scrollIntoView({behavior: "smooth"});
    const tile = (item: typeof experiences[number]) =>
      <button type="button" className={"orbital-mode-tile orbital-mode-"+item.id} key={item.id}
        onClick={() => start(item.id)} aria-label={"Open "+item.title}>
        <span className="orbital-mode-top"><span>{item.label}</span><span>{item.number} / 06</span></span>
        <span className="orbital-mode-art" aria-hidden="true"><MissionGlyph mode={item.id}/></span>
        <span className="orbital-mode-copy">
          <strong>{item.title}</strong>
          <span className="orbital-mode-detail">{item.detail}</span>
        </span>
        <span className="orbital-mode-bottom"><span>{item.meta}</span><b>OPEN MODE <MissionArrow/></b></span>
      </button>;
    return <div className="orbital-landing">
      <header className="orbital-landing-nav">
        <span className="orbital-mark">
          <svg viewBox="0 0 36 36" fill="none" aria-hidden="true"><circle cx="18" cy="18" r="11"/><ellipse cx="18" cy="18" rx="17" ry="6" transform="rotate(-38 18 18)"/></svg>
          <b>ORBITAL</b><small>MISSION LAB</small>
        </span>
        <nav className="orbital-nav-actions" aria-label="Home navigation">
          <button type="button" onClick={scrollToMissions}>GAME MODES</button>
          <button type="button" className="orbital-nav-guide" onClick={() => start("guide")}>HOW TO PLAY</button>
          <GlobalGraphics/>
        </nav>
      </header>

      <main>
        <section className="orbital-landing-hero" aria-labelledby="orbital-welcome-title">
          <div className="orbital-hero-picture" aria-hidden="true"/>
          <div className="orbital-hero-inner">
            <div className="orbital-hero-content">
              <span className="orbital-hero-overline"><i/> SPACE EXPLORATION / MISSION CONTROL</span>
              <h1 id="orbital-welcome-title">Choose your<br/><em>next mission.</em></h1>
              <p>Explore spacecraft, run a Moon or Mars outpost, design missions, and discover the history of spaceflight.</p>
              <div className="orbital-hero-actions">
                <button type="button" className="orbital-hero-primary" onClick={() => start("commander")}>PLAY COMMANDER <MissionArrow/></button>
                <button type="button" className="orbital-hero-secondary" onClick={scrollToMissions}>BROWSE ALL MODES ↓</button>
              </div>
              <div className="orbital-hero-facts" aria-label="Game information">
                <span><b>05</b> GAME EXPERIENCES</span>
                <span><b>01</b> PLAYER GUIDE</span>
                <span>PROGRESS SAVED LOCALLY</span>
              </div>
            </div>
            <aside className="orbital-launchpad" aria-label="Quick start">
              <div className="orbital-launchpad-header"><span>QUICK START</span><small>CHOOSE AN EXPERIENCE</small></div>
              {experiences.slice(0,3).map(item =>
                <button type="button" className="orbital-launchpad-item" key={item.id} onClick={() => start(item.id)}>
                  <span className="orbital-launchpad-icon" aria-hidden="true"><MissionGlyph mode={item.id}/></span>
                  <span className="orbital-launchpad-copy"><strong>{item.title}</strong><small>{item.meta}</small></span>
                  <MissionArrow/>
                </button>
              )}
              <button type="button" className="orbital-launchpad-guide" onClick={() => start("guide")}>New here? Read the controls guide <MissionArrow/></button>
            </aside>
          </div>
          <div className="orbital-hero-bottom">
            <span>INDEPENDENT EDUCATIONAL SIMULATION</span>
            <span>NASA/JSC · KATE RUBINS PHOTOGRAPHY</span>
          </div>
        </section>

        <section className="orbital-experiences" id="orbital-experiences" aria-labelledby="orbital-mode-heading">
          <div className="orbital-section-head">
            <span className="orbital-small-label">MISSION DIRECTORY / 05 GAME EXPERIENCES</span>
            <h2 id="orbital-mode-heading">Explore the <em>mission lab.</em></h2>
            <p>Pick a game below, or explore the historical spaceflight collection.</p>
          </div>
          <div className="orbital-group-heading">
            <div><span className="orbital-small-label">01 / PLAY & BUILD</span><h3>Interactive missions</h3></div>
            <span>THREE WAYS TO EXPLORE</span>
          </div>
          <div className="orbital-mode-grid orbital-mode-grid-primary">
            {experiences.slice(0,3).map(tile)}
          </div>

          <div className="orbital-group-heading orbital-group-history">
            <div><span className="orbital-small-label">02 / EXPLORE</span><h3>Spaceflight history</h3></div>
            <span>FEATURED STORIES & FULL ARCHIVE</span>
          </div>
          <div className="orbital-mode-grid orbital-mode-grid-history">
            {experiences.slice(3,5).map(tile)}
          </div>

          <section className="orbital-guide-strip" aria-label="Help and controls">
            <div className="orbital-guide-mark" aria-hidden="true"><MissionGlyph mode="guide"/></div>
            <div><span className="orbital-small-label">NEED A HAND?</span><h3>First mission? Start with the guide.</h3>
              <p>Learn movement, INTERACT, mission objectives and saving your progress.</p></div>
            <button type="button" onClick={() => start("guide")}>HOW TO PLAY <MissionArrow/></button>
          </section>
        </section>
      </main>

      <footer className="orbital-site-footer">
        <span>ORBITAL / MISSION LAB</span>
        <span>Independent educational simulation · Not affiliated with NASA</span>
        <a href="./assets/realism/ATTRIBUTION.md" target="_blank" rel="noopener noreferrer">3D asset credits</a>
        <a href="./assets/backgrounds/ATTRIBUTION.txt" target="_blank" rel="noopener noreferrer">Background photo credit</a>
        <a href="/privacy.html" target="_blank" rel="noopener noreferrer">Privacy & local saves</a>
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
