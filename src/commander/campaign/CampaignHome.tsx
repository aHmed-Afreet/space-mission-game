import type { Dispatch, SetStateAction } from "react";
import { equipment, type EquipmentId } from "./equipment";
import {
  categories,
  nominalCondition,
  equipmentServiceCost,
  type Subsystem,
} from "./ship";
import { technologies, money } from "./economy";
import { chapters, missions, type MissionDefinition } from "./definitions";
import { campaigns, campaignById, campaignForMission, campaignLevel, type CampaignId } from "./campaignTypes";
import { canStart, type Progress, type Session } from "./engine";
import { environments } from "./environments";
import Icon from "../Icons";
export default function CampaignHome({
  progress,
  session,
  legacy,
  warning,
  readOnly,
  onSelect,
  selectedRoute,
  setSelectedRoute,
  onResume,
  onLegacy,
  onExit,
  onSettings = () => {},
  onService = () => {},
  onServiceEquipment = () => {},
}: {
  onService?: (system: Subsystem) => void;
  onServiceEquipment?: (id: EquipmentId) => void;
  progress: Progress;
  session: Session | null;
  legacy: boolean;
  warning: string;
  readOnly: boolean;
  onSelect: (m: MissionDefinition) => void;
  selectedRoute: CampaignId | null;
  setSelectedRoute: Dispatch<SetStateAction<CampaignId | null>>;
  onResume: () => void;
  onLegacy: () => void;
  onExit: () => void;
  onSettings?: () => void;
}) {
  const selectedCampaign = selectedRoute ? campaignById(selectedRoute) : null;
  const visible = selectedCampaign
    ? missions.filter(m => (selectedCampaign.missionIds as readonly string[]).includes(m.id))
    : [];
  const next = missions.find(m => !progress.completed[m.id] && canStart(m,progress));
  const routeCompleted = visible.filter(m=>progress.completed[m.id]).length;
  const routeNext = visible.find(m=>!progress.completed[m.id] && canStart(m,progress));
  return (
    <div className="campaign-home">
      <div className="campaign-nav">
        <button onClick={selectedRoute ? ()=>setSelectedRoute(null) : onExit}>{selectedRoute ? "← All mission types" : "← Choose mode"}</button>
        <span>ORBITAL / MISSION LAB</span>
        <button type="button" className="campaign-open-settings" onClick={onSettings}><Icon name="settings" size={16}/> Settings</button>
      </div>
      {!selectedRoute && <section className="campaign-destination-picker campaign-type-hub" aria-labelledby="campaign-pick-title">
        <div className="campaign-picker-intro">
          <small>COMMANDER / INDEPENDENT CAMPAIGNS</small>
          <h1 id="campaign-pick-title">Choose your <em>mission type.</em></h1>
          <p>Each type opens its own page, starts at Level 1 and unlocks levels independently.</p>
        </div>
        <div className="campaign-picker-grid">
          {campaigns.map(c=>{
            const groupMissions=missions.filter(m=>(c.missionIds as readonly string[]).includes(m.id));
            const complete=groupMissions.filter(m=>progress.completed[m.id]).length;
            return <button key={c.id} type="button"
              className={"campaign-pick-card pick-"+c.destination+" campaign-route-card"}
              onClick={()=>setSelectedRoute(c.id)}
              aria-label={"Open "+c.name+" campaign levels"}>
              <span className="campaign-pick-card-top">{c.eyebrow}</span>
              <span className="campaign-card-planet" aria-hidden="true">{c.icon}</span>
              <strong>{c.name}</strong>
              <span>{c.description}</span>
              <b>{complete} / {groupMissions.length} COMPLETED · OPEN CAMPAIGN ↗</b>
            </button>;
          })}
        </div>
      </section>}
      {selectedCampaign && <section className={"campaign-route-hero campaign-route-"+selectedCampaign.destination} aria-labelledby="campaign-route-title">
        <small>{selectedCampaign.eyebrow}</small>
        <span className="campaign-route-planet" aria-hidden="true">{selectedCampaign.icon}</span>
        <h1 id="campaign-route-title">{selectedCampaign.name}</h1>
        <p>{selectedCampaign.description}</p>
        <div className="campaign-route-stats">
          <span><strong>{routeCompleted}</strong> / {visible.length} completed</span>
          <span><strong>{routeNext ? "LEVEL "+campaignLevel(routeNext.id) : "COMPLETE"}</strong> next</span>
        </div>
        <button type="button" onClick={()=>setSelectedRoute(null)}>← Back to all mission types</button>
      </section>}
      {!selectedRoute && <>
      <section className="campaign-hero">
        <span className="eyebrow">COMMANDER CAMPAIGN</span>
        <h1>Mission Control.</h1>
        <p>
          Fly, explore the Moon and conduct research.
          <br />
          Complete flights to unlock the
          next challenge.
        </p>
        <div className="campaign-totals">
          <span>
            <strong>{Object.keys(progress.completed).length}</strong> MISSIONS
            COMPLETE
          </span>
          <span>
            <strong>{missions.filter((m) => m.implemented).length}</strong>{" "}
            PLAYABLE MISSIONS
          </span>
          <span>
            <strong>{chapters.length}</strong> CHAPTERS
          </span>
        </div>
      </section>
      <section className="mission-control-dashboard">
        <article>
          <small>COMMANDER PROFILE</small>
          <h2>Explorer Commander</h2>
          <p>
            {chapters.find((c) => c.id === next?.chapter)?.title ||
              "Flight programme complete"}
          </p>
          <div className="cmd-objective-progress">
            <span
              style={{
                width: `${(Object.keys(progress.completed).length / missions.filter((m) => m.implemented).length) * 100}%`,
              }}
            />
          </div>
          <p>
            {Object.keys(progress.completed).length} /{" "}
            {missions.filter((m) => m.implemented).length} available missions
            complete
          </p>
        </article>
        <article className="agency-finance">
          <small>AGENCY BUDGET</small>
          <h2>{money(progress.economy.balance)}</h2>
          <p>Persistent programme funds · in-game money</p>
          <small>NEXT MISSION</small>
          <p>{next?.title || "Review a completed flight"}</p>
          <p>
            {next
              ? `Allocation +${money(next.funding || 0)} on flight commitment`
              : "Training replays do not change Agency Budget"}
          </p>
        </article>
        <article>
          <small>SPACECRAFT / EQUIPMENT ACCESS</small>
          <h2>{progress.economy.unlocks.length} technologies</h2>
          <p>
            Standard spacecraft, life support and required mission equipment are
            always available.
          </p>
          {progress.economy.unlocks.map((id) => (
            <span className="tech-chip" key={id}>
              {technologies[id].name}
            </span>
          ))}
        </article>
      </section>
      {progress.archive && (
        <details className="panel">
          <summary>Previous programme achievements · preserved archive</summary>
          <p>
            {Object.keys(progress.archive.completed).length} earlier task-level
            achievements. Completed chapters:{" "}
            {progress.archive.chapters.join(", ") || "None"}. These are
            preserved as prior training; complete flights start at Mission 1.
          </p>
          {progress.archive.history.slice(0, 24).map((r: any, i) => (
            <p key={i}>
              {r.missionId} · {r.score}/100 ·{" "}
              {r.success ? "Complete" : "Attempt"}
            </p>
          ))}
          <p>
            Earlier supplies and position remain in the archived checkpoint; new
            flight funding provisions a fresh spacecraft.
          </p>
        </details>
      )}
      <details className="panel">
        <summary>Agency ledger & mission history</summary>
        {[...progress.economy.ledger]
          .reverse()
          .slice(0, 30)
          .map((t) => (
            <p key={t.id}>
              {t.label} · {t.amount >= 0 ? "+" : ""}
              {money(t.amount)} · balance {money(t.balance)}
            </p>
          ))}
        {progress.history.slice(0, 12).map((r) => (
          <p key={r.runId}>
            {missions.find((m) => m.id === r.missionId)?.title} · {r.outcome} ·{" "}
            {r.score}/100
          </p>
        ))}
      </details>
      <details className="panel">
        <summary>Spacecraft condition & pre-flight maintenance</summary>
        <p>
          Service between flights. Condition carries over from completed or
          aborted real flights; training replays do not alter programme
          hardware.
        </p>
        {categories.map((id) => {
          const value = (progress.condition || nominalCondition())[id],
            cost = Math.round((100 - value) * 4) / 100;
          return (
            <div className="ship-service-row" key={id}>
              <span>
                {id.toUpperCase()} · {value.toFixed(0)}% ·{" "}
                {value >= 90
                  ? "NOMINAL"
                  : value >= 65
                    ? "DEGRADED"
                    : value >= 30
                      ? "DAMAGED"
                      : "CRITICAL"}
              </span>
              <button
                disabled={
                  value >= 100 ||
                  progress.economy.balance < cost ||
                  (!!session && !session.report)
                }
                onClick={() => onService(id)}
              >
                Service · ${cost.toFixed(2)}M
              </button>
            </div>
          );
        })}
      </details>
      <details className="panel">
        <summary>Reusable equipment servicing</summary>
        {Object.entries(progress.equipmentCondition || {}).map(
          ([id, value]) => (
            <div className="ship-service-row" key={id}>
              <span>
                {equipment[id as EquipmentId].name} · {value?.toFixed(1)}%
              </span>
              <button
                disabled={
                  (value || 100) >= 100 ||
                  (!!session && !session.report) ||
                  progress.economy.balance < equipmentServiceCost(value ?? 100)
                }
                onClick={() => onServiceEquipment(id as EquipmentId)}
              >
                Service · ${equipmentServiceCost(value ?? 100).toFixed(2)}M
              </button>
            </div>
          ),
        )}
      </details>
      </>}
      {warning && <p className="cmd-alert caution">{warning}</p>}
      {session && (
        <section className="campaign-resume">
          <div>
            <small>SAVED MISSION</small>
            <h2>{missions.find((m) => m.id === session.missionId)?.title}</h2>
            <p>
              {session.report
                ? "This flight has ended. Close the report to return to the level list."
                : `Task ${session.objective + 1} of ${missions.find((m) => m.id === session.missionId)?.objectives.length}. Progress is preserved.`}
            </p>
          </div>
          <button onClick={onResume}>{session.report?"Close finished report →":"Resume mission →"}</button>
        </section>
      )}
      {selectedCampaign && <section className="campaign-route-levels" aria-labelledby="route-levels-title">
        <div className="campaign-chapter-heading">
          <span>★</span>
          <div>
            <h2 id="route-levels-title">Your {selectedCampaign.name} levels</h2>
            <p>Finish a level to unlock the next level in this campaign only.</p>
          </div>
        </div>
        <div className="campaign-missions">
          {visible.map(m=>{
            const level=campaignLevel(m.id);
            const completed=progress.completed[m.id];
            const ready=canStart(m,progress);
            return <article key={m.id}
              className={`${completed?"complete":ready?"ready":"locked"} ${session?.missionId===m.id?"current":""}`}>
              <div>
                <small>LEVEL {String(level).padStart(2,"0")} · {selectedCampaign.name.toUpperCase()}</small>
                <span>{completed?"✓ COMPLETE":ready?"AVAILABLE":"🔒 LOCKED"}</span>
              </div>
              <h3>{m.title}</h3>
              {m.historical && <div className="campaign-story-tag">INSPIRED BY · {m.historical.inspiration} ({m.historical.year})</div>}
              <span className="campaign-destination"><Icon name="target" size={13}/>{environments[m.destination].name}</span>
              <p>{m.majorObjective}</p>
              <small>{m.phases.length} phases · {m.expectedMinutes} · +{money(m.funding||0)} mission allocation</small>
              <footer>
                <span>{completed?`BEST ${completed.score} / 100 · RANK ${completed.rank}`:
                  ready?"Ready to prepare and launch.":
                    `Complete ${selectedCampaign.name} Level ${level-1} first.`}</span>
                <button disabled={!ready || readOnly} onClick={()=>onSelect(m)}>
                  {completed?"Replay":ready?"Prepare Level "+level:"Locked"}
                  <Icon name="chevron" size={13}/>
                </button>
              </footer>
            </article>;
          })}
        </div>
      </section>}
      {legacy && (
        <section className="campaign-legacy">
          <h3>Previous readiness sortie</h3>
          <p>
            Your earlier six-hour mission is preserved. It does not unlock
            campaign missions.
          </p>
          <button onClick={onLegacy}>Continue previous sortie</button>
        </section>
      )}
      <p className="cmd-footnote">Mars and asteroid sorties are orbital/cruise training simulations; surface landings there are not yet modeled. Existing mission saves remain compatible.</p>
    </div>
  );
}
