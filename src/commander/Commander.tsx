import { useCallback, useEffect, useState } from "react";
import { components, rockets, trajectories, type Design } from "../game";
import Cabin from "./Cabin";
import {
  act,
  alerts,
  defaultDesign,
  defaultLife,
  engineering,
  lifeOptions,
  newMission,
  tick,
  type Action,
  type Area,
  type LifeSupport,
  type State,
} from "./simulation";
import "./commander.css";
import Icon from "./Icons";
import MissionTablet, {
  objectives,
  missionTime,
  type TabletTab,
} from "./MissionTablet";
import { deck, spawn, type Position } from "./layout";
import type { VisualAction } from "./interior";
type Save = {
  version: 1;
  design: Design;
  life: LifeSupport;
  mission: State | null;
};
const key = "orbital-commander-v1";
function readSave(): Save | null {
  try {
    const v = JSON.parse(localStorage.getItem(key) || "null");
    if (v?.version !== 1 || !v.design?.counts || !v.life || !v.mission)
      return null;
    for (const option of lifeOptions) {
      const n = v.life[option.key];
      if (!Number.isFinite(n) || n < option.min || n > option.max) return null;
    }
    if (!rockets[v.design.rocket] || !trajectories[v.design.trajectory])
      return null;
    for (const c of components) {
      const n = v.design.counts[c.id] || 0;
      if (!Number.isInteger(n) || n < 0 || n > 2) return null;
    }
    for (const k of [
      "minutes",
      "food",
      "water",
      "oxygen",
      "battery",
      "energy",
      "nutrition",
      "hydration",
      "sleepDebt",
      "pressure",
      "temperature",
      "radiation",
      "science",
      "fuel",
      "meals",
      "bottle",
      "parts",
    ])
      if (!Number.isFinite(v.mission[k])) return null;
    return {
      ...v,
      mission: {
        ...v.mission,
        paused: true,
        log: Array.isArray(v.mission.log) ? v.mission.log : [],
      },
    };
  } catch {
    return null;
  }
}
const stationActions: Record<Area, { action: Action; name: string }[]> = {
  cockpit: [
    { action: "course", name: "Verify course · 2 fuel" },
    { action: "finish", name: "Complete readiness sortie" },
  ],
  science: [{ action: "science", name: "Collect water-search data" }],
  communications: [{ action: "comms", name: "Calibrate link / transmit data" }],
  power: [{ action: "repair", name: "Repair fault · 1 part" }],
  galley: [
    { action: "takeMeal", name: "Take meal from storage" },
    { action: "fill", name: "Fill 1 L bottle" },
    { action: "dispenser", name: "Drink at dispenser · 250 mL" },
  ],
  sleep: [{ action: "sleep", name: "Rest in sleeping berth" }],
  equipment: [{ action: "tools", name: "Collect repair toolkit" }],
};
export default function Commander() {
  const [saved] = useState(readSave),
    [design, setDesign] = useState<Design>(saved?.design || defaultDesign),
    [life, setLife] = useState<LifeSupport>(saved?.life || defaultLife),
    [mission, setMission] = useState<State | null>(saved?.mission || null),
    [area, setArea] = useState<Area>(),
    [tablet, setTablet] = useState(false),
    [tab, setTab] = useState<TabletTab>("STATUS"),
    [speed, setSpeed] = useState(1),
    [storageError, setStorageError] = useState(""),
    [confirmReset, setConfirmReset] = useState(false);
  const [position, setPosition] = useState<Position>(spawn);
  const [interacting, setInteracting] = useState(false);
  const [effect, setEffect] = useState<VisualAction>();
  const [toast, setToast] = useState(true);
  const closeTablet = useCallback(() => setTablet(false), []);
  const onPosition = useCallback((p: Position) => setPosition(p), []);
  useEffect(() => {
    setInteracting(false);
  }, [area]);
  useEffect(() => {
    setToast(true);
    const id = setTimeout(() => setToast(false), 4500);
    return () => clearTimeout(id);
  }, [mission?.notice, effect?.id]);
  const e = engineering(design, life);
  const onArea = useCallback((a: Area | undefined) => setArea(a), []);
  useEffect(() => {
    if (!mission) return;
    try {
      localStorage.setItem(
        key,
        JSON.stringify({ version: 1, design, life, mission }),
      );
      setStorageError("");
    } catch {
      setStorageError(
        "Browser storage unavailable. This mission will not survive a refresh.",
      );
    }
  }, [mission, design, life]);
  useEffect(() => {
    if (!mission) return;
    const id = window.setInterval(() => {
      if (!document.hidden)
        setMission((s) => (s ? tick(s, design, life, speed) : s));
    }, 1000);
    return () => clearInterval(id);
  }, [!!mission, design, life, speed]);
  useEffect(() => {
    if (!mission) return;
    const hide = () => {
      if (document.hidden) setMission((s) => (s ? { ...s, paused: true } : s));
    };
    document.addEventListener("visibilitychange", hide);
    return () => document.removeEventListener("visibilitychange", hide);
  }, [!!mission]);
  const send = (a: Action) => {
    if (!mission) return;
    const next = act(mission, a, area, design, life);
    setMission(next);
    if (next.log[next.log.length - 1] !== mission.log[mission.log.length - 1])
      setEffect((v) => ({ id: (v?.id || 0) + 1, action: a }));
    setInteracting(false);
  };
  const blockers = [
    e.cost > 300 ? "Over the Commander budget of $300M." : "",
    e.mass > rockets[design.rocket].payload
      ? "Payload exceeds selected rocket capacity."
      : "",
    e.power < 0 ? "Life-support draw exceeds available spacecraft power." : "",
    e.fuel < 10 ? "Need 10 reserve fuel units after transfer." : "",
    !design.counts.spectrometer ? "Install a water spectrometer." : "",
    !design.counts.antenna ? "Install a communications antenna." : "",
  ].filter(Boolean);
  if (!mission)
    return (
      <div className="cmd-builder">
        <div className="eyebrow">ORBITAL / COMMANDER MODE</div>
        <h1>Design for life aboard.</h1>
        <p>
          Configure a crewed training spacecraft, then enter a six-hour
          mission-readiness sortie. This simplified living simulation is
          separate from the robotic Strategy mission.
        </p>
        <section className="cmd-design-summary" aria-live="polite">
          <strong>${e.cost.toFixed(1)}M / $300M</strong>
          <strong>
            {e.mass.toFixed(0)} / {rockets[design.rocket].payload} kg
          </strong>
          <strong>{e.power.toFixed(0)} W spare</strong>
          <strong>{e.capacity} kWh reserve</strong>
          <strong>{e.fuel} fuel reserve</strong>
        </section>
        <h2>Spacecraft hardware</h2>
        <div className="cmd-hardware">
          {components.map((c) => (
            <label key={c.id}>
              {c.name}
              <select
                value={design.counts[c.id] || 0}
                onChange={(ev) =>
                  setDesign((d) => ({
                    ...d,
                    counts: { ...d.counts, [c.id]: Number(ev.target.value) },
                  }))
                }
              >
                {[0, 1, 2].map((n) => (
                  <option key={n} value={n}>
                    {n} installed
                  </option>
                ))}
              </select>
              <small>
                ${c.cost}M · {c.mass} kg · {c.power > 0 ? "+" : ""}
                {c.power} W each
              </small>
            </label>
          ))}
        </div>
        <div className="cmd-hardware">
          <label>
            Launch vehicle
            <select
              value={design.rocket}
              onChange={(ev) =>
                setDesign((d) => ({ ...d, rocket: Number(ev.target.value) }))
              }
            >
              {rockets.map((r, i) => (
                <option key={r.name} value={i}>
                  {r.name} · {r.payload} kg · ${r.cost}M
                </option>
              ))}
            </select>
          </label>
          <label>
            Transfer profile
            <select
              value={design.trajectory}
              onChange={(ev) =>
                setDesign((d) => ({
                  ...d,
                  trajectory: Number(ev.target.value),
                }))
              }
            >
              {trajectories.map((t, i) => (
                <option key={t.name} value={i}>
                  {t.name} · {t.fuel} fuel
                </option>
              ))}
            </select>
          </label>
        </div>
        <h2>Life Support</h2>
        <p>
          All settings below become actual onboard supplies and equipment.
          Endurance estimates use one crew member, three meals, 3 L drinking
          water and 0.84 kg oxygen per day. Recycling requires working equipment
          and power.
        </p>
        <div className="cmd-life-grid">
          {lifeOptions.map((o) => (
            <label className="panel" key={o.key}>
              <strong>{o.name}</strong>
              <span>
                {life[o.key]} {o.unit}
              </span>
              <input
                aria-label={o.name}
                type="range"
                min={o.min}
                max={o.max}
                step={o.step}
                value={life[o.key]}
                onChange={(ev) =>
                  setLife((l) => ({ ...l, [o.key]: Number(ev.target.value) }))
                }
              />
              <small>{o.note}</small>
            </label>
          ))}
        </div>
        <div className="panel">
          <h3>Estimated supported endurance</h3>
          <p>
            Food: {e.foodDays.toFixed(1)} days · water: {e.waterDays.toFixed(1)}{" "}
            days · oxygen: {e.oxygenDays.toFixed(1)} days. These are stores for
            the readiness sortie, not supplies for a full Mars transit. A future
            full-transit mission will require additional provisioning.
          </p>
        </div>
        {!!blockers.length && (
          <div className="alert">
            <ul>
              {blockers.map((b) => (
                <li key={b}>{b}</li>
              ))}
            </ul>
          </div>
        )}
        <button
          className="primary"
          disabled={!!blockers.length}
          onClick={() => {
            setArea(undefined);
            setEffect(undefined);
            setPosition(spawn);
            setMission(newMission(design, life));
          }}
        >
          Launch Commander sortie →
        </button>
      </div>
    );
  const warnings = alerts(mission),
    tasks = objectives(mission),
    nextTask = tasks.find((t) => !t.done);
  const reset = () => {
    setMission(null);
    setEffect(undefined);
    setArea(undefined);
    setPosition(spawn);
    setConfirmReset(false);
    setTablet(false);
    localStorage.removeItem(key);
  };
  return (
    <div
      className={`cmd-session ${mission.sleeping ? "is-sleeping" : ""} ${mission.paused ? "is-paused" : ""}`}
    >
      <div className="cmd-play">
        <div className="cmd-viewport">
          <Cabin
            onArea={onArea}
            onPosition={onPosition}
            onGraphicsError={() =>
              setMission((s) => (s ? { ...s, paused: true } : s))
            }
            onInteract={() => setInteracting((v) => !v)}
            locked={
              mission.paused || mission.sleeping || mission.ended || tablet
            }
            alarm={warnings.length > 0}
            effect={effect}
            telemetry={{
              ...mission,
              oxygenCapacity: life.oxygen,
              batteryCapacity: life.batteries,
            }}
          />
          <div className="cmd-cinema-shade" aria-hidden="true" />
          <div className="cmd-hud-header">
            <div className="cmd-flight-identity">
              <span className="cmd-orbital-emblem">✦</span>
              <div>
                <strong>
                  ORBITAL<span>MISSION LAB</span>
                </strong>
                <small>EXPLORER / COMMANDER</small>
              </div>
            </div>
            <div className="cmd-flight-time">
              <small>MISSION ELAPSED</small>
              <strong>T+ {missionTime(mission.minutes)}</strong>
              <span className={mission.paused ? "paused" : ""}>
                <i />
                {mission.paused ? "PAUSED" : "LIVE"}
              </span>
            </div>
            <div className="cmd-hud-actions">
              <button
                className="cmd-icon-button"
                aria-label={mission.paused ? "Resume mission" : "Pause mission"}
                disabled={mission.ended}
                onClick={() =>
                  setMission((s) => (s ? { ...s, paused: !s.paused } : s))
                }
              >
                <Icon name={mission.paused ? "play" : "pause"} />
              </button>
              <button
                className="cmd-tablet-trigger"
                aria-label={
                  tablet ? "Close mission tablet" : "Open mission tablet"
                }
                aria-expanded={tablet}
                onClick={() => {
                  setTablet((v) => !v);
                  setInteracting(false);
                }}
              >
                <Icon name="tablet" />
                <span>MISSION TABLET</span>
                {warnings.length > 0 && <b>{warnings.length}</b>}
              </button>
            </div>
          </div>
          <div className="cmd-hud-location">
            <span>
              DECK 01 <i />{" "}
              {area ? deck[area].name.toUpperCase() : "CENTRAL PASSAGE"}
            </span>
            <small>
              {nextTask
                ? `NEXT / ${nextTask.name}`
                : "ALL OBJECTIVES COMPLETE / RETURN TO FLIGHT DECK"}
            </small>
          </div>
          {warnings.length > 0 && (
            <button
              className="cmd-warning-chip"
              onClick={() => {
                setTab("STATUS");
                setTablet(true);
              }}
            >
              <Icon name="shield" size={15} />
              {warnings.length} ACTIVE{" "}
              {warnings.length === 1 ? "ADVISORY" : "ADVISORIES"}
              <Icon name="chevron" size={12} />
            </button>
          )}
          <div className="cmd-hud-bottom">
            <div className="cmd-coordinates">
              <small>VEHICLE POSITION</small>
              <span>
                {position.x.toFixed(1)} / {position.z.toFixed(1)} m
              </span>
            </div>
            <label className="cmd-clock-speed">
              SIM RATE
              <select
                aria-label="Simulation clock rate"
                value={speed}
                onChange={(ev) => setSpeed(Number(ev.target.value))}
              >
                <option value={1}>1×</option>
                <option value={5}>5×</option>
              </select>
            </label>
            <div className="cmd-mini-vitals">
              {[
                {
                  label: "O₂",
                  value: mission.oxygen.toFixed(2),
                  unit: "kg",
                  ratio: mission.oxygen / life.oxygen,
                },
                {
                  label: "PWR",
                  value: mission.battery.toFixed(2),
                  unit: "kWh",
                  ratio: mission.battery / life.batteries,
                },
                {
                  label: "CREW",
                  value: mission.energy.toFixed(0),
                  unit: "%",
                  ratio: mission.energy / 100,
                },
              ].map((v) => (
                <div key={v.label} className={v.ratio < 0.2 ? "caution" : ""}>
                  <span>{v.label}</span>
                  <strong>
                    {v.value}
                    <small>{v.unit}</small>
                  </strong>
                  <i>
                    <b style={{ width: `${Math.min(100, v.ratio * 100)}%` }} />
                  </i>
                </div>
              ))}
            </div>
          </div>
          {!mission.ended && !mission.sleeping && area && !tablet && (
            <div className="cmd-interaction-dock">
              {interacting && (
                <div className="cmd-action-menu">
                  <span>{deck[area].name}</span>
                  {stationActions[area].map((a) => (
                    <button
                      disabled={mission.paused}
                      key={a.action}
                      onClick={() => send(a.action)}
                    >
                      {a.name}
                      <Icon name="chevron" size={14} />
                    </button>
                  ))}
                </div>
              )}
              <button
                className="cmd-interaction-prompt"
                disabled={mission.paused}
                onClick={() => setInteracting((v) => !v)}
                aria-expanded={interacting}
              >
                <kbd>E</kbd>
                <span>
                  INTERACT{" "}
                  <strong>
                    {area === "galley"
                      ? "Food storage / water dispenser"
                      : area === "equipment"
                        ? "Repair equipment"
                        : deck[area].name}
                  </strong>
                </span>
                <Icon name="chevron" size={15} />
              </button>
            </div>
          )}
          {toast && !tablet && (
            <div className="cmd-toast" role="status" key={effect?.id}>
              <i />
              {mission.notice}
            </div>
          )}
          <div className="cmd-rest-transition" aria-hidden="true" />
          {mission.sleeping && (
            <div className="cmd-rest-card">
              <Icon name="sleep" size={30} />
              <small>CREW QUARTERS / REST CYCLE</small>
              <h2>Rest & recover.</h2>
              <p>
                Energy {mission.energy.toFixed(0)}% · life support remains
                active
              </p>
              <button onClick={() => send("wake")} disabled={mission.paused}>
                End rest cycle <Icon name="chevron" size={16} />
              </button>
            </div>
          )}
          {mission.paused && !mission.ended && !tablet && (
            <div className="cmd-paused-indicator">
              <Icon name="pause" size={14} /> MISSION PAUSED{" "}
              <button
                onClick={() =>
                  setMission((s) => (s ? { ...s, paused: false } : s))
                }
              >
                Resume
              </button>
            </div>
          )}
          {mission.ended && (
            <div className="cmd-complete">
              <span
                className={`cmd-state ${mission.notice.includes("Safety abort") ? "critical" : "normal"}`}
              >
                SORTIE DEBRIEF
              </span>
              <h2>{mission.notice}</h2>
              <div className="cmd-debrief-numbers">
                <span>
                  {missionTime(mission.minutes)}
                  <small>ELAPSED</small>
                </span>
                <span>
                  {mission.science}
                  <small>SCIENCE</small>
                </span>
                <span>
                  {mission.energy.toFixed(0)}%<small>CREW ENERGY</small>
                </span>
              </div>
              <button onClick={reset}>
                Return to spacecraft design <Icon name="chevron" />
              </button>
              <button
                onClick={() => {
                  setTab("LOG");
                  setTablet(true);
                }}
              >
                Review mission record
              </button>
            </div>
          )}
        </div>
      </div>
      {tablet && (
        <MissionTablet
          s={mission}
          life={life}
          design={design}
          area={area}
          position={position}
          tab={tab}
          onTab={setTab}
          onClose={closeTablet}
          send={send}
          storageError={storageError}
          confirmReset={confirmReset}
          onConfirm={setConfirmReset}
          onReset={reset}
        />
      )}
    </div>
  );
}
