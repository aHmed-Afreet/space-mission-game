import { useCallback, useEffect, useState } from "react";
import { components, rockets, trajectories, type Design } from "../game";
import Cabin from "./Cabin";
import {
  act,
  alerts,
  areas,
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
const time = (minutes: number) =>
  `${Math.floor(minutes / 1440)}d ${String(Math.floor(minutes / 60) % 24).padStart(2, "0")}:${String(Math.floor(minutes % 60)).padStart(2, "0")}`;
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
    [tablet, setTablet] = useState(true),
    [tab, setTab] = useState("Systems"),
    [speed, setSpeed] = useState(1),
    [storageError, setStorageError] = useState(""),
    [confirmReset, setConfirmReset] = useState(false);
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
  const send = (a: Action) =>
    setMission((s) => (s ? act(s, a, area, design, life) : s));
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
          onClick={() => setMission(newMission(design, life))}
        >
          Launch Commander sortie →
        </button>
      </div>
    );
  const warnings = alerts(mission);
  const objectives = [
    { name: "Verify course in cockpit", done: mission.course },
    { name: "Collect 30 science points", done: mission.science >= 30 },
    { name: "Transmit science to Earth", done: mission.sent },
    { name: "Rest in the sleeping berth", done: mission.rested },
    { name: "Operate for six mission hours", done: mission.minutes >= 360 },
    {
      name: "Restore power and communications",
      done: !mission.malfunction && mission.communications,
    },
  ];
  return (
    <div
      className={"cmd-session " + (tablet ? "tablet-open" : "tablet-closed")}
    >
      <div className="cmd-flight-bar">
        <div>
          <span className="eyebrow">COMMANDER / LIVE CABIN</span>
          <strong>T+ {time(mission.minutes)}</strong>
        </div>
        <button
          className="secondary"
          onClick={() =>
            setMission((s) => (s ? { ...s, paused: !s.paused } : s))
          }
          disabled={mission.ended}
        >
          {mission.paused ? "Resume mission" : "Pause"}
        </button>
        <label>
          Clock
          <select
            value={speed}
            onChange={(ev) => setSpeed(Number(ev.target.value))}
          >
            <option value={1}>1 s = 1 min</option>
            <option value={5}>1 s = 5 min</option>
          </select>
        </label>
        <button
          className="secondary"
          aria-expanded={tablet}
          onClick={() => setTablet((t) => !t)}
        >
          {tablet ? "Close tablet" : "Mission tablet"}
          {warnings.length ? ` · ${warnings.length} alerts` : ""}
        </button>
      </div>
      <div className="cmd-play">
        <div className="cmd-viewport">
          <Cabin
            onArea={onArea}
            locked={mission.paused || mission.sleeping || mission.ended}
          />
          <div className="cmd-location">
            {area ? areas.find((a) => a.id === area)?.name : "Central passage"}
            <small>
              {mission.sleeping
                ? "Resting · wake to move"
                : mission.paused
                  ? "PAUSED · resume to continue"
                  : "Walk close to a station to access its controls"}
            </small>
          </div>
          <div className="cmd-interact">
            <p role="status">{mission.notice}</p>
            {mission.sleeping ? (
              <button
                className="primary"
                disabled={mission.paused}
                onClick={() => send("wake")}
              >
                Wake up
              </button>
            ) : (
              !mission.ended &&
              area &&
              stationActions[area].map((a) => (
                <button
                  key={a.action}
                  disabled={mission.paused}
                  className="secondary"
                  onClick={() => send(a.action)}
                >
                  {a.name}
                </button>
              ))
            )}
          </div>
          {mission.ended && (
            <div className="cmd-complete">
              <h2>{mission.notice}</h2>
              <p>
                Elapsed {time(mission.minutes)} · science {mission.science} ·
                energy {mission.energy.toFixed(0)}%
              </p>
              <button
                className="primary"
                onClick={() => {
                  setMission(null);
                  localStorage.removeItem(key);
                }}
              >
                Return to spacecraft design
              </button>
            </div>
          )}
        </div>
        {tablet && (
          <aside className="cmd-tablet" aria-label="Commander mission tablet">
            <div className="cmd-tablet-head">
              <strong>MISSION TABLET</strong>
              <span>MX / 01</span>
            </div>
            <div className="cmd-tabs">
              {["Systems", "Inventory", "Objectives", "Map", "Log"].map((t) => (
                <button
                  aria-pressed={tab === t}
                  className={tab === t ? "chosen" : ""}
                  onClick={() => setTab(t)}
                  key={t}
                >
                  {t}
                </button>
              ))}
            </div>
            {storageError && (
              <p className="cmd-alert" role="alert">
                {storageError}
              </p>
            )}
            {tab === "Systems" && (
              <>
                <div className="cmd-readouts">
                  {[
                    [
                      "Food supply",
                      `${mission.food} stored + ${mission.meals} carried meals`,
                    ],
                    [
                      "Water supply",
                      `${mission.water.toFixed(2)} L tank · ${mission.bottle.toFixed(2)} L bottle`,
                    ],
                    ["Oxygen", `${mission.oxygen.toFixed(3)} kg`],
                    [
                      "Spacecraft power",
                      `${mission.battery.toFixed(2)} / ${life.batteries} kWh · ${e.power - (mission.malfunction ? 90 : 0)} W net`,
                    ],
                    ["Fuel", `${mission.fuel} units`],
                    ["Crew energy", `${mission.energy.toFixed(0)}%`],
                    [
                      "Nutrition / hydration",
                      `${mission.nutrition.toFixed(0)}% / ${mission.hydration.toFixed(0)}%`,
                    ],
                    [
                      "Rest / sleep",
                      `${mission.sleeping ? "Sleeping" : "Awake"} · ${Math.floor(mission.sleepDebt / 60)} h duty load`,
                    ],
                    ["Cabin pressure", `${mission.pressure.toFixed(1)} kPa`],
                    [
                      "Cabin temperature",
                      `${mission.temperature.toFixed(1)} °C`,
                    ],
                    [
                      "Radiation / environment",
                      `${mission.radiation} exposure index · ECS level ${life.environment}`,
                    ],
                    [
                      "Communications",
                      mission.communications ? "LINK ONLINE" : "LINK LOST",
                    ],
                    [
                      "Science progress",
                      `${mission.science} points · ${mission.sent ? "data transmitted" : "awaiting downlink"}`,
                    ],
                    ["Mission time", time(mission.minutes)],
                  ].map(([label, value]) => (
                    <div key={label}>
                      <span>{label}</span>
                      <strong>{value}</strong>
                    </div>
                  ))}
                </div>
                <h3>Warnings / alerts</h3>
                <div aria-live="polite">
                  {warnings.length ? (
                    warnings.map((w) => (
                      <p className="cmd-alert" key={w}>
                        {w}
                      </p>
                    ))
                  ) : (
                    <p className="cmd-ok">All monitored systems nominal.</p>
                  )}
                </div>
              </>
            )}
            {tab === "Inventory" && (
              <>
                <h3>Personal inventory</h3>
                <p>
                  Meals: {mission.meals} · Bottle: {mission.bottle.toFixed(2)} /
                  1 L
                </p>
                <button
                  disabled={
                    mission.paused ||
                    mission.sleeping ||
                    !mission.meals ||
                    mission.ended
                  }
                  onClick={() => send("eat")}
                >
                  Eat carried meal
                </button>
                <button
                  disabled={
                    mission.paused ||
                    mission.sleeping ||
                    mission.bottle <= 0 ||
                    mission.ended
                  }
                  onClick={() => send("drink")}
                >
                  Drink 250 mL from bottle
                </button>
                <h3>Tools & repair parts</h3>
                <p>
                  Toolkit: {mission.tools ? "carried" : "in equipment storage"}
                  <br />
                  Spare parts: {mission.parts}
                </p>
                <h3>Installed life support</h3>
                {lifeOptions.map((o) => (
                  <p key={o.key}>
                    {o.name}: {life[o.key]} {o.unit}
                  </p>
                ))}
              </>
            )}
            {tab === "Objectives" && (
              <>
                <h3>Mission readiness</h3>
                {objectives.map((o) => (
                  <p className={o.done ? "cmd-ok" : ""} key={o.name}>
                    {o.done ? "✓" : "○"} {o.name}
                  </p>
                ))}
                <p>
                  Finish the sortie at the cockpit when all objectives are
                  complete. Eat and drink from carried supplies in the Inventory
                  tab.
                </p>
                <h3>Future operations</h3>
                <p>
                  EVA, Mars exploration, sample collection, docking and extended
                  emergencies are reserved for later mission modules.
                </p>
              </>
            )}
            {tab === "Map" && (
              <>
                <h3>Spacecraft deck map</h3>
                <div className="cmd-map">
                  <div className={area === "cockpit" ? "here" : ""}>
                    Cockpit
                  </div>
                  <div className="cmd-map-row">
                    <span className={area === "science" ? "here" : ""}>
                      Science
                    </span>
                    <span className={area === "communications" ? "here" : ""}>
                      Comms
                    </span>
                  </div>
                  <p>│ Central passage │</p>
                  <div className="cmd-map-row">
                    <span className={area === "power" ? "here" : ""}>
                      Power
                    </span>
                    <span className={area === "galley" ? "here" : ""}>
                      Food & water
                    </span>
                  </div>
                  <p>│ Central passage │</p>
                  <div className="cmd-map-row">
                    <span className={area === "sleep" ? "here" : ""}>
                      Sleep
                    </span>
                    <span className={area === "equipment" ? "here" : ""}>
                      Equipment
                    </span>
                  </div>
                  <p>Entry / aft</p>
                </div>
                <p>
                  Walk along the central aisle and approach a console. Highlight
                  shows your current interaction zone. Map entries do not
                  teleport you.
                </p>
              </>
            )}
            {tab === "Log" && (
              <>
                <h3>Mission record</h3>
                {[...mission.log].reverse().map((line, i) => (
                  <p key={i}>{line}</p>
                ))}
              </>
            )}
            <div className="cmd-tablet-bottom">
              <small>
                Saved on this device. Hidden tabs pause the mission; resume on
                return.
              </small>
              <button onClick={() => setConfirmReset(true)}>
                End sortie / return to design
              </button>
              {confirmReset && (
                <div>
                  <p>Discard this sortie and return to design?</p>
                  <button
                    onClick={() => {
                      setMission(null);
                      setConfirmReset(false);
                      localStorage.removeItem(key);
                    }}
                  >
                    Discard sortie
                  </button>
                  <button onClick={() => setConfirmReset(false)}>
                    Keep playing
                  </button>
                </div>
              )}
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}
