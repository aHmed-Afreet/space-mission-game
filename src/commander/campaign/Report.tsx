import TouchActionButton from "../../TouchActionButton";
import { money, technologies } from "./economy";
import type { Report as Result } from "./engine";
import ScientificReadings from "./ScientificReadings";
import { equipment } from "./equipment";
import { faultCatalog } from "./ship";
import { missionForSession, missionById } from "./definitions";
import { campaignForMission, campaignLevel } from "./campaignTypes";
export default function Report({
  result,
  onHome,
  onNext,
  onRetry,
}: {
  result: Result;
  onHome: () => void;
  onNext?: () => void;
  onRetry?: () => void;
}) {
  const mission = result.missionRevision === undefined ? missionById(result.missionId)
    : missionForSession({ missionId: result.missionId, revision: result.missionRevision });
  const snapshot = result.conditionSnapshot;
  return (
    <div className="campaign-report">
      <div className="campaign-report-title">
        <div>
          <span className="eyebrow">
            MISSION REPORT / {campaignForMission(result.missionId)?.name.toUpperCase()} · LEVEL {campaignLevel(result.missionId)}
          </span>
          <h1>
            {result.success
              ? "Mission complete."
              : result.outcome === "PARTIAL SUCCESS"
                ? "Partial success."
                : "Mission failed."}
          </h1>
          <p>{mission.title}</p>
          {result.missionId === "mission-7" && (result.missionRevision ?? 3) === 3 && <p>Legacy Mission 7 revision 3: 58 required tasks. Temperature was not required by that checklist; only readings actually retained are shown.</p>}
          {mission.historical && <p className="campaign-real-mission">
            Inspired by {mission.historical!.inspiration} · historically informed, fictional simulation.
          </p>}
        </div>
        <div className="score">
          <strong>
            {result.score}
            <small>%</small>
          </strong>
          <span>{result.success ? `RANK ${result.rank}` : result.outcome}</span>
        </div>
      </div>
      {result.finance && (
        <section className="panel mission-settlement">
          <div>
            <small>
              AGENCY SETTLEMENT
              {result.finance.practice
                ? " · TRAINING REPLAY · NO CASH CHANGES"
                : ""}
            </small>
            <h2>{money(result.finance.earned)} earned</h2>
            <p>
              Budget after mission{" "}
              <strong>{money(result.finance.after)}</strong>
            </p>
          </div>
          <table>
            <tbody>
              {[
                ["Agency Budget before", result.finance.before],
                ["Mission allocation", result.finance.allocation],
                ["Recovery underwriting", result.finance.assistance],
                ["Mission cost", -result.finance.cost],
                ["Base mission reward", result.finance.base],
                ["Optional challenge bonuses", result.finance.optional],
                ["Science bonus", result.finance.science],
                ["Resource-efficiency bonus", result.finance.efficiency],
                ["Equipment recovery bonus", result.finance.recovery],
                ["Insured hardware recovery", result.finance.insurance],
                ["Repair charge", -result.finance.repair],
                ["Agency Budget after", result.finance.after],
              ].map(([name, value]) => (
                <tr key={name as string}>
                  <th>{name}</th>
                  <td>{money(value as number)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
      <section className="panel campaign-optionals">
        <h2>Optional objectives</h2>
        {result.optionalResults.map((c) => (
          <p key={c.id}>
            {c.complete ? "✓" : "○"} {c.title} ·{" "}
            {c.complete && result.success
              ? `+${money(result.finance?.practice ? 0 : c.reward)}`
              : "No reward"}
          </p>
        ))}
        {result.unlocks.length > 0 && (
          <p>
            Technology unlocked:{" "}
            {result.unlocks.map((id) => technologies[id].name).join(", ")}
          </p>
        )}
      </section>
      <section className="campaign-report-grid">
        {[
          { name: "Mission success", value: result.success ? 100 : 0 },
          { name: "Science", value: result.science },
          { name: "Resource management", value: result.resources },
          { name: result.metricVersion === 2 ? "Spacecraft condition · v2" : "Legacy condition metric", value: result.condition },
          { name: "Crew readiness", value: result.crew },
          { name: "Power management", value: result.power },
          { name: "Fuel efficiency", value: result.fuel },
          { name: "Communications", value: result.communications },
        ].map((v) => (
          <article key={v.name}>
            <span>{v.name}</span>
            <strong>
              {Math.round(v.value)}
              <small>/100</small>
            </strong>
            <div className="cmd-gauge">
              <span style={{ width: `${v.value}%` }} />
            </div>
          </article>
        ))}
      </section>
      {snapshot ? <section className="panel">
        <h2>End-of-flight hardware snapshot</h2>
        <p>Condition v2 = mean physical component condition ({snapshot.componentMean.toFixed(2)}%) minus {snapshot.faultPenalty} points: 5 per unverified fault, active bus warning and broken camp connector. Equipment wear is listed separately and remains due for service.</p>
        <table><thead><tr><th>Component</th><th>Condition</th></tr></thead><tbody>
          {Object.entries(snapshot.components).map(([name, value]) => <tr key={name}><th>{name}</th><td>{value.toFixed(2)}%</td></tr>)}
        </tbody></table>
        <p>Unverified faults: {snapshot.unresolvedFaults.length ? snapshot.unresolvedFaults.map(f => `${faultCatalog[f.kind].name}${f.repaired ? " (replacement done; verification pending)" : ""}`).join("; ") : "none"}.</p>
        {snapshot.powerWarning && <p>Power bus warning remained active.</p>}
        {snapshot.campConnectorBroken && <p>Research camp connector remained faulted.</p>}
        <p>Equipment: {Object.entries(snapshot.equipment).map(([id, value]) => `${equipment[id as keyof typeof equipment].name} ${value!.toFixed(2)}%`).join("; ") || "none carried"}.</p>
        <p>Existing paid service estimates: components {money(snapshot.estimatedComponentService)}; equipment {money(snapshot.estimatedEquipmentService)}. These are maintenance estimates, separate from the agency settlement above; no repairs or extra charges were applied by this report.</p>
      </section> : <section className="panel"><p>Legacy report: the original condition metric and score are retained. Component, fault and equipment snapshots were not stored; present-day hardware has not been substituted.</p></section>}
      <ScientificReadings readings={result.measurements} />
      {!!result.sampleManifest?.length && (
        <section className="panel">
          <h2>Sample manifest</h2>
          {result.sampleManifest.map((v) => (
            <p key={v.id}>
              {v.kind} · {v.location || v.destination} ·{" "}
              {v.mass?.toFixed(2) || "—"} kg · {v.status || "Collected"} · value{" "}
              {v.scientificValue || "Unclassified"}
            </p>
          ))}
        </section>
      )}
      <div className="campaign-report-counts">
        <span>{result.experiments} experiments completed</span>
        <span>{result.samples} samples collected</span>
        <span>{result.optional} optional objectives completed</span>
        <span>{result.remaining.fuel.toFixed(1)} fuel units remaining</span>
        <span>{result.remaining.battery.toFixed(2)} kWh remaining</span>
        <span>{result.remaining.science.toFixed(0)} science collected</span>
        <span>{Math.floor(result.minutes)} mission minutes</span>
      </div>
      <div className="brief-grid">
        <section className="panel">
          <h3>What went well</h3>
          {result.good.map((t) => (
            <p key={t}>{t}</p>
          ))}
        </section>
        <section className="panel">
          <h3>For the next mission</h3>
          {(result.improve.length
            ? result.improve
            : ["Keep the same care with supplies and safety procedures."]
          ).map((t) => (
            <p key={t}>{t}</p>
          ))}
        </section>
      </div>
      <div className="actions">
        {result.success && onNext && <TouchActionButton className="primary" onActivate={onNext}>
          Next level in {campaignForMission(result.missionId)?.name} →
        </TouchActionButton>}
        {!result.success && onRetry && <TouchActionButton className="primary" onActivate={onRetry}>
          Retry this level →
        </TouchActionButton>}
        <TouchActionButton className="secondary" onActivate={onHome}>
          {result.success ? "Finish report · Return to campaign" : "Return to campaign · No next level unlocked"}
        </TouchActionButton>
      </div>
    </div>
  );
}
