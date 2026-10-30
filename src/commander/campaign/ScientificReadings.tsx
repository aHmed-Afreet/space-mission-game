import type { ScientificMeasurement } from "./scientificResults";

export default function ScientificReadings({ readings, compact = false }: {
  readings?: ScientificMeasurement[];
  compact?: boolean;
}) {
  return <section className="panel" aria-label="Simulated scientific observations">
    <h2>Simulated observations</h2>
    <p>Training instrument model v1. Numeric results are synthetic; NASA links provide scientific background.</p>
    {!readings?.length ? <p>No structured readings were retained. Legacy experiment names remain in the flight record; numeric data has not been reconstructed.</p> :
      <div style={compact ? { maxHeight: "18rem", overflowY: "auto" } : undefined}>
        {readings.map(r => <details key={r.id}>
          <summary>{r.quantity}: {Number(r.value.toFixed(3))} {r.unit} · {r.transmission}</summary>
          <p>{r.instrument} · {r.target} · {r.site} · T+{r.minute.toFixed(2)} min</p>
          <p>Uncertainty: ±{r.uncertainty} {r.unit} · quality {r.quality} · hardware {r.calibration.condition.toFixed(2)}%</p>
          <p>Calibration / control: {r.calibration.control}</p>
          {r.assumptions.map((text, i) => <p key={i}>{text}</p>)}
          <p>Transmission: {r.transmission}{r.queuedAt !== undefined ? ` · queued T+${r.queuedAt.toFixed(2)} min` : ""}{r.acknowledgedAt !== undefined ? ` · acknowledged T+${r.acknowledgedAt.toFixed(2)} min` : ""}.</p>
          {r.sources.map((source, i) => <p key={i}><a href={source.url} target="_blank" rel="noopener noreferrer">{source.title}</a></p>)}
        </details>)}
      </div>}
  </section>;
}
