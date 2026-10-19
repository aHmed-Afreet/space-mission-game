import { currentObjective, type Session } from "./engine";
import type { CampaignAction } from "./definitions";
export default function LaunchView({
  s,
  onCommand,
  onControls,
}: {
  s: Session;
  onCommand: (a: CampaignAction) => void;
  onControls: (throttle: number, pitch: number) => void;
}) {
  const f = s.flight,
    o = currentObjective(s),
    target = Math.max(25, 90 - f.altitude * 0.3);
  return (
    <div
      className={`campaign-launch ${f.status === "ascent" && !s.state.paused ? "firing" : ""}`}
      style={
        {
          "--altitude": Math.min(1, f.altitude / 180),
          "--thrust": f.throttle,
        } as React.CSSProperties
      }
    >
      <div className="launch-stars" aria-hidden="true" />
      <div className="launch-limb" aria-hidden="true" />
      <svg
        className="launch-vehicle"
        viewBox="0 0 200 460"
        role="img"
        aria-label={`Launch vehicle at ${f.altitude.toFixed(1)} kilometres`}
      >
        <defs>
          <linearGradient id="hull">
            <stop stopColor="#5b6c77" />
            <stop offset=".45" stopColor="#d7dfdb" />
            <stop offset="1" stopColor="#61737b" />
          </linearGradient>
          <linearGradient id="plume" x2="0" y2="1">
            <stop stopColor="#f5fbdf" />
            <stop offset=".4" stopColor="#e7a86c" />
            <stop offset="1" stopColor="#c4753b" stopOpacity="0" />
          </linearGradient>
        </defs>
        {f.status === "ascent" && (
          <path
            className="launch-plume"
            d="M79 335 Q70 390 100 458 Q128 390 121 335Z"
            fill="url(#plume)"
          />
        )}
        <g transform={`rotate(${(90 - f.pitch) * 0.13} 100 220)`}>
          <path
            d="M75 100Q78 65 100 40Q122 65 125 100L125 330H75Z"
            fill="url(#hull)"
          />
          <path d="M75 100H125V114H75ZM75 208H125V219H75Z" fill="#263940" />
          <rect x="91" y="121" width="18" height="28" rx="5" fill="#162731" />
          <path d="M95 124H105" stroke="#8fbec4" />
          <text
            x="100"
            y="190"
            textAnchor="middle"
            fontSize="8"
            fill="#20323a"
            transform="rotate(-90 100 190)"
          >
            ORBITAL / EXPLORER
          </text>
          {!f.separated && (
            <g>
              <path
                d="M75 265L50 320V343L75 330ZM125 265L150 320V343L125 330Z"
                fill="#455f6b"
              />
              <path d="M72 325H128L120 345H80Z" fill="#1d2e38" />
            </g>
          )}
          {f.separated && <path d="M78 321H122L115 338H85Z" fill="#253e4b" />}
        </g>
      </svg>
      <section className="launch-console">
        <small>
          FLIGHT DYNAMICS / {f.status === "pad" ? "LAUNCH SITE" : "ASCENT"}
        </small>
        <h2>
          {f.status === "pad"
            ? f.countdown >= 0
              ? `T−${Math.ceil(f.countdown)}`
              : "Flight is GO"
            : "Guide the ascent"}
        </h2>
        <div className="launch-telemetry">
          <span>
            ALTITUDE
            <strong>
              {f.altitude.toFixed(1)} <small>km</small>
            </strong>
          </span>
          <span>
            VELOCITY
            <strong>
              {f.velocity.toFixed(2)} <small>km/s</small>
            </strong>
          </span>
          <span>
            PROP RESERVE<strong>{s.state.fuel.toFixed(1)}</strong>
          </span>
          <span>
            STAGE<strong>{f.separated ? "UPPER" : "BOOSTER"}</strong>
          </span>
        </div>
        {f.status === "ascent" && (
          <>
            <label>
              Thrust <b>{Math.round(f.throttle * 100)}%</b>
              <input
                aria-label="Launch thrust"
                type="range"
                min="0"
                max="100"
                value={f.throttle * 100}
                disabled={s.state.paused}
                onChange={(e) =>
                  onControls(Number(e.target.value) / 100, f.pitch)
                }
              />
            </label>
            <label>
              Pitch{" "}
              <b>
                {Math.round(f.pitch)}° · guidance {Math.round(target)}°
              </b>
              <input
                aria-label="Launch pitch"
                type="range"
                min="0"
                max="90"
                value={f.pitch}
                disabled={s.state.paused}
                onChange={(e) => onControls(f.throttle, Number(e.target.value))}
              />
            </label>
            <div className="launch-guidance-meter">
              <span
                style={{
                  width: `${Math.max(5, 100 - Math.abs(target - f.pitch) * 2)}%`,
                }}
              />
            </div>
            <p>
              Thrust uses propellant. Following the pitch target improves climb
              efficiency. Separate the booster above 12 km, then reach 180 km
              and 7.8 km/s.
            </p>
          </>
        )}
        {o?.action ? (
          <button
            className="primary"
            disabled={s.state.paused}
            onClick={() => onCommand(o.action!)}
          >
            {o.title}
          </button>
        ) : (
          <p className="launch-live">{o?.title}</p>
        )}
        <small>SIMPLIFIED FLIGHT TRAINER · NOT A FLIGHT-PHYSICS MODEL</small>
      </section>
    </div>
  );
}
