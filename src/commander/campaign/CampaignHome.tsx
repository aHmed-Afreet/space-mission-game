import { chapters, missions, type MissionDefinition } from "./definitions";
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
  onResume,
  onLegacy,
  onExit,
}: {
  progress: Progress;
  session: Session | null;
  legacy: boolean;
  warning: string;
  readOnly: boolean;
  onSelect: (m: MissionDefinition) => void;
  onResume: () => void;
  onLegacy: () => void;
  onExit: () => void;
}) {
  return (
    <div className="campaign-home">
      <div className="campaign-nav">
        <button onClick={onExit}>← Choose mode</button>
        <span>ORBITAL / MISSION LAB</span>
        <small>LOCAL CAMPAIGN SAVE</small>
      </div>
      <section className="campaign-hero">
        <span className="eyebrow">COMMANDER CAMPAIGN</span>
        <h1>Your next frontier.</h1>
        <p>
          Learn the spacecraft. Walk on the Moon. Build a working science camp.
          <br />
          Finish each level to unlock the next one.
        </p>
        <div className="campaign-totals">
          <span>
            <strong>{Object.keys(progress.completed).length}</strong> LEVELS
            COMPLETE
          </span>
          <span>
            <strong>{missions.filter((m) => m.implemented).length}</strong>{" "}
            PLAYABLE LEVELS
          </span>
          <span>
            <strong>{chapters.length}</strong> CHAPTERS
          </span>
        </div>
      </section>
      {warning && <p className="cmd-alert caution">{warning}</p>}
      {session && (
        <section className="campaign-resume">
          <div>
            <small>SAVED MISSION</small>
            <h2>{missions.find((m) => m.id === session.missionId)?.title}</h2>
            <p>
              {session.report
                ? "Review the report to continue."
                : `Task ${session.objective + 1} of ${missions.find((m) => m.id === session.missionId)?.objectives.length}. Progress is preserved.`}
            </p>
          </div>
          <button onClick={onResume}>Resume mission →</button>
        </section>
      )}
      {chapters.map((ch, i) => (
        <section className="campaign-chapter" key={ch.id}>
          <div className="campaign-chapter-heading">
            <span>0{i + 1}</span>
            <div>
              <h2>{ch.title}</h2>
              <p>{ch.subtitle}</p>
            </div>
            {!missions.some((m) => m.chapter === ch.id && m.implemented) && (
              <small>IN DEVELOPMENT / NOT PLAYABLE</small>
            )}
          </div>
          <div className="campaign-missions">
            {missions
              .filter((m) => m.chapter === ch.id)
              .map((m) => {
                const completed = progress.completed[m.id],
                  ready = canStart(m, progress);
                return (
                  <article
                    key={m.id}
                    className={`${completed ? "complete" : ready ? "ready" : "locked"} ${session?.missionId === m.id ? "current" : ""}`}
                  >
                    <div>
                      <small>LEVEL {String(m.level).padStart(2, "0")}</small>
                      <span>
                        {completed
                          ? "✓ COMPLETE"
                          : !m.implemented
                            ? "PLANNED"
                            : ready
                              ? "AVAILABLE"
                              : "🔒 LOCKED"}
                      </span>
                    </div>
                    <h3>{m.title}</h3>
                    <span className="campaign-destination">
                      <Icon name="target" size={13} />
                      {environments[m.destination].name}
                    </span>
                    <p>{m.majorObjective}</p>
                    <footer>
                      <span>
                        {completed
                          ? `BEST ${completed.score} / 100 · RANK ${completed.rank}`
                          : !m.implemented
                            ? "Not implemented in this release."
                            : ready
                              ? "Ready for preparation."
                              : `Complete Level ${m.level - 1} first.`}
                      </span>
                      <button
                        disabled={!ready || readOnly}
                        onClick={() => onSelect(m)}
                      >
                        {completed ? "Replay" : ready ? "Prepare" : "Locked"}
                        <Icon name="chevron" size={13} />
                      </button>
                    </footer>
                  </article>
                );
              })}
          </div>
        </section>
      ))}
      {legacy && (
        <section className="campaign-legacy">
          <h3>Previous readiness sortie</h3>
          <p>
            Your earlier six-hour mission is preserved. It does not unlock
            campaign levels.
          </p>
          <button onClick={onLegacy}>Continue previous sortie</button>
        </section>
      )}
      <p className="cmd-footnote">
        Earth-orbit and lunar levels are playable. Mars and deep-space chapters
        are definitions for future updates, not playable simulations.
      </p>
    </div>
  );
}
