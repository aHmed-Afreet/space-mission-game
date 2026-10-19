import { money, technologies } from "./economy";
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
            MISSION REPORT / MISSION {missionById(result.missionId).level}
          </span>
          <h1>
            {result.success
              ? "Mission complete."
              : result.outcome === "PARTIAL SUCCESS"
                ? "Partial success."
                : "Mission failed."}
          </h1>
          <p>{missionById(result.missionId).title}</p>
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
        <button className="secondary" onClick={onHome}>
          Return to Mission Control
        </button>
      </div>
    </div>
  );
}
