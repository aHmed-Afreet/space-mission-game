import { useEffect, useRef } from "react";
import Icon, { type IconName } from "./Icons";
import { deck, type Position } from "./layout";
import {
  alerts,
  engineering,
  lifeOptions,
  type State,
  type LifeSupport,
  type Area,
  type Action,
} from "./simulation";
import { components, type Design } from "../game";
export type TabletTab =
  "STATUS" | "INVENTORY" | "OBJECTIVES" | "MAP" | "SYSTEMS" | "LOG";
const tabs: { name: TabletTab; icon: IconName }[] = [
  { name: "STATUS", icon: "crew" },
  { name: "INVENTORY", icon: "box" },
  { name: "OBJECTIVES", icon: "target" },
  { name: "MAP", icon: "map" },
  { name: "SYSTEMS", icon: "power" },
  { name: "LOG", icon: "log" },
];
export const missionTime = (minutes: number) =>
  `${Math.floor(minutes / 1440)}d ${String(Math.floor(minutes / 60) % 24).padStart(2, "0")}:${String(Math.floor(minutes % 60)).padStart(2, "0")}`;
export function objectives(
  s: State,
): { name: string; done: boolean; area: Area; detail: string }[] {
  return [
    {
      name: "Verify flight trajectory",
      done: s.course,
      area: "cockpit",
      detail: "Flight deck · 2 fuel units",
    },
    {
      name: "Collect water-search observations",
      done: s.science >= 30,
      area: "science",
      detail: `Science laboratory · ${s.science}/30 points`,
    },
    {
      name: "Transmit observations to Earth",
      done: s.sent,
      area: "communications",
      detail: "Communications · downlink science data",
    },
    {
      name: "Complete a crew rest period",
      done: s.rested,
      area: "sleep",
      detail: "Crew quarters · rest then wake",
    },
    {
      name: "Operate for six mission hours",
      done: s.minutes >= 360,
      area: "cockpit",
      detail: `Mission clock · ${Math.floor(s.minutes)}/360 minutes`,
    },
    {
      name: "Restore spacecraft readiness",
      done: !s.malfunction && s.communications,
      area: s.malfunction ? "power" : "communications",
      detail: "Resolve power faults and restore the downlink",
    },
  ];
}
export function DeckMap({
  position,
  area,
  target,
}: {
  position: Position;
  area?: Area;
  target?: Area;
}) {
  const x = (v: number) => 160 + v * 29,
    z = (v: number) => 30 + (v + 7.8) * 22;
  return (
    <svg
      className="cmd-deck"
      viewBox="0 0 320 430"
      role="img"
      aria-label={`Spacecraft deck schematic. Player at x ${position.x.toFixed(1)}, z ${position.z.toFixed(1)}. Current area ${area ? deck[area].name : "central passage"}.`}
    >
      <defs>
        <pattern
          id="deck-grid"
          width="16"
          height="16"
          patternUnits="userSpaceOnUse"
        >
          <path
            d="M16 0H0V16"
            fill="none"
            stroke="#809ba5"
            strokeOpacity=".07"
          />
        </pattern>
      </defs>
      <rect width="320" height="430" fill="url(#deck-grid)" />
      <path
        d="M110 18h100l46 38v312l-30 35H94l-30-35V56z"
        className="cmd-deck-hull"
      />
      <path d="M143 80h34v286h-34z" className="cmd-deck-aisle" />
      {[-4.35, -1.35, 2.35].map((v) => (
        <path
          d={`M68 ${z(v)}h65m54 0h65`}
          key={v}
          className="cmd-deck-bulkhead"
        />
      ))}
      {(Object.keys(deck) as Area[]).map((id) => {
        const a = deck[id],
          cx = x(a.x),
          cy = z(a.z);
        return (
          <g
            key={id}
            className={`${id === area ? "current" : ""} ${id === target ? "objective" : ""}`}
          >
            <rect
              className="cmd-deck-room"
              x={cx - (id === "cockpit" ? 48 : 30)}
              y={cy - 18}
              width={id === "cockpit" ? 96 : 60}
              height={id === "sleep" ? 48 : 38}
              rx="5"
            />
            <text x={cx} y={cy - 1} textAnchor="middle">
              {id === "communications"
                ? "COMMS"
                : id === "equipment"
                  ? "EQUIP"
                  : id === "sleep"
                    ? "BERTH"
                    : id === "cockpit"
                      ? "FLIGHT"
                      : id === "power"
                        ? "ECLSS"
                        : id.toUpperCase()}
            </text>
            <text
              className="cmd-deck-code"
              x={cx}
              y={cy + 11}
              textAnchor="middle"
            >
              {a.code}
              {id === target ? " / TARGET" : ""}
            </text>
          </g>
        );
      })}
      <g
        transform={`translate(${x(position.x)} ${z(position.z)}) rotate(${(-position.heading * 180) / Math.PI})`}
      >
        <circle r="11" fill="#99ddd1" fillOpacity=".1" />
        <path d="M0-8L5 6 0 3-5 6z" fill="#b9f2e6" stroke="#0e292c" />
      </g>
      <text x="160" y="417" textAnchor="middle" className="cmd-deck-code">
        DECK 01 / EXPLORATION VEHICLE
      </text>
    </svg>
  );
}
function Metric({
  name,
  value,
  unit,
  ratio,
  tone = "normal",
  icon,
}: {
  name: string;
  value: string;
  unit: string;
  ratio: number;
  tone?: string;
  icon: IconName;
}) {
  return (
    <div className={`cmd-metric ${tone}`}>
      <div>
        <Icon name={icon} size={17} />
        <span>{name}</span>
        <i />
      </div>
      <strong>
        {value}
        <small>{unit}</small>
      </strong>
      <div
        className="cmd-gauge"
        role="meter"
        aria-label={name}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(Math.max(0, Math.min(100, ratio * 100)))}
      >
        <span
          style={{ width: `${Math.max(0, Math.min(100, ratio * 100))}%` }}
        />
      </div>
      <span className="cmd-metric-state">
        {tone === "critical"
          ? "CRITICAL"
          : tone === "caution"
            ? "CAUTION"
            : "NOMINAL"}
      </span>
    </div>
  );
}
const level = (n: number, critical: number, caution: number) =>
  n <= critical ? "critical" : n < caution ? "caution" : "normal";
type Props = {
  s: State;
  life: LifeSupport;
  design: Design;
  area?: Area;
  position: Position;
  tab: TabletTab;
  onTab: (t: TabletTab) => void;
  onClose: () => void;
  send: (a: Action) => void;
  storageError: string;
  confirmReset: boolean;
  onConfirm: (value: boolean) => void;
  onReset: () => void;
};
export default function MissionTablet({
  s,
  life,
  design,
  area,
  position,
  tab,
  onTab,
  onClose,
  send,
  storageError,
  confirmReset,
  onConfirm,
  onReset,
}: Props) {
  const e = engineering(design, life),
    warnings = alerts(s),
    tasks = objectives(s),
    target = tasks.find((o) => !o.done)?.area;
  const close = useRef<HTMLButtonElement>(null),
    dialog = useRef<HTMLElement>(null);
  useEffect(() => {
    const prev = document.activeElement as HTMLElement;
    close.current?.focus();
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
      if (event.key === "Tab") {
        const focusable = dialog.current?.querySelectorAll<HTMLElement>(
          "button:not(:disabled),select,a,input",
        );
        if (!focusable?.length) return;
        const first = focusable[0],
          last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener("keydown", key);
    return () => {
      window.removeEventListener("keydown", key);
      prev?.focus();
    };
  }, [onClose]);
  const disabled = s.paused || s.sleeping || s.ended;
  return (
    <div className="cmd-tablet-layer">
      <button
        className="cmd-tablet-scrim"
        aria-label="Close mission tablet"
        onClick={onClose}
      />
      <section
        ref={dialog}
        role="dialog"
        aria-modal="true"
        aria-label="Commander mission tablet"
        className="cmd-tablet"
      >
        <div className="cmd-tablet-head">
          <span className="cmd-device-mark">
            <Icon name="tablet" />
          </span>
          <div>
            <small>ORBITAL / PERSONAL TERMINAL</small>
            <strong>
              Mission Tablet <span>01</span>
            </strong>
          </div>
          <button
            className="cmd-icon-button"
            aria-label="Close tablet"
            ref={close}
            onClick={onClose}
          >
            <Icon name="close" />
          </button>
        </div>
        <div className="cmd-tablet-telemetry">
          <span>
            <i /> {s.paused ? "MISSION PAUSED" : "TELEMETRY LIVE"}
          </span>
          <span>T+ {missionTime(s.minutes)}</span>
        </div>
        <div className="cmd-tabs" role="tablist" aria-label="Tablet sections">
          {tabs.map((t) => (
            <button
              key={t.name}
              role="tab"
              aria-selected={tab === t.name}
              aria-controls="cmd-tab-content"
              id={`tab-${t.name}`}
              onClick={() => onTab(t.name)}
            >
              <Icon name={t.icon} size={17} />
              <span>{t.name}</span>
            </button>
          ))}
        </div>
        <div
          className="cmd-tablet-content"
          id="cmd-tab-content"
          role="tabpanel"
          aria-labelledby={`tab-${tab}`}
        >
          {storageError && (
            <div className="cmd-alert critical" role="alert">
              {storageError}
            </div>
          )}
          {tab === "STATUS" && (
            <>
              <div className="cmd-section-heading">
                <div>
                  <small>VEHICLE & CREW</small>
                  <h2>Mission overview</h2>
                </div>
                <span
                  className={`cmd-state ${warnings.length ? "caution" : "normal"}`}
                >
                  {warnings.length
                    ? `${warnings.length} CAUTIONS`
                    : "ALL SYSTEMS GO"}
                </span>
              </div>
              <div className="cmd-metrics">
                <Metric
                  name="Oxygen"
                  value={s.oxygen.toFixed(2)}
                  unit="kg"
                  ratio={s.oxygen / life.oxygen}
                  tone={level(s.oxygen, 0.1, 0.3)}
                  icon="oxygen"
                />
                <Metric
                  name="Food supply"
                  value={String(s.food + s.meals)}
                  unit="meals"
                  ratio={(s.food + s.meals) / life.food}
                  tone={level(s.food + s.meals, 0, 3)}
                  icon="food"
                />
                <Metric
                  name="Water reserve"
                  value={(s.water + s.bottle).toFixed(1)}
                  unit="L"
                  ratio={(s.water + s.bottle) / life.water}
                  tone={level(s.water + s.bottle, 0.25, 2)}
                  icon="water"
                />
                <Metric
                  name="Battery"
                  value={s.battery.toFixed(2)}
                  unit="kWh"
                  ratio={s.battery / life.batteries}
                  tone={level(s.battery, 0.05, 0.2)}
                  icon="power"
                />
                <Metric
                  name="Solar generation"
                  value={String((design.counts.solar || 0) * 85)}
                  unit="W"
                  ratio={(design.counts.solar || 0) / 2}
                  icon="sun"
                />
                <Metric
                  name="Fuel"
                  value={String(s.fuel)}
                  unit="units"
                  ratio={s.fuel / 100}
                  tone={level(s.fuel, 2, 10)}
                  icon="fuel"
                />
                <Metric
                  name="Crew energy"
                  value={s.energy.toFixed(0)}
                  unit="%"
                  ratio={s.energy / 100}
                  tone={level(s.energy, 10, 30)}
                  icon="crew"
                />
                <Metric
                  name="Hydration"
                  value={s.hydration.toFixed(0)}
                  unit="%"
                  ratio={s.hydration / 100}
                  tone={level(s.hydration, 10, 30)}
                  icon="water"
                />
                <Metric
                  name="Nutrition"
                  value={s.nutrition.toFixed(0)}
                  unit="%"
                  ratio={s.nutrition / 100}
                  tone={level(s.nutrition, 10, 30)}
                  icon="food"
                />
                <Metric
                  name="Cabin pressure"
                  value={s.pressure.toFixed(1)}
                  unit="kPa"
                  ratio={s.pressure / 101.3}
                  tone={level(s.pressure, 70, 90)}
                  icon="pressure"
                />
                <Metric
                  name="Temperature"
                  value={s.temperature.toFixed(1)}
                  unit="°C"
                  ratio={s.temperature / 40}
                  tone={
                    s.temperature > 32
                      ? "critical"
                      : s.temperature > 27
                        ? "caution"
                        : "normal"
                  }
                  icon="temperature"
                />
                <Metric
                  name="Radiation"
                  value={String(s.radiation)}
                  unit="index"
                  ratio={1 - s.radiation / 10}
                  tone={
                    s.radiation > 5
                      ? "caution"
                      : s.radiation > 0
                        ? "caution"
                        : "normal"
                  }
                  icon="shield"
                />
              </div>
              <div
                className={`cmd-link-card ${s.communications ? "normal" : "critical"}`}
              >
                <Icon name="comms" />
                <div>
                  <strong>Deep-space communications</strong>
                  <small>
                    {s.communications
                      ? "LINK ESTABLISHED / DOWNLINK AVAILABLE"
                      : "SIGNAL LOST / CALIBRATION REQUIRED"}
                  </small>
                </div>
                <i />
              </div>
              <div className="cmd-section-heading">
                <h3>Advisories</h3>
                <span>{warnings.length.toString().padStart(2, "0")}</span>
              </div>
              {warnings.length ? (
                warnings.map((w) => (
                  <div className="cmd-alert caution" key={w}>
                    <Icon name="shield" size={16} />
                    <span>{w}</span>
                  </div>
                ))
              ) : (
                <div className="cmd-alert normal">
                  <Icon name="check" size={16} /> No active spacecraft warnings.
                </div>
              )}
            </>
          )}
          {tab === "INVENTORY" && (
            <>
              <div className="cmd-section-heading">
                <div>
                  <small>ONBOARD MANIFEST</small>
                  <h2>Supplies & equipment</h2>
                </div>
                <Icon name="box" />
              </div>
              <div className="cmd-inventory-grid">
                {[
                  {
                    icon: "food" as IconName,
                    name: "Meal packs",
                    value: `${s.meals} carried`,
                    sub: `${s.food} in galley storage`,
                    action: "eat" as Action,
                    label: "Eat meal",
                    off: !s.meals,
                  },
                  {
                    icon: "water" as IconName,
                    name: "Water bottle",
                    value: `${s.bottle.toFixed(2)} L`,
                    sub: "1 L personal bottle",
                    action: "drink" as Action,
                    label: "Drink · 250 mL",
                    off: s.bottle <= 0,
                  },
                  {
                    icon: "tool" as IconName,
                    name: "Repair toolkit",
                    value: s.tools ? "Equipped" : "In storage",
                    sub: "Collect from equipment bay",
                  },
                  {
                    icon: "box" as IconName,
                    name: "Spare parts",
                    value: `${s.parts} available`,
                    sub: "One part per power repair",
                  },
                  {
                    icon: "science" as IconName,
                    name: "Science samples",
                    value: "Remote observations",
                    sub: `${s.science} science points · no physical samples`,
                  },
                  {
                    icon: "power" as IconName,
                    name: "Repair equipment",
                    value: s.malfunction ? "Service required" : "Standby",
                    sub: s.tools
                      ? "Toolkit ready for repair"
                      : "Toolkit required to repair",
                  },
                ].map((item) => (
                  <article className="cmd-inventory-card" key={item.name}>
                    <div className={`cmd-item-art item-${item.icon}`}>
                      <Icon name={item.icon} size={46} />
                      <span>
                        {item.icon === "water"
                          ? `${Math.round(s.bottle * 100)}%`
                          : item.icon === "food"
                            ? `×${s.meals}`
                            : item.icon === "box"
                              ? `×${s.parts}`
                              : "01"}
                      </span>
                    </div>
                    <h3>{item.name}</h3>
                    <strong>{item.value}</strong>
                    <small>{item.sub}</small>
                    {item.action && (
                      <button
                        disabled={disabled || item.off}
                        onClick={() => send(item.action!)}
                      >
                        {item.label}
                        <Icon name="chevron" size={14} />
                      </button>
                    )}
                  </article>
                ))}
              </div>
              <p className="cmd-footnote">
                Collect food and refill water at the galley. Carried supplies
                are available everywhere aboard.
              </p>
            </>
          )}
          {tab === "OBJECTIVES" && (
            <>
              <div className="cmd-section-heading">
                <div>
                  <small>SORTIE / 06 HOURS</small>
                  <h2>Mission readiness</h2>
                </div>
                <strong>
                  {tasks.filter((o) => o.done).length}
                  <small> / 06</small>
                </strong>
              </div>
              <div className="cmd-objective-progress">
                <span
                  style={{
                    width: `${(tasks.filter((o) => o.done).length / 6) * 100}%`,
                  }}
                />
              </div>
              <ol className="cmd-objectives">
                {tasks.map((o, i) => (
                  <li
                    key={o.name}
                    className={
                      o.done
                        ? "complete"
                        : o === tasks.find((v) => !v.done)
                          ? "active"
                          : ""
                    }
                  >
                    <span>
                      {o.done ? (
                        <Icon name="check" size={17} />
                      ) : (
                        String(i + 1).padStart(2, "0")
                      )}
                    </span>
                    <div>
                      <strong>{o.name}</strong>
                      <small>{o.detail}</small>
                    </div>
                  </li>
                ))}
              </ol>
              <div className="cmd-brief-note">
                <Icon name="target" />
                <p>
                  Return to the flight deck to complete the sortie once every
                  objective is satisfied.
                </p>
              </div>
              <p className="cmd-footnote">
                Future operations: EVA, surface exploration, sample collection
                and docking.
              </p>
            </>
          )}
          {tab === "MAP" && (
            <>
              <div className="cmd-section-heading">
                <div>
                  <small>EXPLORATION VEHICLE / DECK 01</small>
                  <h2>Cabin schematic</h2>
                </div>
                <Icon name="map" />
              </div>
              <DeckMap position={position} area={area} target={target} />
              <div className="cmd-map-key">
                <span>
                  <i /> YOU
                </span>
                <span>
                  <i /> OBJECTIVE
                </span>
                <span>
                  <i /> CURRENT ZONE
                </span>
              </div>
              <div className="cmd-brief-note">
                <Icon name="target" />
                <p>
                  {target
                    ? `Next: ${deck[target].name}`
                    : "Readiness objectives complete. Return to flight deck."}
                  <br />
                  <small>Live position · continuous walkable deck</small>
                </p>
              </div>
            </>
          )}
          {tab === "SYSTEMS" && (
            <>
              <div className="cmd-section-heading">
                <div>
                  <small>ENGINEERING / CONFIGURATION</small>
                  <h2>Installed systems</h2>
                </div>
                <span
                  className={`cmd-state ${s.malfunction ? "critical" : "normal"}`}
                >
                  {s.malfunction ? "FAULT ACTIVE" : "ONLINE"}
                </span>
              </div>
              <div className="cmd-power-flow">
                <div>
                  <Icon name="sun" />
                  <strong>{(design.counts.solar || 0) * 85} W</strong>
                  <small>SOLAR OUTPUT</small>
                </div>
                <span>→</span>
                <div>
                  <Icon name="power" />
                  <strong>{s.battery.toFixed(2)} kWh</strong>
                  <small>BATTERY RESERVE</small>
                </div>
                <span>→</span>
                <div>
                  <Icon name="crew" />
                  <strong>{e.power - (s.malfunction ? 90 : 0)} W</strong>
                  <small>NET MARGIN</small>
                </div>
              </div>
              <h3 className="cmd-subheading">Life support</h3>
              <div className="cmd-system-list">
                {lifeOptions.map((o) => (
                  <div key={o.key}>
                    <span>{o.name}</span>
                    <strong>
                      {life[o.key]} <small>{o.unit}</small>
                    </strong>
                  </div>
                ))}
              </div>
              <h3 className="cmd-subheading">Mission hardware</h3>
              <div className="cmd-system-list">
                {components
                  .filter((c) => design.counts[c.id])
                  .map((c) => (
                    <div key={c.id}>
                      <span>{c.name}</span>
                      <strong>× {design.counts[c.id]}</strong>
                    </div>
                  ))}
              </div>
              <div className="cmd-brief-note">
                <Icon name="sleep" />
                <p>
                  {s.sleeping ? "Rest in progress" : "Crew awake"} · duty load{" "}
                  {Math.floor(s.sleepDebt / 60)}h {Math.floor(s.sleepDebt % 60)}
                  m<br />
                  <small>
                    Resting restores energy. Crew care affects readiness.
                  </small>
                </p>
              </div>
              <div className="cmd-link-card normal">
                <Icon name="science" />
                <div>
                  <strong>{s.science} science points</strong>
                  <small>
                    {s.sent ? "TRANSMITTED TO EARTH" : "AWAITING DOWNLINK"}
                  </small>
                </div>
              </div>
              <p className="cmd-footnote">
                Food endurance {e.foodDays.toFixed(1)}d · water{" "}
                {e.waterDays.toFixed(1)}d · oxygen {e.oxygenDays.toFixed(1)}d.
                Estimates assume working, powered recyclers.
              </p>
            </>
          )}
          {tab === "LOG" && (
            <>
              <div className="cmd-section-heading">
                <div>
                  <small>FLIGHT RECORDER</small>
                  <h2>Mission activity</h2>
                </div>
                <span>{s.log.length} RECORDS</span>
              </div>
              <div className="cmd-log">
                {[...s.log].reverse().map((line, i) => (
                  <article key={i}>
                    <i />
                    <small>
                      {String(s.log.length - i).padStart(3, "0")} / MISSION
                      EVENT
                    </small>
                    <p>{line}</p>
                  </article>
                ))}
              </div>
            </>
          )}
        </div>
        <div className="cmd-tablet-bottom">
          <span>
            <i /> {storageError ? "SAVE UNAVAILABLE" : "LOCAL AUTOSAVE"}
          </span>
          <button onClick={() => onConfirm(true)}>
            End sortie <Icon name="chevron" size={13} />
          </button>
          {confirmReset && (
            <div className="cmd-confirm">
              <strong>Return to spacecraft design?</strong>
              <p>This discards the current sortie.</p>
              <button onClick={onReset}>Discard sortie</button>
              <button onClick={() => onConfirm(false)}>Keep playing</button>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
