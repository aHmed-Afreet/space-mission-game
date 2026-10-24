import {
  allocation,
  launchFinance,
  technologies,
  money,
  type Technology,
} from "./economy";
import type { Dispatch, SetStateAction } from "react";
import { components, rockets, trajectories, type Design } from "../../game";
import { lifeOptions, type LifeSupport } from "../simulation";
import { engineeringCampaign, preflight, type Progress } from "./engine";
import {
  equipment,
  packMass,
  PACK_CAPACITY,
  type EquipmentId,
} from "./equipment";
import type { MissionDefinition } from "./definitions";
import { campaignLevel, campaignForMission } from "./campaignTypes";
import Icon from "../Icons";
export default function Preparation({
  design,
  setDesign,
  life,
  setLife,
  gear,
  onGear,
  mission,
  onLaunch,
  progress,
  upgrades,
  onUpgrade,
}: {
  progress: Progress;
  upgrades: Technology[];
  onUpgrade: (id: Technology) => void;
  design: Design;
  setDesign: Dispatch<SetStateAction<Design>>;
  life: LifeSupport;
  setLife: Dispatch<SetStateAction<LifeSupport>>;
  gear: EquipmentId[];
  onGear: (id: EquipmentId) => void;
  mission: MissionDefinition;
  onLaunch: () => void;
}) {
  const e = engineeringCampaign(design, life, gear, mission.eva, upgrades);
  const blockers = preflight(mission, design, life, gear, progress, upgrades);
  let finance;
  try {
    finance = launchFinance(mission, progress, e.cost);
  } catch {
    /* The preflight panel explains affordability. */
  }
  const warnings = [
    e.foodDays * 1440 < mission.duration
      ? "Food endurance is below the planned mission duration."
      : "",
    e.waterDays * 1440 < mission.duration
      ? "Water endurance is below the planned mission duration."
      : "",
    e.oxygenDays * 1440 < mission.duration
      ? "Oxygen endurance is below the planned mission duration."
      : "",
    e.fuel < 25 ? "Fuel margin is small. Avoid unnecessary corrections." : "",
  ].filter(Boolean);
  return (
    <div className="cmd-builder">
      <div className="eyebrow">ORBITAL / COMMANDER MODE</div>
      <h1>{mission.title}</h1>
      <p>
        {campaignForMission(mission.id)?.name} LEVEL {campaignLevel(mission.id)} / {mission.description}
      </p>
      <p>
        Read the flight brief, choose your equipment, then board for pre-launch
        checks. Funding and flight spending are booked only when you commit the
        mission.
      </p>
      <div className="mission-brief-grid">
        <section className="panel">
          <small>FLIGHT BRIEF</small>
          <h2>{mission.majorObjective}</h2>
          <p>{mission.description}</p>
          {mission.historical && <div className="campaign-historical">
            <small>INSPIRED BY REAL ASTRONAUT MISSIONS · {mission.historical.year}</small>
            <h3>{mission.historical.inspiration}</h3>
            <p><strong>Your story:</strong> {mission.historical.story}</p>
            <p><strong>What really happened:</strong> {mission.historical.realHistory}</p>
            <p><small>ASTRONAUT SKILLS</small></p>
            <ul>{mission.historical.learning.map(skill=><li key={skill}>{skill}</li>)}</ul>
            <p className="campaign-history-note">{mission.historical.disclaimer}</p>
            <a href={mission.historical.source} target="_blank" rel="noopener noreferrer">Read NASA's mission history ↗</a>
          </div>}
          <p>
            Destination: {mission.destination.toUpperCase()} ·{" "}
            {mission.expectedMinutes}
          </p>
          <p>
            Operational window: {mission.duration} simulated minutes. Mission
            clocks are compressed for gameplay.
          </p>
          <p>
            Known challenges:{" "}
            {mission.eva
              ? "Vacuum, suit reserves, hatch interlocks; "
              : "Launch guidance, crew readiness; "}
            {mission.surface
              ? "lunar descent and surface power."
              : "electrical faults and propellant margin."}
          </p>
          <p>
            Recommended: required equipment below, 3 spare parts, at least 25
            fuel reserve and 60% battery for recovery.
          </p>
        </section>
        <section className="panel agency-finance">
          <small>AGENCY BUDGET</small>
          <h2>{money(progress.economy.balance)}</h2>
          <p>
            Mission allocation <b>+{money(allocation(mission, progress))}</b>
          </p>
          <p>
            Available before purchases{" "}
            <b>
              {money(progress.economy.balance + allocation(mission, progress))}
            </b>
          </p>
          <p>
            Flight configuration <b>{money(e.cost)}</b>
          </p>
          <p>
            Post-purchase balance{" "}
            <b>
              {finance
                ? money(
                    finance.before +
                      finance.allocation +
                      finance.assistance -
                      finance.cost,
                  )
                : "Over budget"}
            </b>
          </p>
          {finance?.assistance ? (
            <p>
              Recovery underwriting {money(finance.assistance)} · covers this
              flight only; excluded from insurance.
            </p>
          ) : null}
          {finance?.practice && (
            <p>
              TRAINING REPLAY · no spending, allocation or cash rewards. Scores
              still count.
            </p>
          )}
        </section>
      </div>
      <section className="panel">
        <h2>Flight phases</h2>
        <div className="campaign-level-chips">
          {mission.phases.map((p, i) => (
            <span key={p}>
              {i + 1} · {p}
            </span>
          ))}
        </div>
        <h3>Optional challenges</h3>
        {mission.optional?.map((o) => (
          <p key={o.id}>
            <b>
              +{money(o.reward)} · {o.title}
            </b>{" "}
            — {o.description}
          </p>
        ))}
      </section>
      <section className="cmd-design-summary" aria-live="polite">
        <strong>${e.cost.toFixed(1)}M flight configuration</strong>
        <strong>
          {e.mass.toFixed(0)} / {rockets[design.rocket].payload} kg
        </strong>
        <strong>{e.power.toFixed(0)} W spare</strong>
        <strong>{e.capacity} kWh reserve</strong>
        <strong>{e.fuel} fuel reserve</strong>
      </section>
      {mission.allowedEquipment.length > 0 && (
        <section className="panel campaign-pack">
          <h2>Field equipment</h2>
          <p>
            Pack what this mission needs. More equipment adds mass and cost.
            Backpack limit: {PACK_CAPACITY} kg (suit worn separately).
          </p>
          <div className="campaign-gear">
            {mission.allowedEquipment.map((id) => (
              <button
                key={id}
                aria-pressed={gear.includes(id)}
                onClick={() => onGear(id)}
              >
                <Icon
                  name={
                    id === "suit"
                      ? "crew"
                      : id === "repair"
                        ? "tool"
                        : "science"
                  }
                />
                <span>
                  {equipment[id].name}
                  <small>
                    {equipment[id].mass} kg · ${equipment[id].cost}M{" "}
                    {mission.requiredEquipment.includes(id)
                      ? " · REQUIRED"
                      : ""}
                  </small>
                </span>
                <b>{gear.includes(id) ? "✓" : "+"}</b>
              </button>
            ))}
          </div>
          <p>
            Backpack: {packMass(gear).toFixed(1)} / {PACK_CAPACITY} kg
          </p>
        </section>
      )}
      <section className="panel">
        <h2>Technology access</h2>
        <p>
          Mission-fit upgrades are purchased for this flight. Research access
          persists; basic controls are always included.
        </p>
        <div className="campaign-gear">
          {(Object.keys(technologies) as Technology[]).map((id) => (
            <button
              key={id}
              disabled={!progress.economy.unlocks.includes(id)}
              aria-pressed={upgrades.includes(id)}
              onClick={() => onUpgrade(id)}
            >
              <span>
                {technologies[id].name}
                <small>
                  {progress.economy.unlocks.includes(id)
                    ? `${money(technologies[id].cost)} · ${technologies[id].mass} kg`
                    : "LOCKED · complete the preceding research mission"}{" "}
                  · {technologies[id].description}
                </small>
              </span>
              <b>{upgrades.includes(id) ? "✓" : "+"}</b>
            </button>
          ))}
        </div>
      </section>
      <details className="campaign-engineering">
        <summary>Spacecraft design & life support · optional details</summary>
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
            this flight, not supplies for a full Mars transit. A future
            full-transit mission will require additional provisioning.
          </p>
        </div>
      </details>
      {!!warnings.length && (
        <div className="cmd-alert caution">
          <strong>Risk advisory · launch is allowed</strong>
          {warnings.map((w) => (
            <p key={w}>{w}</p>
          ))}
        </div>
      )}
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
          onLaunch();
        }}
      >
        Commit flight & board →
      </button>
    </div>
  );
}
