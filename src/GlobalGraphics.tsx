import { useState } from "react";
import { initializePreferences, type PlayerPreferences } from "./commander/campaign/preferences";
import "./globalGraphics.css";

/** Uses the existing settings key; never touches a mission or progress record. */
export default function GlobalGraphics() {
  const [settings] = useState(() => {
    try { return initializePreferences(window.localStorage); }
    catch { return initializePreferences(); }
  });
  const [value, setValue] = useState(settings.value);
  const [warning, setWarning] = useState(settings.warning);
  function change(graphics: PlayerPreferences["graphics"]) {
    const next = { ...value, graphics };
    setValue(next);
    setWarning(settings.save(next));
  }
  return <details className="global-graphics">
    <summary>Graphics <span aria-hidden="true">⌄</span></summary>
    <div className="global-graphics-panel">
      <label htmlFor="global-graphics-preset">Rendering quality</label>
      <select id="global-graphics-preset" value={value.graphics}
        onChange={event => change(event.target.value as PlayerPreferences["graphics"])}>
        <option value="battery">Battery · reduced resolution</option>
        <option value="balanced">Balanced · recommended for iPad</option>
        <option value="quality">Quality · higher resolution</option>
      </select>
      <p>Applies when you enter a scene. Lower quality reduces GPU load; mission systems stay the same.</p>
      {warning && <p role="status">{warning}</p>}
    </div>
  </details>;
}
