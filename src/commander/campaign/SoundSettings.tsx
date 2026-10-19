import { useState } from "react";
import { sound } from "./audio";
export default function SoundSettings() {
  const [value, setValue] = useState(sound.settings);
  return (
    <details className="ship-sound-settings">
      <summary>Sound & ambience settings</summary>
      <p>
        Original procedural audio. Tap Enable audio if your browser has
        suspended sound.
      </p>
      <button onClick={() => sound.unlock()}>Enable audio</button>
      <label>
        <input
          type="checkbox"
          checked={value.mute}
          onChange={(e) => {
            sound.configure({ mute: e.target.checked });
            setValue(sound.settings());
          }}
        />
        Mute all audio
      </label>
      {(["effects", "ambient", "radio"] as const).map((key) => (
        <label key={key}>
          {key.toUpperCase()} · {Math.round(value[key] * 100)}%
          <input
            aria-label={key + " volume"}
            type="range"
            min="0"
            max="100"
            value={value[key] * 100}
            onChange={(e) => {
              sound.configure({ [key]: Number(e.target.value) / 100 });
              setValue(sound.settings());
            }}
          />
        </label>
      ))}
    </details>
  );
}
