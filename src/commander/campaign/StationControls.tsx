import TouchActionButton from "../../TouchActionButton";
import type { Session } from "./engine";
import type { CampaignAction } from "./definitions";
import {
  doors,
  lockers,
  nearLocker,
  equipmentLocker,
  faultCatalog,
  type WorldAction,
} from "./ship";
import { equipment } from "./equipment";
import { nearby } from "../layout";
export default function StationControls({
  s,
  onWorld,
  onCommand,
}: {
  s: Session;
  onWorld: (a: WorldAction) => void;
  onCommand: (a: CampaignAction) => void;
}) {
  const area = nearby(s.position.x, s.position.z),
    w = s.world;
  const toggle = (id: string, title: string) => (
    <TouchActionButton
      className="ship-toggle"
      role="switch"
      aria-checked={w.switches[id]}
      key={id}
      onActivate={() => onWorld({ kind: "switch", id })}
    >
      <span>{title}</span>
      <i data-on={w.switches[id]} />
      <b>{w.switches[id] ? "ON" : "ISOLATED"}</b>
    </TouchActionButton>
  );
  return (
    <div className="ship-station-controls">
      {Object.entries(doors)
        .filter(
          ([, d]) =>
            Math.abs(s.position.z - d.z) < 1.6 && Math.abs(s.position.x) < 1.5,
        )
        .map(([id, d]) => (
          <TouchActionButton
            key={id}
            onActivate={() =>
              onWorld({ kind: "door", id: id as keyof typeof doors })
            }
          >
            {w.doors[id as keyof typeof doors].open ? "Close" : "Open"} {d.name}
          </TouchActionButton>
        ))}
      {Object.entries(lockers)
        .filter(([id]) => nearLocker(s, id as keyof typeof lockers))
        .map(([id, l]) => (
          <section className="ship-locker" key={id}>
            <TouchActionButton
              aria-expanded={w.lockers[id as keyof typeof lockers]}
              onActivate={() =>
                onWorld({ kind: "locker", id: id as keyof typeof lockers })
              }
            >
              {w.lockers[id as keyof typeof lockers] ? "Close" : "Open"}{" "}
              {l.name}
            </TouchActionButton>
            {w.lockers[id as keyof typeof lockers] && (
              <div className="ship-locker-contents">
                {id === "food" && (
                  <>
                    <p>
                      {s.state.food} stored / {s.state.meals} carried meals
                    </p>
                    <TouchActionButton onActivate={() => onCommand("takeMeal")}>
                      Take meal pack
                    </TouchActionButton>
                    <TouchActionButton onActivate={() => onWorld({ kind: "returnMeal" })}>
                      Put meal pack back
                    </TouchActionButton>
                  </>
                )}
                {id === "water" && (
                  <>
                    <p>
                      {s.state.water.toFixed(2)} L tank /{" "}
                      {s.state.bottle.toFixed(2)} L bottle
                    </p>
                    <TouchActionButton onActivate={() => onCommand("fill")}>
                      Fill bottle from potable tank
                    </TouchActionButton>
                  </>
                )}
                {id === "eva" && (
                  <>
                    <p>
                      Suit {s.suit.equipped ? "worn" : "stowed"} ·{" "}
                      {s.suit.condition.toFixed(0)}% condition
                    </p>
                    <TouchActionButton onActivate={() => onCommand("equipSuit")}>
                      Equip suit
                    </TouchActionButton>
                    <TouchActionButton onActivate={() => onWorld({ kind: "stowSuit" })}>
                      Return suit to locker
                    </TouchActionButton>
                  </>
                )}
                {id === "repair" && (
                  <>
                    <p>
                      {s.state.parts} carried / {w.partsStored} stored parts
                    </p>
                    <TouchActionButton onActivate={() => onCommand("tools")}>
                      Take repair toolkit
                    </TouchActionButton>
                    <TouchActionButton onActivate={() => onWorld({ kind: "takeParts" })}>
                      Take spare part
                    </TouchActionButton>
                    <TouchActionButton onActivate={() => onWorld({ kind: "storeParts" })}>
                      Return spare part
                    </TouchActionButton>
                  </>
                )}
                {id === "samples" && (
                  <>
                    <p>
                      {s.samples.length} carried / {w.storedSamples.length}{" "}
                      archived samples
                    </p>
                    <TouchActionButton onActivate={() => onWorld({ kind: "storeSamples" })}>
                      Store carried samples
                    </TouchActionButton>
                  </>
                )}
                {(id === "samples" || id === "campPanel") &&
                  w.storedSamples
                    .filter(
                      (sample) =>
                        (sample.status === "Stored at camp") ===
                        (id === "campPanel"),
                    )
                    .map((sample) => (
                      <TouchActionButton
                        key={sample.id}
                        onActivate={() =>
                          onWorld({ kind: "retrieveSample", id: sample.id })
                        }
                      >
                        Retrieve {sample.kind} ·{" "}
                        {sample.location || sample.destination}
                      </TouchActionButton>
                    ))}
                {w.stored
                  .filter((g) => equipmentLocker(g) === id)
                  .map((g) => (
                    <TouchActionButton
                      key={g}
                      onActivate={() => onWorld({ kind: "take", id: g })}
                    >
                      Take {equipment[g].name} ·{" "}
                      {(w.equipment[g] ?? 100).toFixed(0)}%
                    </TouchActionButton>
                  ))}
                {s.pack
                  .filter((g) => equipmentLocker(g) === id)
                  .map((g) => (
                    <TouchActionButton
                      key={g}
                      onActivate={() => onWorld({ kind: "store", id: g })}
                    >
                      Put back {equipment[g].name}
                    </TouchActionButton>
                  ))}
              </div>
            )}
          </section>
        ))}
      {area === "power" && (
        <section>
          <h4>POWER DISTRIBUTION</h4>
          <p>
            Battery {s.state.battery.toFixed(2)} kWh · Bus B{" "}
            {s.state.malfunction
              ? "FAULT"
              : w.switches.busB
                ? "CONNECTED"
                : "ISOLATED"}
          </p>
          {toggle("busA", "Battery Bus A")}
          {toggle("busB", "Battery Bus B")}
          {toggle("solar", "Solar input")}
          {toggle("science", "Science payload load")}
          {toggle("emergency", "Emergency load shedding")}
          <h4>LIFE SUPPORT</h4>
          {toggle("oxygen", "Oxygen recycling loop")}
          {toggle("water", "Water recycler")}
          {toggle("cooling", "Cabin cooling")}
          <label>
            Temperature setpoint
            <select
              aria-label="Cabin temperature setpoint"
              value={w.setpoint}
              onChange={(e) =>
                onWorld({ kind: "temperature", value: Number(e.target.value) })
              }
            >
              {[18, 20, 22, 24, 26].map((t) => (
                <option key={t} value={t}>
                  {t} C
                </option>
              ))}
            </select>
          </label>
        </section>
      )}
      {area === "communications" && (
        <section>
          <h4>EARTH LINK</h4>
          {toggle("radio", "Radio electronics")}
          <label>
            Antenna selector
            <select
              aria-label="Active antenna"
              value={w.antenna}
              onChange={(e) =>
                onWorld({ kind: "antenna", value: Number(e.target.value) })
              }
            >
              {Array.from({ length: s.design.counts.antenna || 0 }, (_, i) => (
                <option key={i} value={i + 1}>
                  Antenna {i + 1}
                </option>
              ))}
            </select>
          </label>
          <p>
            {s.state.communications && w.switches.radio
              ? "CONNECTED"
              : "NO LINK"}{" "}
            ·{" "}
            {s.pendingTransmit > s.state.minutes
              ? "Awaiting downlink acknowledgement"
              : "Channel idle"}
          </p>
        </section>
      )}
      {area === "cockpit" && (
        <section>
          <h4>NAVIGATION</h4>
          {toggle("navigation", "Navigation computer")}
          {toggle("maneuver", "Guarded manoeuvre arm")}
          <label>
            Destination selector
            <select
              aria-label="Navigation target"
              value={w.target}
              onChange={(e) =>
                onWorld({
                  kind: "target",
                  value: e.target.value as "earth" | "moon",
                })
              }
            >
              <option value="earth">Earth orbit / recovery</option>
              <option value="moon">Lunar approach</option>
            </select>
          </label>
          <p>
            Fuel {s.state.fuel.toFixed(1)} units ·{" "}
            {s.flight.status.toUpperCase()}
          </p>
        </section>
      )}
      {w.faults
        .filter((f) => !f.verified)
        .map((f) => (
          <section className="ship-fault-card" key={f.id}>
            <small>{faultCatalog[f.kind].level}</small>
            <h4>{faultCatalog[f.kind].name}</h4>
            <p>
              {f.repaired
                ? "Hardware replaced; restore circuit and verify."
                : f.diagnosed
                  ? "Diagnosed. Open maintenance access; isolate " +
                    faultCatalog[f.kind].isolation +
                    "; bring tools and a part."
                  : "Diagnosis required at the subsystem console."}
            </p>
            <TouchActionButton onActivate={() => onWorld({ kind: "diagnose", id: f.id })}>
              Diagnose
            </TouchActionButton>
            <TouchActionButton onActivate={() => onWorld({ kind: "repairFault", id: f.id })}>
              Replace failed hardware
            </TouchActionButton>
            <TouchActionButton onActivate={() => onWorld({ kind: "verifyFault", id: f.id })}>
              Verify operation
            </TouchActionButton>
          </section>
        ))}
    </div>
  );
}
