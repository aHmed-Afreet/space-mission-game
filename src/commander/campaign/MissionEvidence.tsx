import type { Design } from "../../game";
import type { Destination } from "./environments";
import { designTradeoffs, type GameMetrics } from "./missionScience";
import "./missionEvidence.css";

/** Visible, live comparison of real NASA reference measurements and game rules.
 * No telemetry or external API call is required; sources open in a separate tab.
 */
export default function MissionEvidence({
  destination, design, metrics,
}: {destination:Destination; design:Design; metrics:GameMetrics}) {
  const info=designTradeoffs(destination,design,metrics);
  const {facts}=info;
  return <section className="mission-science-panel" aria-label="Science and engineering decision lab">
    <div className="mission-science-heading">
      <div>
        <small>ENGINEERING EVIDENCE · NASA SOURCES + GAME MODEL</small>
        <h2>Mission Decision Lab</h2>
        <p>Change spacecraft hardware or rocket above/below to see the live trade-offs. Facts and simulated estimates are kept separate.</p>
      </div>
      <span aria-hidden="true">◉</span>
    </div>
    <div className="mission-science-columns">
      <section className="mission-science-facts">
        <h3>Observed science · {facts.name}</h3>
        <dl>
          <div><dt>Solar energy at 1 AU</dt><dd>1,361 W/m² · NASA reference</dd></div>
          <div><dt>Local reference sunlight</dt><dd>{facts.irradianceWm2===null
            ?"No fixed value — target distance unknown"
            :`~${Math.round(facts.irradianceWm2).toLocaleString()} W/m² (ideal, unshadowed)`}</dd></div>
          <div><dt>One-way radio delay</dt><dd>{facts.communication}</dd></div>
          <div><dt>Gravity context</dt><dd>{facts.gravity}</dd></div>
        </dl>
        <p className="mission-science-caveat">{facts.caveat}</p>
        <div className="mission-science-sources">
          <strong>Verify with official references</strong>
          {facts.sources.map((url,i)=><a key={url} href={url} target="_blank" rel="noopener noreferrer">
            NASA reference {i+1} ↗</a>)}
        </div>
      </section>
      <section className="mission-science-game">
        <h3>Live game engineering · current design</h3>
        <div className="mission-science-metrics" aria-live="polite">
          <div><small>Payload headroom</small><strong className={info.capacityMargin<0?"mission-science-negative":""}>{info.capacityMargin.toFixed(0)} kg</strong></div>
          <div><small>Budget headroom</small><strong className={info.budgetMargin<0?"mission-science-negative":""}>{info.budgetMargin.toFixed(0)} M credits</strong></div>
          <div><small>Game power margin</small><strong className={metrics.power<10?"mission-science-negative":""}>{metrics.power.toFixed(0)} W</strong></div>
          <div><small>Game fuel reserve</small><strong className={metrics.fuel<10?"mission-science-negative":""}>{metrics.fuel.toFixed(0)} units</strong></div>
        </div>
        <p className="mission-science-comparison">Installed solar panels: <b>{Math.max(0,Number(design.counts.solar||0))}</b> · game catalog nominal output at Earth: <b>{info.arrayAtEarth.toFixed(0)} W</b>.
          {info.atDestination!==null && <> At reference solar distance: <b>~{info.atDestination.toFixed(0)} W</b> under the same idealized panel assumptions.</>}
        </p>
        <p>{info.note}</p>
        {info.risks.length>0
          ?<div className="mission-science-warnings"><strong>Design adjustments needed</strong><ul>{info.risks.map(r=><li key={r}>{r}</li>)}</ul></div>
          :<p className="mission-science-ready">✓ Within these four game resource thresholds. Check all preflight requirements before launch.</p>}
      </section>
    </div>
    <p className="mission-science-legal">Important: NASA numbers are cited educational references, not a live mission dataset. Rocket costs, power, fuel, scores, life-support rates, mission times and risk are simplified fictional gameplay—not validated mission predictions or NASA endorsement.</p>
  </section>;
}
