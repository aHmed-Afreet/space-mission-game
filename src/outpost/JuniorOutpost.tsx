import { useEffect, useState } from "react";
import {
  ACTIONS, GAME_KEY, MISSION_LENGTH, WORLD, advanceSol, availableAction,
  forecast, initialOutpost, isValidOutpost, missionCriteria, missionScore,
  perform, projectPower, setPriority, type Destination, type Outpost, type Priority,
} from "./engine";
import "./outpost.css";

const modules = [
  { id: "habitat", icon: "◈", title: "Crew Habitat", blurb: "Oxygen, water and food keep astronauts alive. The cabin must remain powered." },
  { id: "solar", icon: "☀", title: "Solar Field", blurb: "Generates electricity when sunlight is available. Mars dust and lunar night reduce output." },
  { id: "shield", icon: "⬡", title: "Storm Shelter", blurb: "Protects the crew during radiation events. Better shielding reduces cumulative exposure." },
  { id: "recycle", icon: "↻", title: "Life Support", blurb: "Reclaims oxygen and water, but competes with the greenhouse for electricity." },
  { id: "greenhouse", icon: "✿", title: "Greenhouse", blurb: "Grows crops using water and electricity. Harvest crops to produce usable food." },
  { id: "battery", icon: "▰", title: "Battery Bank", blurb: "Stores power for eclipse, night and dust storms. Empty batteries interrupt recycling." },
] as const;

function readSaved(destination: Destination): Outpost | null {
  try {
    const raw = window.localStorage.getItem(GAME_KEY + "-" + destination);
    if (!raw) return null;
    const value: unknown = JSON.parse(raw);
    return isValidOutpost(value) && value.destination === destination ? value : null;
  } catch { return null; }
}
function statusColor(value: number, dangerLow = true) {
  return dangerLow ? value <= 25 ? "danger" : value <= 50 ? "warning" : "good"
    : value >= 65 ? "danger" : value >= 40 ? "warning" : "good";
}
function Resource({ title, value, unit = "", icon, caution, reverse = false }: {
  title: string; value: number; unit?: string; icon: string; caution?: string; reverse?: boolean;
}) {
  const percent = Math.max(0, Math.min(100, value));
  return <div className={"outpost-meter " + statusColor(value, !reverse)}>
    <div className="outpost-meter-top"><span aria-hidden="true">{icon}</span><span>{title}</span></div>
    <strong>{Math.round(value)}<small>{unit}</small></strong>
    <div className="outpost-track" aria-hidden="true"><span style={{width: percent + "%"}} /></div>
    {caution && <small>{caution}</small>}
  </div>;
}
export default function JuniorOutpost({ onExit }: { onExit: () => void }) {
  const [session, setSession] = useState<Outpost | null>(null);
  const [inspected, setInspected] = useState<string>("habitat");
  const [showLog, setShowLog] = useState(false);
  const [saveNote, setSaveNote] = useState("");
  useEffect(() => {
    if (!session) return;
    try {
      window.localStorage.setItem(GAME_KEY + "-" + session.destination, JSON.stringify(session));
      setSaveNote("Saved on this device");
    } catch {
      setSaveNote("Saving is blocked by your browser. Keep this tab open.");
    }
  }, [session]);
  function launch(destination: Destination) {
    const saved = readSaved(destination);
    setSession(saved ?? initialOutpost(destination));
    setShowLog(false); setInspected("habitat");
  }
  function restart() {
    if (!session) return;
    if (window.confirm("Restart this outpost campaign? Your current run for this destination will be replaced.")) {
      setSession(initialOutpost(session.destination));
      setShowLog(false);
    }
  }
  if (!session) return <div className="outpost-app">
    <header className="outpost-topbar">
      <button onClick={onExit}>← MAIN MENU</button>
      <strong>✦ ORBITAL / JUNIOR ASTRONAUT</strong><span>MISSION TRAINER</span>
    </header>
    <main className="outpost-home">
      <div className="outpost-eyebrow">BUILD · BALANCE · SURVIVE · LEARN</div>
      <h1>RUN YOUR OWN <em>SPACE OUTPOST.</em></h1>
      <p className="outpost-lead">You're the mission commander. Build a lunar or Martian research base and keep your crew safe for ten simulated sols. Every decision changes the balance of oxygen, water, radiation protection, electricity and food production.</p>
      <div className="outpost-worlds">
        {(["moon", "mars"] as const).map(world => <button key={world} className={"outpost-world-card outpost-" + world} onClick={() => launch(world)}>
          <span className="outpost-world-orb" aria-hidden="true" />
          <span className="outpost-tag">{WORLD[world].difficulty.toUpperCase()}</span>
          <strong>{WORLD[world].label}</strong><span>{world === "moon" ? "Prepare for lunar night and solar particle events." : "Confront dust storms, weaker sunlight and crew protection decisions."}</span>
          <b>{readSaved(world) ? "RESUME MISSION →" : "START MISSION →"}</b>
        </button>)}
      </div>
      <section className="outpost-intro-grid">
        <article><strong>01 / ENGINEER</strong><p>Improve solar panels, shielding, recycling and the greenhouse within a limited budget.</p></article>
        <article><strong>02 / DECIDE</strong><p>Choose whether to prioritize crew safety, balanced operations or food production.</p></article>
        <article><strong>03 / LEARN</strong><p>Watch the effects of your decisions and review a transparent ten-sol mission report.</p></article>
      </section>
      <p className="outpost-disclaimer">Independent student learning game, not a NASA product. Resource figures and simulated sols are simplified game units, not real engineering predictions.</p>
    </main>
  </div>;
  const prediction = projectPower(session);
  const next = forecast(session.destination, session.sol);
  const criteria = missionCriteria(session);
  const score = missionScore(session);
  const details = modules.find(x => x.id === inspected) ?? modules[0];
  const complete = session.phase !== "active";
  return <div className="outpost-app">
    <header className="outpost-topbar">
      <button onClick={() => setSession(null)}>← OUTPOST SELECT</button>
      <strong>✦ ORBITAL / {session.destination.toUpperCase()} OUTPOST</strong>
      <button onClick={onExit}>MAIN MENU ↗</button>
    </header>
    <main className="outpost-content">
      <section className="outpost-heading">
        <div><span className="outpost-eyebrow">JUNIOR ASTRONAUT MISSION TRAINER</span><h1>{WORLD[session.destination].label}</h1>
          <p>Make one strategic operation per sol, choose an electricity priority, then advance your mission.</p></div>
        <div className="outpost-day"><small>MISSION DAY</small><strong>{Math.min(session.sol, MISSION_LENGTH)} <span>/ {MISSION_LENGTH}</span></strong>
          <small>{complete ? "DEBRIEF READY" : "ACTIVE OPERATIONS"}</small></div>
      </section>
      <div className="outpost-layout">
        <div className="outpost-maincol">
          <section className="outpost-alert" aria-live="polite">
            <span className="outpost-tag">{complete ? "MISSION REVIEW" : next.storm ? "RADIATION EVENT" : next.dust || next.sunlight === 0 ? "LOW SOLAR GENERATION" : "ENVIRONMENT FORECAST"}</span>
            <h2>{complete ? session.phase === "won" ? "Outpost mission complete" : "Mission targets not met" : next.title}</h2>
            <p>{complete ? "Review what worked, what failed and how competing systems affected the outcome." : next.detail}</p>
          </section>
          <section className="outpost-resources" aria-label="Outpost resource readings">
            <Resource title="OXYGEN" value={session.oxygen} icon="◉" unit="%" />
            <Resource title="WATER" value={session.water} icon="◈" unit="%" />
            <Resource title="FOOD" value={session.food} icon="▣" unit="%" />
            <Resource title="BATTERY" value={session.battery} icon="▤" unit="%" />
            <Resource title="CREW SAFETY" value={session.safety} icon="✦" unit="%" />
            <Resource title="RADIATION" value={session.radiation} icon="☢" unit=" index" reverse />
          </section>
          <section className="outpost-panel">
            <div className="outpost-section-title"><div><span className="outpost-eyebrow">YOUR RESEARCH BASE</span><h2>Explore the outpost</h2></div><small>Select a facility to inspect it</small></div>
            <div className={"outpost-map outpost-map-" + session.destination}>
              <div className="outpost-horizon" aria-hidden="true" />
              {modules.map((m,i) => <button key={m.id} className={"outpost-module outpost-module-" + m.id + (inspected === m.id ? " selected" : "")} style={{["--module-index" as string]:i}} onClick={() => setInspected(m.id)} aria-pressed={inspected === m.id}>
                <span aria-hidden="true">{m.icon}</span><b>{m.title}</b>
              </button>)}
            </div>
            <div className="outpost-facility-detail" aria-live="polite"><div><strong>{details.title}</strong><p>{details.blurb}</p></div>
              <small>{details.id === "solar" ? "Array level " + session.solar : details.id === "shield" ? "Shield level " + session.shielding : details.id === "recycle" ? "Recycler level " + session.recycling : details.id === "greenhouse" ? "Greenhouse level " + session.greenhouses : details.id === "battery" ? Math.round(session.battery) + "% stored" : "Habitat integrity " + session.integrity + "%"}</small></div>
          </section>
          <section className="outpost-panel">
            <div className="outpost-section-title"><div><span className="outpost-eyebrow">YOUR ENGINEERING CHOICES</span><h2>Make a mission decision</h2></div><small>{session.selected ? "Operation recorded. Advance the sol." : "Choose one operation this sol"}</small></div>
            <div className="outpost-ops">
              {ACTIONS.map(item => {
                const availability = availableAction(session,item.id);
                return <button key={item.id} className={"outpost-operation" + (session.selected === item.id ? " active" : "")} onClick={() => setSession(s => s ? perform(s,item.id) : s)} disabled={!availability.ok} title={availability.reason ?? item.description}>
                  <span><strong>{item.title}</strong><small>{item.cost ? "−" + item.cost + " credits" : "FREE ACTION"}</small></span>
                  <p>{item.description}</p><em>{session.selected === item.id ? "✓ SELECTED" : !availability.ok ? availability.reason : item.note}</em>
                </button>;
              })}
            </div>
          </section>
        </div>
        <aside className="outpost-sidecol" aria-label="Mission control dashboard">
          <section className="outpost-panel">
            <span className="outpost-eyebrow">LIVE POWER TRADE-OFF</span><h2>Energy allocation</h2>
            <p className="outpost-muted">Choose where limited electricity goes. This affects greenhouse output and available battery reserve.</p>
            <div className="outpost-priorities">
              {([
                ["crew", "Life support first", "Suspend crop lighting to conserve electricity."],
                ["balanced", "Balanced", "Support life systems and moderate crop growth."],
                ["crops", "Food production", "Accelerate crops, consuming more water and power."],
              ] as [Priority,string,string][]).map(([id,title,desc]) => <button key={id} type="button" onClick={() => setSession(s => s ? setPriority(s,id) : s)} disabled={complete} className={session.priority === id ? "active" : ""} aria-pressed={session.priority === id}>
                <strong>{title}</strong><small>{desc}</small></button>)}
            </div>
            <dl className="outpost-power">
              <div><dt>Solar output</dt><dd>+{prediction.generation}</dd></div>
              <div><dt>System demand</dt><dd>−{prediction.demand}</dd></div>
              <div><dt>Battery after sol</dt><dd>{prediction.projectedBattery}%</dd></div>
              <div><dt>Mission credits</dt><dd>{session.credits}</dd></div>
            </dl><p className="outpost-muted">{prediction.note}</p>
          </section>
          <section className="outpost-panel">
            <span className="outpost-eyebrow">GREENHOUSE & MAINTENANCE</span><h2>Outpost operations</h2>
            <dl className="outpost-power">
              <div><dt>Grown crops</dt><dd>{Math.round(session.crop)}/100</dd></div>
              <div><dt>Food produced</dt><dd>{session.foodProduced}</dd></div>
              <div><dt>Habitat condition</dt><dd>{Math.round(session.integrity)}%</dd></div>
              <div><dt>Shield rating</dt><dd>Level {session.shielding}</dd></div>
            </dl>
          </section>
          <section className="outpost-panel">
            <span className="outpost-eyebrow">SUCCESS REQUIREMENTS</span><h2>Mission checklist</h2>
            <div className="outpost-checks">{criteria.map((c,i) => <div key={i}><span className={c.met ? "done" : ""}>{c.met ? "✓" : "○"}</span>{c.title}</div>)}</div>
          </section>
          <section className="outpost-panel outpost-control">
            <span className="outpost-eyebrow">MISSION CONTROL</span>
            {complete ? <><h2>{session.phase === "won" ? "MISSION SUCCESS" : "MISSION DEBRIEF"}</h2>
              <div className="outpost-score">{score}<small>/100 GAME SCORE</small></div>
              <p className="outpost-muted">{session.phase === "won" ? "All six objectives achieved. Review your engineering record." : "You can retry with a different engineering strategy. No real-world success probability is implied."}</p>
              <button className="outpost-next" onClick={restart}>RESTART MISSION ↻</button></> :
              <><h2>Advance mission</h2><p className="outpost-muted">{session.selected ? "Operation chosen: " + ACTIONS.find(x=>x.id===session.selected)?.title : "Select one operation before advancing."}</p>
              <button className="outpost-next" disabled={!session.selected} onClick={() => setSession(s => s ? advanceSol(s) : s)}>ADVANCE SOL {session.sol} →</button></>}
            <p className="outpost-save">{saveNote}</p>
            <button className="outpost-minor" onClick={restart}>Reset this mission</button>
          </section>
        </aside>
      </div>
      <section className="outpost-panel outpost-reports" aria-live="polite">
        <div className="outpost-section-title"><div><span className="outpost-eyebrow">ENGINEERING FEEDBACK</span><h2>Mission Control report</h2></div>
          <button className="outpost-minor" onClick={() => setShowLog(v => !v)}>{showLog ? "Hide" : "Show"} decision history</button></div>
        {session.lastReport.map((line,i) => <p key={i}>• {line}</p>)}
        {showLog && <div className="outpost-history">{session.log.slice().reverse().map((line,i) => <p key={i}>{line}</p>)}</div>}
      </section>
      <section className="outpost-panel outpost-learning">
        <div><span className="outpost-eyebrow">LEARN THE SCIENCE</span><h2>What is real, what is simplified?</h2>
          <p>Real engineering involves interdependent life support, solar energy, radiation protection and crop cultivation. This game's power, food, oxygen, radiation and time quantities are deliberately simplified and are not actual mission predictions.</p></div>
        <div className="outpost-links">
          <a href="https://science.nasa.gov/moon/by-the-numbers/" rel="noopener noreferrer" target="_blank">NASA: Moon facts ↗</a>
          <a href="https://science.nasa.gov/mars/facts/" rel="noopener noreferrer" target="_blank">NASA: Mars facts ↗</a>
          <a href="https://earth.gsfc.nasa.gov/climate/projects/solar-irradiance/science" rel="noopener noreferrer" target="_blank">NASA: Solar energy science ↗</a>
        </div>
      </section>
      <footer className="outpost-footer">ORBITAL MISSION LAB · INDEPENDENT EDUCATIONAL SIMULATION · NOT AFFILIATED WITH NASA</footer>
    </main>
  </div>;
}
