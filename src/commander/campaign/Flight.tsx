import { useCallback, useEffect, useRef, useState } from "react";
import Cabin from "../Cabin";
import Icon from "../Icons";
import { nearby, deck, type Position } from "../layout";
import { missionTime } from "../MissionTablet";
import { alerts } from "../simulation";
import {
  currentObjective,
  currentPhase,
  sitePosition,
  atSite,
  outside,
  type Session,
  type Progress,
} from "./engine";
import { missionById, type CampaignAction, type Site } from "./definitions";
import { environments } from "./environments";
import CampaignTablet, { type CampaignTab } from "./CampaignTablet";
import Tutorial from "./Tutorial";
import Report from "./Report";
import type { VisualAction } from "../interior";
const baseStationActions: Partial<
  Record<keyof typeof deck, { action: CampaignAction; label: string }[]>
> = {
  cockpit: [{ action: "course", label: "Check trajectory" }],
  science: [{ action: "science", label: "Collect observations" }],
  communications: [{ action: "comms", label: "Restore radio / send data" }],
  power: [{ action: "repair", label: "Repair power unit" }],
  equipment: [{ action: "tools", label: "Collect toolkit" }],
  galley: [
    { action: "takeMeal", label: "Take meal pack" },
    { action: "fill", label: "Fill water bottle" },
    { action: "dispenser", label: "Use water dispenser" },
  ],
  sleep: [{ action: "sleep", label: "Rest in berth" }],
};
export default function Flight({
  session: s,
  progress,
  onMove,
  onTickPause,
  onCommand,
  onHome,
  onNext,
  onDismissTutorial,
  onResetTutorials,
  saveError,
}: {
  session: Session;
  progress: Progress;
  onMove: (p: Position) => void;
  onTickPause: (paused: boolean) => void;
  onCommand: (a: CampaignAction) => void;
  onHome: () => void;
  onNext?: () => void;
  onDismissTutorial: (id: string) => void;
  onResetTutorials: () => void;
  saveError: string;
}) {
  const [tablet, setTablet] = useState(false),
    [tab, setTab] = useState<CampaignTab>("MISSION"),
    [actions, setActions] = useState(false),
    [showOther, setShowOther] = useState(false),
    [tutorial, setTutorial] = useState<string | null>(null),
    [effect, setEffect] = useState<VisualAction>(),
    [toast, setToast] = useState(true);
  const resumedAfterGuide = useRef(false),
    lastTutorial = useRef(""),
    lastLog = useRef("");
  const m = missionById(s.missionId),
    o = currentObjective(s),
    area = nearby(s.position.x, s.position.z);
  const closeTablet = useCallback(() => setTablet(false), []);
  const move = useCallback((p: Position) => onMove(p), [onMove]);
  useEffect(() => {
    setActions(false);
    setShowOther(false);
  }, [area, s.objective]);
  useEffect(() => {
    setToast(true);
    const id = setTimeout(() => setToast(false), 4500);
    return () => clearTimeout(id);
  }, [s.notice, s.objective]);
  useEffect(() => {
    const t = o?.tutorial;
    if (
      !t ||
      progress.tutorials.includes(t) ||
      lastTutorial.current === t ||
      s.report
    )
      return;
    lastTutorial.current = t;
    resumedAfterGuide.current = !s.state.paused;
    onTickPause(true);
    setTutorial(t);
  }, [o?.tutorial, progress.tutorials, s.report]);
  useEffect(() => {
    const log = s.state.log[s.state.log.length - 1];
    if (log !== lastLog.current) {
      lastLog.current = log;
      const action = o?.action;
      if (
        action &&
        ["eat", "drink", "takeMeal", "fill", "dispenser", "repair"].includes(
          action,
        )
      )
        setEffect((v) => ({
          id: (v?.id || 0) + 1,
          action: action as VisualAction["action"],
        }));
    }
  }, [s.state.log]);
  const run = (a: CampaignAction) => {
    onCommand(a);
    setActions(false);
    if (["eat", "drink", "fill", "takeMeal", "repair"].includes(a))
      setEffect((v) => ({
        id: (v?.id || 0) + 1,
        action: a as VisualAction["action"],
      }));
  };
  if (s.report)
    return (
      <Report
        result={s.report}
        onHome={onHome}
        onNext={s.report.success ? onNext : undefined}
      />
    );
  const target = o?.site ? sitePosition(o.site, m.destination) : undefined;
  const actionable = !!o?.action && (!o.site || atSite(s, o.site));
  const inventoryTask = o?.action === "eat" || o?.action === "drink";
  const extras = area
    ? baseStationActions[area] || []
    : outside(s)
      ? ([
          { action: "scan", label: "Use geological scanner" },
          { action: "sample", label: "Collect sample" },
          { action: "photo", label: "Take field photograph" },
          { action: "measureTemperature", label: "Measure temperature" },
          { action: "measureRadiation", label: "Measure radiation" },
        ] as { action: CampaignAction; label: string }[])
      : [];
  return (
    <div className="cmd-session campaign-flight">
      <Cabin
        key={s.id}
        onArea={() => {}}
        onPosition={move}
        onInteract={() => {
          if (inventoryTask) {
            setTab("INVENTORY");
            setTablet(true);
          } else setActions((v) => !v);
        }}
        onGraphicsError={() => onTickPause(true)}
        locked={s.state.paused || s.state.sleeping || tablet || !!tutorial}
        alarm={alerts(s.state).length > 0 || s.camp.broken}
        effect={effect}
        telemetry={{
          ...s.state,
          oxygenCapacity: s.life.oxygen,
          batteryCapacity: s.life.batteries,
        }}
        world={{
          session: s,
          waypoint: target ? { ...target, name: target.name } : undefined,
          target:
            o?.site && o.site in deck ? (o.site as keyof typeof deck) : null,
        }}
      />
      <div className="cmd-cinema-shade" aria-hidden="true" />
      <div className="cmd-hud-header">
        <div className="cmd-flight-identity">
          <span className="cmd-orbital-emblem">✦</span>
          <div>
            <strong>
              ORBITAL<span>MISSION LAB</span>
            </strong>
            <small>
              {environments[m.destination].name.toUpperCase()} /{" "}
              {currentPhase(s)}
            </small>
          </div>
        </div>
        <div className="cmd-flight-time">
          <small>MISSION ELAPSED</small>
          <strong>T+ {missionTime(s.state.minutes)}</strong>
          <span>
            <i />
            {s.state.paused ? "PAUSED" : "LIVE"}
          </span>
        </div>
        <div className="cmd-hud-actions">
          <button
            className="cmd-icon-button"
            aria-label={s.state.paused ? "Resume mission" : "Pause mission"}
            onClick={() => onTickPause(!s.state.paused)}
          >
            <Icon name={s.state.paused ? "play" : "pause"} />
          </button>
          <button
            className="cmd-tablet-trigger"
            aria-label="Open mission tablet"
            aria-expanded={tablet}
            onClick={() => {
              setTablet(true);
              setActions(false);
            }}
          >
            <Icon name="tablet" />
            <span>MISSION TABLET</span>
          </button>
        </div>
      </div>
      <div className="campaign-guidance">
        <small>
          {m.title.toUpperCase()} / LEVEL {m.level}
        </small>
        <span>
          CURRENT TASK{" "}
          <b>
            {Math.min(s.objective + 1, m.objectives.length)} /{" "}
            {m.objectives.length}
          </b>
        </span>
        <h2>{o?.title}</h2>
        <div className="cmd-objective-progress">
          <span
            style={{ width: `${(s.objective / m.objectives.length) * 100}%` }}
          />
        </div>
        {o?.count && (
          <p>
            {s.repetitions} / {o.count} complete
          </p>
        )}
        <button
          onClick={() => {
            setTab("MISSION");
            setTablet(true);
          }}
        >
          Mission steps <Icon name="chevron" size={12} />
        </button>
      </div>
      {s.state.paused && !tutorial && !tablet && (
        <div className="campaign-paused">
          <span>MISSION PAUSED</span>
          <button onClick={() => onTickPause(false)}>Resume →</button>
          <button onClick={onHome}>Save & campaign</button>
        </div>
      )}
      {saveError && (
        <button
          className="campaign-save-warning"
          onClick={() => {
            setTab("LOG");
            setTablet(true);
          }}
        >
          Save warning — open tablet
        </button>
      )}
      <div className="campaign-interaction">
        {actions && (
          <div className="cmd-action-menu">
            {actionable && o?.action && !inventoryTask && (
              <button disabled={s.state.paused} onClick={() => run(o.action!)}>
                {o.title}
                <Icon name="chevron" size={14} />
              </button>
            )}
            <button onClick={() => setShowOther((v) => !v)}>
              {showOther ? "Hide" : "Other"} operations
            </button>
            {showOther &&
              extras.map((a) => (
                <button
                  disabled={s.state.paused}
                  key={a.action}
                  onClick={() => run(a.action)}
                >
                  {a.label}
                  <Icon name="chevron" size={13} />
                </button>
              ))}
          </div>
        )}
        {(actionable || area || outside(s)) && !tablet && !s.state.sleeping && (
          <button
            className="cmd-interaction-prompt"
            disabled={s.state.paused}
            aria-expanded={actions}
            onClick={() => {
              if (inventoryTask) {
                setTab("INVENTORY");
                setTablet(true);
              } else setActions((v) => !v);
            }}
          >
            <kbd>E</kbd>
            <span>
              {inventoryTask ? "INVENTORY" : "INTERACT"}
              <strong>
                {inventoryTask
                  ? "Use your carried supplies"
                  : actionable && target
                    ? target.name
                    : area
                      ? deck[area].name
                      : "Field equipment"}
              </strong>
            </span>
            <Icon name="chevron" size={15} />
          </button>
        )}
      </div>
      {s.state.sleeping && (
        <div className="cmd-rest-card">
          <Icon name="sleep" size={30} />
          <small>REST CYCLE</small>
          <h2>Rest & recover.</h2>
          <p>Energy {s.state.energy.toFixed(0)}% · time continues</p>
          {o?.action === "wake" ? (
            <button disabled={s.state.paused} onClick={() => run("wake")}>
              Wake up →
            </button>
          ) : (
            <p>{o?.title}</p>
          )}
        </div>
      )}
      {toast && !tablet && !tutorial && (
        <div className="campaign-notice" role="status">
          <Icon name="check" size={14} />
          <span>{s.notice}</span>
        </div>
      )}
      <div className="campaign-footer-vitals">
        <span>
          <Icon name="oxygen" size={16} /> O₂{" "}
          {(outside(s) ? s.suit.oxygen : s.state.oxygen).toFixed(2)} kg
        </span>
        <span>
          <Icon name="power" size={16} />{" "}
          {Math.round(
            (outside(s) ? s.suit.power : s.state.battery / s.life.batteries) *
              100,
          )}
          %
        </span>
        <span>
          <Icon name="crew" size={16} /> {Math.round(s.state.energy)}%
        </span>
      </div>
      {tablet && (
        <CampaignTablet
          s={s}
          progress={progress}
          tab={tab}
          onTab={setTab}
          onClose={closeTablet}
          onCommand={run}
          onHome={onHome}
          onResetTutorials={() => {
            lastTutorial.current = "";
            onResetTutorials();
          }}
          saveError={saveError}
        />
      )}
      {tutorial && (
        <div className="campaign-tutorial-layer">
          <Tutorial
            id={tutorial}
            onClose={() => {
              onDismissTutorial(tutorial);
              setTutorial(null);
              if (resumedAfterGuide.current) onTickPause(false);
            }}
          />
        </div>
      )}
    </div>
  );
}
