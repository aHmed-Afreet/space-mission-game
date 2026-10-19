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
    <button
      className="ship-toggle"
      role="switch"
      aria-checked={w.switches[id]}
      key={id}
      onClick={() => onWorld({ kind: "switch", id })}
    >
      <span>{title}</span>
      <i data-on={w.switches[id]} />
      <b>{w.switches[id] ? "ON" : "ISOLATED"}</b>
    </button>
  );
  return (
    <div className="ship-station-controls">
      {Object.entries(doors)
        .filter(
          ([, d]) =>
            Math.abs(s.position.z - d.z) < 1.6 && Math.abs(s.position.x) < 1.5,
        )
        .map(([id, d]) => (
          <button
            key={id}
            onClick={() =>
              onWorld({ kind: "door", id: id as keyof typeof doors })
            }
          >
            {w.doors[id as keyof typeof doors].open ? "Close" : "Open"} {d.name}
          </button>
        ))}
      {Object.entries(lockers)
        .filter(([id]) => nearLocker(s, id as keyof typeof lockers))
        .map(([id, l]) => (
          <section className="ship-locker" key={id}>
            <button
              aria-expanded={w.lockers[id as keyof typeof lockers]}
              onClick={() =>
                onWorld({ kind: "locker", id: id as keyof typeof lockers })
              }
            >
              {w.lockers[id as keyof typeof lockers] ? "Close" : "Open"}{" "}
              {l.name}
            </button>
            {w.lockers[id as keyof typeof lockers] && (
              <div className="ship-locker-contents">
                {id === "food" && (
                  <>
                    <p>
                      {s.state.food} stored / {s.state.meals} carried meals
                    </p>
                    <button onClick={() => onCommand("takeMeal")}>
                      Take meal pack
                    </button>
                    <button onClick={() => onWorld({ kind: "returnMeal" })}>
                      Put meal pack back
                    </button>
                  </>
                )}
                {id === "water" && (
                  <>
                    <p>
                      {s.state.water.toFixed(2)} L tank /{" "}
                      {s.state.bottle.toFixed(2)} L bottle
                    </p>
                    <button onClick={() => onCommand("fill")}>
                      Fill bottle from potable tank
                    </button>
                  </>
                )}
                {id === "eva" && (
                  <>
                    <p>
                      Suit {s.suit.equipped ? "worn" : "stowed"} ·{" "}
                      {s.suit.condition.toFixed(0)}% condition
                    </p>
                    <button onClick={() => onCommand("equipSuit")}>
                      Equip suit
                    </button>
                    <button onClick={() => onWorld({ kind: "stowSuit" })}>
                      Return suit to locker
                    </button>
                  </>
                )}
                {id === "repair" && (
                  <>
                    <p>
                      {s.state.parts} carried / {w.partsStored} stored parts
                    </p>
                    <button onClick={() => onCommand("tools")}>
                      Take repair toolkit
                    </button>
                    <button onClick={() => onWorld({ kind: "takeParts" })}>
                      Take spare part
                    </button>
                    <button onClick={() => onWorld({ kind: "storeParts" })}>
                      Return spare part
                    </button>
                  </>
                )}
                {id === "samples" && (
                  <>
                    <p>
                      {s.samples.length} carried / {w.storedSamples.length}{" "}
                      archived samples
                    </p>
                    <button onClick={() => onWorld({ kind: "storeSamples" })}>
                      Store carried samples
                    </button>
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
                      <button
                        key={sample.id}
                        onClick={() =>
                          onWorld({ kind: "retrieveSample", id: sample.id })
                        }
                      >
                        Retrieve {sample.kind} ·{" "}
                        {sample.location || sample.destination}
                      </button>
                    ))}
                {w.stored
                  .filter((g) => equipmentLocker(g) === id)
                  .map((g) => (
                    <button
                      key={g}
                      onClick={() => onWorld({ kind: "take", id: g })}
                    >
                      Take {equipment[g].name} ·{" "}
                      {(w.equipment[g] ?? 100).toFixed(0)}%
                    </button>
                  ))}
                {s.pack
                  .filter((g) => equipmentLocker(g) === id)
                  .map((g) => (
                    <button
                      key={g}
                      onClick={() => onWorld({ kind: "store", id: g })}
                    >
                      Put back {equipment[g].name}
                    </button>
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
            <button onClick={() => onWorld({ kind: "diagnose", id: f.id })}>
              Diagnose
            </button>
            <button onClick={() => onWorld({ kind: "repairFault", id: f.id })}>
              Replace failed hardware
            </button>
            <button onClick={() => onWorld({ kind: "verifyFault", id: f.id })}>
              Verify operation
            </button>
          </section>
        ))}
    </div>
  );
}
