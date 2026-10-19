import type { Report as Result } from "./engine";
import { missionById } from "./definitions";
export default function Report({
  result,
  onHome,
  onNext,
}: {
  result: Result;
  onHome: () => void;
  onNext?: () => void;
}) {
  return (
    <div className="campaign-report">
      <div className="campaign-report-title">
        <div>
          <span className="eyebrow">
            MISSION REPORT / LEVEL {missionById(result.missionId).level}
          </span>
          <h1>
            {result.success ? "Mission complete." : "Mission aborted."}
          </h1>
          <p>{missionById(result.missionId).title}</p>
        </div>
        <div className="score">
          <strong>
            {result.score}
            <small>%</small>
          </strong>
          <span>{result.success ? `RANK ${result.rank}` : "SAFETY ABORT"}</span>
        </div>
      </div>
      <section className="campaign-report-grid">
        {[
          { name: "Mission success", value: result.success ? 100 : 0 },
          { name: "Science", value: result.science },
          { name: "Resource management", value: result.resources },
          { name: "Spacecraft condition", value: result.condition },
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
      <div className="campaign-report-counts">
        <span>{result.experiments} experiments completed</span>
        <span>{result.samples} samples collected</span>
        <span>No optional objectives assigned</span>
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
        <button className="secondary" onClick={onHome}>
          Campaign overview
        </button>
        {onNext && (
          <button className="primary" onClick={onNext}>
            Next level unlocked →
          </button>
        )}
      </div>
    </div>
  );
}
