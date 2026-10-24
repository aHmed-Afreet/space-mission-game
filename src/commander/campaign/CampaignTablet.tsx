import SoundSettings from "./SoundSettings";
import { shipAlerts } from "./ship";
import { money } from "./economy";
import { useEffect, useRef, useState } from "react";
import Icon, { type IconName } from "../Icons";
import { missionTime } from "../MissionTablet";
import { NavigationContent } from "./NavigationMap";
import { objectiveGuide } from "./objectiveGuide";
import { campaignForMission, campaignLevel } from "./campaignTypes";
import { recoveryMission } from "./recovery";

import { lifeOptions, alerts } from "../simulation";
import { components } from "../../game";
import {
  atSite,
  currentObjective,
  currentPhase,
  sitePosition,
  outside,
  engineeringCampaign,
  type Session,
  type Progress,
} from "./engine";
import { missions, missionById, type CampaignAction } from "./definitions";
import { environments } from "./environments";
import { equipment, packMass, PACK_CAPACITY } from "./equipment";
export type CampaignTab = "MISSION" | "STATUS" | "INVENTORY" | "MAP" | "LOG";
const tabs: { id: CampaignTab; icon: IconName }[] = [
  { id: "MISSION", icon: "target" },
  { id: "STATUS", icon: "crew" },
  { id: "INVENTORY", icon: "box" },
  { id: "MAP", icon: "map" },
  { id: "LOG", icon: "log" },
];
function Gauge({
  name,
  value,
  ratio,
  warning = 0.2,
}: {
  name: string;
  value: string;
  ratio: number;
  warning?: number;
}) {
  const tone =
    ratio <= 0.05 ? "critical" : ratio < warning ? "caution" : "normal";
  return (
    <article className={"campaign-simple-state " + tone}>
      <div>
        <span>{name}</span>
        <strong>
          {tone === "normal"
            ? "GOOD"
            : tone === "caution"
              ? "WARNING"
              : "CRITICAL"}
        </strong>
      </div>
      <p>{value}</p>
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
    </article>
  );
}
export default function CampaignTablet({
  s,
  progress,
  tab,
  onTab,
  onClose,
  onCommand,
  onHome,
  onResetTutorials,
  saveError,
  onOptional,
  onAbort,
}: {
  onOptional: (id: string) => void;
  onAbort: () => void;
  s: Session;
  progress: Progress;
  tab: CampaignTab;
  onTab: (t: CampaignTab) => void;
  onClose: () => void;
  onCommand: (a: CampaignAction) => void;
  onHome: () => void;
  onResetTutorials: () => void;
  saveError: string;
}) {
  const m = missionById(s.missionId),
    o = currentObjective(s),
    guide = objectiveGuide(s),
    recovery = recoveryMission(s),
    env = environments[m.destination],
    state = s.state,
    [details, setDetails] = useState(false);
  const close = useRef<HTMLButtonElement>(null),
    dialog = useRef<HTMLElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement;
    close.current?.focus();
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
      if (e.key === "Tab") {
        const a = dialog.current?.querySelectorAll<HTMLElement>(
          "button:not(:disabled),summary",
        );
        if (!a?.length) return;
        const first = a[0],
          last = a[a.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener("keydown", key);
    return () => {
      window.removeEventListener("keydown", key);
      previous?.focus();
    };
  }, [onClose]);
  const locked = (_a: CampaignAction) =>
    state.paused || state.sleeping || state.ended;
  return (
    <div className="cmd-tablet-layer">
      <button
        className="cmd-tablet-scrim"
        aria-label="Close mission tablet"
        onClick={onClose}
      />
      <section
        className="cmd-tablet campaign-tablet"
        role="dialog"
        aria-modal="true"
        aria-label="Mission Tablet"
        ref={dialog}
      >
        <div className="cmd-tablet-head">
          <span className="cmd-device-mark">
            <Icon name="tablet" />
          </span>
          <div>
            <small>ORBITAL / PERSONAL TERMINAL</small>
            <strong>
              Mission Tablet <span>02</span>
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
            <i />
            {state.paused ? "PAUSED" : "MISSION LIVE"}
          </span>
          <span>T+ {missionTime(state.minutes)}</span>
        </div>
        <div className="cmd-tabs" role="tablist" aria-label="Tablet sections">
          {tabs.map((t) => (
            <button
              key={t.id}
              role="tab"
              aria-selected={t.id === tab}
              onClick={() => onTab(t.id)}
            >
              <Icon name={t.icon} size={18} />
              <span>{t.id}</span>
            </button>
          ))}
        </div>
        <div className="cmd-tablet-content" role="tabpanel" aria-label={tab}>
          {saveError && <p className="cmd-alert critical">{saveError}</p>}
          {tab === "MISSION" && (
            <>
              <div className="cmd-section-heading">
                <div>
                  <small>
                    {campaignForMission(m.id)?.name.toUpperCase()} LEVEL {campaignLevel(m.id)} / {currentPhase(s)}
                  </small>
                  <h2>{m.title}</h2>
                </div>
                <span>
                  {s.objective} / {m.objectives.length}
                </span>
              </div>
              <div className={"campaign-current-card "+(recovery?"recovery-active":"")}>
                <small>{recovery ? "⚠ TEMPORARY RECOVERY MISSION" : "CURRENT TASK"}</small>
                <h3>{recovery?.title ?? o?.title ?? "Mission complete."}</h3>
                {recovery ? <>
                  <p>{recovery.cause}</p>
                  <p><strong>ORIGINAL OBJECTIVE ON HOLD:</strong> {o?.title}</p>
                  <p>The original mission resumes automatically once the problem is fixed.</p>
                </> : <p>
                  {o?.site
                    ? "Go to " + sitePosition(o.site, m.destination).name + "."
                    : o?.action === "eat" || o?.action === "drink"
                      ? "Use the carried item in INVENTORY."
                      : "Follow the current instruction."}
                </p>}
                <strong>HOW TO COMPLETE</strong>
                <ol className="campaign-tablet-help">
                  {guide.steps.map((step,i)=><li key={i} className={step.done?"done":""}>
                    {step.done?"✓":i+1}. {step.text}
                  </li>)}
                </ol>
                <p><strong>NEXT: {guide.next}</strong></p>
                {o?.count && (
                  <strong>
                    {s.repetitions} / {o.count} operations complete
                  </strong>
                )}
                <button onClick={onClose}>{recovery ? "Return to recovery mission →" : "Return to mission →"}</button>
              </div>
              <div className="cmd-objective-progress">
                <span
                  style={{
                    width: `${(s.objective / m.objectives.length) * 100}%`,
                  }}
                />
              </div>
              <section className="campaign-optionals">
                <h3>Optional challenges</h3>
                <p>
                  Not required. Small bonuses are paid only after successful
                  recovery.
                </p>
                {m.optional?.map((c) => (
                  <article key={c.id}>
                    <small>OPTIONAL · +{money(c.reward)}</small>
                    <h4>{c.title}</h4>
                    <p>{c.description}</p>
                    {c.action ? (
                      s.optionalDone.includes(c.id) ? (
                        <strong>✓ COMPLETE</strong>
                      ) : (
                        <div>
                          <p>
                            Location:{" "}
                            {c.site
                              ? sitePosition(c.site, m.destination).name
                              : "Mission operations"}
                            . Consult MAP.
                          </p>

                          <button
                            disabled={
                              state.paused || (!!c.site && !atSite(s, c.site))
                            }
                            onClick={() => onOptional(c.id)}
                          >
                            Perform optional task
                          </button>
                        </div>
                      )
                    ) : (
                      <small>Assessed from final reserves at recovery.</small>
                    )}
                  </article>
                ))}
              </section>
              <ol className="cmd-objectives">
                {m.objectives.map((task, i) => (
                  <li
                    key={task.id}
                    className={
                      i < s.objective
                        ? "complete"
                        : i === s.objective
                          ? "active"
                          : ""
                    }
                  >
                    <span>
                      {i < s.objective ? (
                        <Icon name="check" size={16} />
                      ) : i === s.objective ? (
                        "○"
                      ) : (
                        "○"
                      )}
                    </span>
                    <div>
                      <small>{task.phase}</small>
                      <strong>{task.title}</strong>
                      <small>
                        {i < s.objective
                          ? "Complete"
                          : i === s.objective
                            ? "Current task"
                            : "Upcoming goal · may be prepared in advance"}
                      </small>
                    </div>
                  </li>
                ))}
              </ol>
              <h3 className="cmd-subheading">{campaignForMission(m.id)?.name} progress</h3>
              <div className="campaign-level-chips">
                {missions
                  .filter((v) => campaignForMission(v.id)?.id === campaignForMission(m.id)?.id)
                  .map((v) => (
                    <span
                      className={
                        progress.completed[v.id]
                          ? "done"
                          : v.id === m.id
                            ? "active"
                            : ""
                      }
                      key={v.id}
                    >
                      {progress.completed[v.id]
                        ? "✓"
                        : v.id !== m.id
                          ? "○"
                          : "○"}{" "}
                      LEVEL {campaignLevel(v.id)}
                    </span>
                  ))}
              </div>
            </>
          )}
          {tab === "STATUS" && (
            <>
              <div className="cmd-section-heading">
                <div>
                  <small>SPACECRAFT & CREW</small>
                  <h2>Are we ready?</h2>
                </div>
              </div>
              <div className="campaign-simple-grid">
                <Gauge
                  name="OXYGEN"
                  value={`${state.oxygen.toFixed(2)} kg remaining`}
                  ratio={state.oxygen / s.life.oxygen}
                />
                <Gauge
                  name="FOOD"
                  value={`${state.food + state.meals} meals remaining`}
                  ratio={(state.food + state.meals) / s.life.food}
                />
                <Gauge
                  name="WATER"
                  value={`${(state.water + state.bottle).toFixed(1)} L remaining`}
                  ratio={(state.water + state.bottle) / s.life.water}
                />
                <Gauge
                  name="POWER"
                  value={`Battery ${Math.round((state.battery / s.life.batteries) * 100)}%`}
                  ratio={state.battery / s.life.batteries}
                />
                <Gauge
                  name="FUEL"
                  value={`${state.fuel} units remaining`}
                  ratio={state.fuel / 40}
                />
                <Gauge
                  name="CREW ENERGY"
                  value={`${Math.round(state.energy)}% · ${state.sleeping ? "resting" : "awake"}`}
                  ratio={state.energy / 100}
                  warning={0.3}
                />
                <Gauge
                  name="HYDRATION"
                  value={`${Math.round(state.hydration)}%`}
                  ratio={state.hydration / 100}
                  warning={0.3}
                />
                <Gauge
                  name="NUTRITION"
                  value={`${Math.round(state.nutrition)}%`}
                  ratio={state.nutrition / 100}
                  warning={0.3}
                />
              </div>
              <div
                className={`cmd-alert ${state.communications ? "normal" : "critical"}`}
              >
                <Icon name="comms" />
                Radio:{" "}
                {state.communications
                  ? "GOOD — connected to Earth"
                  : "CRITICAL — restore the radio link"}
              </div>
              {state.malfunction && (
                <div className="cmd-alert caution">
                  A power unit needs repair. Follow the mission task or use your
                  toolkit at the power station.
                </div>
              )}
              {m.eva && (
                <>
                  <h3 className="cmd-subheading">EVA suit</h3>
                  <div className="campaign-simple-grid">
                    <Gauge
                      name="SUIT OXYGEN"
                      value={`${s.suit.oxygen.toFixed(2)} kg`}
                      ratio={s.suit.oxygen / 0.35}
                    />
                    <Gauge
                      name="SUIT BATTERY"
                      value={`${Math.round(s.suit.power * 100)}%`}
                      ratio={s.suit.power}
                    />
                    <Gauge
                      name="SUIT CONDITION"
                      value={`${Math.round(s.suit.condition)}%`}
                      ratio={s.suit.condition / 100}
                    />
                    <Gauge
                      name="EVA TIME"
                      value={`About ${Math.floor(Math.min(s.suit.oxygen / 0.0007, s.suit.power / 0.001))} mission minutes`}
                      ratio={Math.min(s.suit.oxygen / 0.35, s.suit.power)}
                    />
                  </div>
                  <p className="cmd-footnote">
                    {s.suit.equipped
                      ? !s.state.communications
                        ? "Suit equipped · radio link unavailable. Restore communications."
                        : "Suit equipped · radio linked to spacecraft."
                      : "Suit is stored in the equipment locker."}
                  </p>
                  <div className="campaign-airlock">
                    <span>
                      INSIDE HATCH{" "}
                      <strong>{s.airlock.inner ? "OPEN" : "CLOSED"}</strong>
                    </span>
                    <i>⇄</i>
                    <span>
                      CHAMBER{" "}
                      <strong>
                        {s.airlock.cycling
                          ? "CYCLING"
                          : s.airlock.pressure < 1
                            ? "VACUUM"
                            : "AIR READY"}
                      </strong>
                    </span>
                    <i>⇄</i>
                    <span>
                      OUTSIDE HATCH{" "}
                      <strong>{s.airlock.outer ? "OPEN" : "CLOSED"}</strong>
                    </span>
                  </div>
                </>
              )}
              {s.camp.shelter && (
                <>
                  <h3 className="cmd-subheading">Research camp</h3>
                  <div className="cmd-system-list">
                    <div>
                      <span>Power</span>
                      <strong>
                        {s.camp.broken
                          ? "REPAIR NEEDED"
                          : s.camp.power > 0.03
                            ? "GOOD"
                            : "LOW"}
                      </strong>
                    </div>
                    <div>
                      <span>Communications</span>
                      <strong>
                        {s.camp.antenna && !s.camp.broken && s.camp.power > 0.01
                          ? "CONNECTED"
                          : "OFFLINE"}
                      </strong>
                    </div>
                    <div>
                      <span>Science</span>
                      <strong>{s.camp.science} points</strong>
                    </div>
                    <div>
                      <span>Sample storage</span>
                      <strong>
                        {s.camp.storage
                          ? s.camp.samples + " stored"
                          : "Not deployed"}
                      </strong>
                    </div>
                    <div>
                      <span>Environment</span>
                      <strong>{env.name} · stay suited</strong>
                    </div>
                  </div>
                </>
              )}
              <p className="cmd-footnote">
                Flight cost {money(s.finance.cost)} · allocation{" "}
                {money(s.finance.allocation)} · Agency Budget{" "}
                {money(progress.economy.balance)}
                {s.finance.practice ? " · TRAINING REPLAY" : ""}
              </p>
              <button className="campaign-details-button" onClick={onAbort}>
                Abort flight & recover hardware
              </button>
              <button
                className="campaign-details-button"
                aria-expanded={details}
                onClick={() => setDetails((v) => !v)}
              >
                {details ? "Hide" : "Show"} engineering DETAILS{" "}
                <Icon name="chevron" size={15} />
              </button>
              {details && (
                <>
                  <div className="cmd-system-list">
                    {[
                      ["Battery reserve", state.battery.toFixed(3) + " kWh"],
                      [
                        "Solar output",
                        ((s.design.counts.solar || 0) * 85 * env.solar).toFixed(
                          0,
                        ) + " W",
                      ],
                      [
                        "Net power margin",
                        (
                          engineeringCampaign(
                            s.design,
                            s.life,
                            s.selectedGear,
                            m.eva,
                          ).power +
                          (s.design.counts.solar || 0) * 85 * (env.solar - 1) -
                          (state.malfunction ? 90 : 0)
                        ).toFixed(0) + " W",
                      ],
                      ["Cabin pressure", state.pressure.toFixed(1) + " kPa"],
                      [
                        "Cabin temperature",
                        state.temperature.toFixed(1) + " °C",
                      ],
                      ["Radiation exposure index", String(state.radiation)],
                      ["Crew duty load", Math.floor(state.sleepDebt) + " min"],
                      [
                        "Oxygen baseline",
                        ".84 kg per crew day before recycling",
                      ],
                      ["Outside gravity", env.gravity + " m/s²"],
                      [
                        "Outside temperature",
                        env.temperature + " °C (scenario estimate)",
                      ],
                      [
                        "Communications delay",
                        env.communicationDelay + " s (game scenario)",
                      ],
                    ].map(([k, v]) => (
                      <div key={k}>
                        <span>{k}</span>
                        <strong>{v}</strong>
                      </div>
                    ))}
                    {lifeOptions.map((option) => (
                      <div key={option.key}>
                        <span>{option.name}</span>
                        <strong>
                          {s.life[option.key]} {option.unit}
                        </strong>
                      </div>
                    ))}
                    {components
                      .filter((c) => s.design.counts[c.id])
                      .map((c) => (
                        <div key={c.id}>
                          <span>{c.name}</span>
                          <strong>×{s.design.counts[c.id]}</strong>
                        </div>
                      ))}
                  </div>
                  {alerts(state).map((a) => (
                    <p key={a} className="cmd-alert caution">
                      {a}
                    </p>
                  ))}
                </>
              )}
            </>
          )}
          {tab === "INVENTORY" && (
            <>
              <div className="cmd-section-heading">
                <div>
                  <small>SUPPLIES</small>
                  <h2>Carried & stored</h2>
                </div>
              </div>
              <div className="cmd-inventory-grid">
                <article className="cmd-inventory-card">
                  <div className="cmd-item-art item-food">
                    <Icon name="food" size={44} />
                    <span>×{state.meals}</span>
                  </div>
                  <h3>Meal packs</h3>
                  <strong>{state.meals} carried</strong>
                  <small>{state.food} in spacecraft storage</small>
                  <button
                    disabled={
                      locked("eat") ||
                      state.meals < 1 ||
                      outside(s) ||
                      (s.position.z > 7.7 && s.airlock.pressure < 80) ||
                      s.flight.status === "ascent" ||
                      state.minutes - s.lastEat < 20 ||
                      state.nutrition >= 98
                    }
                    onClick={() => onCommand("eat")}
                  >
                    Eat meal
                  </button>
                </article>
                <article className="cmd-inventory-card">
                  <div className="cmd-item-art item-water">
                    <Icon name="water" size={44} />
                  </div>
                  <h3>Water bottle</h3>
                  <strong>{state.bottle.toFixed(2)} / 1 L</strong>
                  <small>{state.water.toFixed(2)} L in storage</small>
                  <button
                    disabled={
                      locked("drink") ||
                      state.bottle <= 0 ||
                      outside(s) ||
                      (s.position.z > 7.7 && s.airlock.pressure < 80) ||
                      s.flight.status === "ascent" ||
                      state.minutes - s.lastDrink < 2 ||
                      state.hydration >= 99
                    }
                    onClick={() => onCommand("drink")}
                  >
                    Drink water · 250 mL
                  </button>
                </article>
              </div>
              {outside(s) && (
                <p className="cmd-alert caution">
                  Keep your helmet on. Eat and drink after returning inside.
                </p>
              )}
              <p className="cmd-footnote">
                Meals and drinks have a short cooldown. If a button is locked,
                check your supplies, cooldown, hydration and whether your helmet
                is sealed.
              </p>
              <h3 className="cmd-subheading">
                Tools · science equipment · EVA equipment
              </h3>
              <p className="cmd-footnote">
                Field pack {packMass(s.pack).toFixed(1)} / {PACK_CAPACITY} kg.
                Collect field items from their storage lockers before leaving
                the cabin.
              </p>
              <div className="cmd-inventory-grid">
                {s.selectedGear.map((id) => (
                  <article className="cmd-inventory-card" key={id}>
                    <div className="cmd-item-art">
                      <Icon
                        name={
                          id === "suit"
                            ? "crew"
                            : id === "repair"
                              ? "tool"
                              : "science"
                        }
                        size={35}
                      />
                    </div>
                    <h3>{equipment[id].name}</h3>
                    <small>Quantity: 1 · {equipment[id].description}</small>
                    <small>
                      Condition{" "}
                      {(id === "suit"
                        ? s.suit.condition
                        : (s.world.equipment[id] ?? 100)
                      ).toFixed(1)}
                      %
                    </small>
                    <strong>
                      {id === "suit"
                        ? s.suit.equipped
                          ? "Equipped"
                          : "Stored"
                        : s.pack.includes(id)
                          ? "Carried"
                          : "On spacecraft / deployed"}
                    </strong>
                    <small>
                      {equipment[id].mass} kg · {equipment[id].category}
                    </small>
                  </article>
                ))}
              </div>
              <div className="cmd-inventory-grid">
                <article className="cmd-inventory-card">
                  <div className="cmd-item-art">
                    <Icon name="tool" size={38} />
                  </div>
                  <h3>Repair toolkit</h3>
                  <strong>
                    {state.tools || s.pack.includes("repair")
                      ? "1 carried"
                      : "Stored in Equipment Storage"}
                  </strong>
                  <small>
                    Reusable tools · collect before servicing hardware.
                  </small>
                </article>
                <article className="cmd-inventory-card">
                  <div className="cmd-item-art">
                    <Icon name="box" size={38} />
                    <span>×{state.parts}</span>
                  </div>
                  <h3>Repair parts</h3>
                  <strong>{state.parts} serviceable parts</strong>
                  <small>Each hardware repair consumes a part.</small>
                </article>
              </div>
              <h3 className="cmd-subheading">Repair parts</h3>
              <p>
                {state.parts} spare parts · toolkit{" "}
                {state.tools ? "carried" : "in spacecraft equipment storage"}
              </p>
              <h3 className="cmd-subheading">Samples</h3>
              {s.samples.length ? (
                s.samples.map((sample) => (
                  <div className="cmd-brief-note" key={sample.id}>
                    <Icon name="science" />
                    <p>
                      {sample.kind}
                      <br />
                      <small>
                        {environments[sample.destination].name} ·{" "}
                        {sample.location || "legacy survey"} ·{" "}
                        {sample.mass?.toFixed(2) || "—"} kg ·{" "}
                        {sample.status || "Carried"} · value{" "}
                        {sample.scientificValue || "Unclassified"}
                      </small>
                    </p>
                  </div>
                ))
              ) : (
                <p className="cmd-footnote">
                  No physical samples carried. Science observations:{" "}
                  {state.science} points.
                </p>
              )}
              {s.world.storedSamples.length > 0 && (
                <p>
                  {s.world.storedSamples.length} labelled samples in physical
                  storage.
                </p>
              )}
              {s.camp.samples > 0 && (
                <p>{s.camp.samples} samples stored at the field camp.</p>
              )}
            </>
          )}
          {tab === "MAP" && <NavigationContent s={s} />}
          {tab === "LOG" && (
            <>
              <div className="cmd-section-heading">
                <div>
                  <small>FLIGHT RECORDER</small>
                  <h2>Mission log</h2>
                </div>
              </div>
              <SoundSettings />
              <h3>Radio & system messages</h3>
              <div className="cmd-log">
                {[...s.world.messages].reverse().map((message, i) => (
                  <article key={"radio" + i}>
                    <small>
                      MET {missionTime(message.at)} · {message.source}
                    </small>
                    <p>{message.text}</p>
                  </article>
                ))}
              </div>
              <div className="cmd-log">
                {[...state.log].reverse().map((line, i) => (
                  <article key={i}>
                    <i />
                    <p>{line}</p>
                  </article>
                ))}
              </div>
              <h3 className="cmd-subheading">Mission history</h3>
              {progress.history.slice(0, 8).map((r) => (
                <p key={r.runId} className="cmd-footnote">
                  {missionById(r.missionId).title}:{" "}
                  {r.success ? "Complete" : "Aborted"} · {r.score}/100
                </p>
              ))}
              <p className="cmd-footnote">
                Flight cost {money(s.finance.cost)} · allocation{" "}
                {money(s.finance.allocation)} · Agency Budget{" "}
                {money(progress.economy.balance)}
                {s.finance.practice ? " · TRAINING REPLAY" : ""}
              </p>
              <button className="campaign-details-button" onClick={onAbort}>
                Abort flight & recover hardware
              </button>
              <button
                className="campaign-details-button"
                onClick={onResetTutorials}
              >
                Reset beginner explanations
              </button>
            </>
          )}
        </div>
        <div className="cmd-tablet-bottom">
          <span>
            <i />
            {saveError ? "SAVE WARNING" : "LOCAL AUTOSAVE"}
          </span>
          <button onClick={onHome}>
            Save & campaign <Icon name="chevron" size={14} />
          </button>
        </div>
      </section>
    </div>
  );
}
