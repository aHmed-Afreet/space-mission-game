import type { Dispatch, SetStateAction } from "react";
import { components, rockets, trajectories, type Design } from "../../game";
import { lifeOptions, type LifeSupport } from "../simulation";
import { engineeringCampaign } from "./engine";
import {
  equipment,
  packMass,
  PACK_CAPACITY,
  type EquipmentId,
} from "./equipment";
import type { MissionDefinition } from "./definitions";
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
}: {
  design: Design;
  setDesign: Dispatch<SetStateAction<Design>>;
  life: LifeSupport;
  setLife: Dispatch<SetStateAction<LifeSupport>>;
  gear: EquipmentId[];
  onGear: (id: EquipmentId) => void;
  mission: MissionDefinition;
  onLaunch: () => void;
}) {
  const e = engineeringCampaign(design, life, gear, mission.eva);
  const blockers = [
    e.cost > 300 ? "Over the $300M mission budget." : "",
    e.mass > rockets[design.rocket].payload
      ? "Payload exceeds your rocket capacity."
      : "",
    e.power < 0 ? "Add solar panels or reduce electrical demand." : "",
    e.fuel < 10 ? "Need at least 10 fuel reserve units." : "",
    !design.counts.antenna ? "Install a communications antenna." : "",
    !design.counts.spectrometer ? "Install a spectrometer for science." : "",
    packMass(gear) > PACK_CAPACITY
      ? "Your field pack is too heavy. Remove optional equipment."
      : "",
    ...mission.requiredEquipment
      .filter((id) => !gear.includes(id))
      .map((id) => "Pack the " + equipment[id].name.toLowerCase() + "."),
  ].filter(Boolean);
  return (
    <div className="cmd-builder">
      <div className="eyebrow">ORBITAL / COMMANDER MODE</div>
      <h1>{mission.title}</h1>
      <p>
        LEVEL {mission.level} / {mission.description}
      </p>
      <p>
        Choose supplies and hardware, then prepare the field equipment for this
        mission. Strategy Mode is unchanged.
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
            the readiness sortie, not supplies for a full Mars transit. A future
            full-transit mission will require additional provisioning.
          </p>
        </div>
      </details>
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
        Start mission →
      </button>
    </div>
  );
}
