import { sound } from "./audio";
import StationControls from "./StationControls";
import RendezvousConsole from "./RendezvousConsole";
import { objectiveGuide } from "./objectiveGuide";
import { doors, shipAlerts, type WorldAction } from "./ship";
import LaunchView from "./LaunchView";
import { useCallback, useEffect, useRef, useState } from "react";
import Cabin, { type AimTarget } from "../Cabin";
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
import NavigationMap from "./NavigationMap";
import Tutorial from "./Tutorial";
import Report from "./Report";
import type { VisualAction } from "../interior";
import type { PlayerPreferences } from "./preferences";
const baseStationActions: Partial<
  Record<keyof typeof deck, { action: CampaignAction; label: string }[]>
> = {
  cockpit: [
    { action: "course", label: "Verify navigation / apply course correction" },
    { action: "verifyFuel", label: "Inspect fuel reserve" },
    { action: "sealHatch", label: "Seal launch vehicle" },
    { action: "armLaunch", label: "Arm launch countdown" },
    { action: "approach", label: "Begin destination approach" },
    { action: "land", label: "Execute lunar landing" },
    { action: "returnBurn", label: "Commit return burn" },
    { action: "recoverVehicle", label: "Confirm recovery" },
  ],
  science: [
    { action: "inspectScience", label: "Inspect instruments and results" },
    { action: "science", label: "Acquire science observation" },
  ],
  communications: [
    { action: "inspectComms", label: "Inspect Earth link and antenna status" },
    { action: "comms", label: "Check link / transmit available science" },
    { action: "verifyRadio", label: "Record launch radio check" },
  ],
  power: [
    { action: "inspectPower", label: "Inspect power and diagnose faults" },
    {
      action: "inspectLife",
      label: "Inspect life support and cabin environment",
    },
    { action: "verifyPower", label: "Record electrical readiness" },
    { action: "repair", label: "Repair diagnosed power fault" },
    { action: "powerSafe", label: "Use power conservation plan" },
    { action: "powerScience", label: "Run high-resolution observation" },
    { action: "eventReroute", label: "Bypass diagnosed power fault" },
  ],
  equipment: [
    { action: "inspectEquipment", label: "Inspect equipment storage" },
    { action: "tools", label: "Collect repair toolkit" },
    { action: "packEquipment", label: "Collect prepared field equipment" },
    { action: "equipSuit", label: "Equip EVA suit" },
    { action: "checkOxygen", label: "Check suit oxygen" },
    { action: "checkPower", label: "Check suit battery" },
  ],
  galley: [
    { action: "inspectStorage", label: "Inspect food and water stores" },
    { action: "takeMeal", label: "Collect meal pack" },
    { action: "fill", label: "Fill water bottle" },
    { action: "dispenser", label: "Drink at water dispenser" },
    { action: "verifyLife", label: "Record life-support readiness" },
  ],
  sleep: [{ action: "sleep", label: "Rest in crew berth" }],
};
export default function Flight({
  session: s,
  device = "ipad",
  preferences,
  onSettings = () => {},
  progress,
  onMove,
  onTickPause,
  onCommand,
  onHome,
  onNext,
  onDismissTutorial,
  onResetTutorials,
  saveError,
  onOptional,
  onRate,
  onControls,
  onAbort,
  onWorld = () => {},
}: {
  onWorld?: (a: WorldAction) => void;
  onOptional: (id: string) => void;
  onRate: (rate: number) => void;
  onControls: (throttle: number, pitch: number) => void;
  onAbort: () => void;
  session: Session;
  device?: "ipad" | "iphone" | "laptop";
  preferences?: PlayerPreferences;
  onSettings?: () => void;
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
    [navOpen, setNavOpen] = useState(false),
    [showOther, setShowOther] = useState(false),
    [tutorial, setTutorial] = useState<string | null>(null),
    [effect, setEffect] = useState<VisualAction>(),
    [toast, setToast] = useState(true),
    [hatchNotice,setHatchNotice] = useState(""),
    [rendezvousOpen,setRendezvousOpen] = useState(false),
    [helpOpen,setHelpOpen] = useState(false),
    [guideFeedback,setGuideFeedback] = useState("");
  const attemptedCommand = useRef<{ objective: number; session: Session } | null>(null);
  const resumedAfterGuide = useRef(false),
    lastTutorial = useRef(""),
    lastLog = useRef("");
  const m = missionById(s.missionId),
    o = currentObjective(s),
    guide = objectiveGuide(s),
    area = nearby(s.position.x, s.position.z);
  const audioPosition = useRef(s.position),
    audioDoors = useRef(""),
    audioRadio = useRef(0);
  useEffect(() => {
    const unlock = () => void sound.unlock();
    document.addEventListener("pointerdown", unlock, { once: true });
    return () => {
      document.removeEventListener("pointerdown", unlock);
      sound.environment(false, false);
      sound.suspend();
    };
  }, []);
  useEffect(() => {
    sound.environment(s.flight.status === "ascent", outside(s));
    const before = audioPosition.current;
    if (
      Math.hypot(s.position.x - before.x, s.position.z - before.z) > 0.9 &&
      !s.state.paused
    ) {
      sound.play("step");
      audioPosition.current = s.position;
    }
    const key = JSON.stringify([s.world.doors, s.world.lockers]);
    if (audioDoors.current && audioDoors.current !== key) sound.play("hatch");
    audioDoors.current = key;
    if (
      s.world.messages.length > audioRadio.current &&
      s.world.messages.at(-1)?.source === "MISSION CONTROL"
    )
      sound.play("radio");
    audioRadio.current = s.world.messages.length;
  }, [s.position, s.world, s.flight.status]);
  useEffect(() => {
    if (document.hidden || s.state.paused) return;
    const id = setInterval(() => {
      if (outside(s)) sound.play("breath");
      if (
        shipAlerts(s).some(
          (a) => a.level === "WARNING" || a.level === "EMERGENCY",
        )
      )
        sound.play("warning");
    }, 4000);
    return () => clearInterval(id);
  }, [s.state.paused, s.position.z, s.world.faults]);
  const closeTablet = useCallback(() => setTablet(false), []);
  const move = useCallback((p: Position) => onMove(p), [onMove]);
  useEffect(() => {
    setActions(false);
    setShowOther(false);
    setGuideFeedback("");
    setHelpOpen(false); // Free the movement area whenever the player moves to another station or objective.
  }, [area, s.objective]);
  useEffect(() => {
    const previous = attemptedCommand.current;
    if (!previous || previous.session === s) return;
    attemptedCommand.current = null;
    const blocked = s.objective === previous.objective;
    setGuideFeedback(blocked
      ? s.notice || "The task did not advance. Check the requirements above and try again."
      : "");
    if (blocked) setHelpOpen(true); // Explain failures instead of hiding the instructions.
  }, [s]);
  // Close only after the actual campaign objective advances.
  useEffect(() => {
    if (rendezvousOpen && (m.id !== "mission-2" || o?.action !== "approach"))
      setRendezvousOpen(false);
  }, [rendezvousOpen, m.id, o?.action]);
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
    void sound.unlock();
    sound.play(a === "comms" ? "radio" : a === "science" ? "science" : "click");
    attemptedCommand.current = { objective: s.objective, session: s };
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
  const launching =
    s.flight.status === "ascent" ||
    (s.flight.status === "pad" && s.flight.countdown >= 0) ||
    (currentPhase(s) === "LAUNCH" && s.flight.status === "pad");
  const actionable = !!o?.action && (!o.site || atSite(s, o.site));
  const inventoryTask = o?.action === "eat" || o?.action === "drink";
  const extras = area
    ? [...(baseStationActions[area] || [])]
    : outside(s)
      ? ([
          ...(atSite(s, "camp")
            ? [
                { action: "inspectCamp", label: "Inspect camp systems" },
                { action: "deployShelter", label: "Deploy instrument shelter" },
                { action: "deploySolar", label: "Deploy solar array" },
                { action: "deployBattery", label: "Connect camp battery" },
                { action: "deployAntenna", label: "Deploy antenna" },
                { action: "deploySensor", label: "Deploy sensor" },
                { action: "deployStorage", label: "Deploy sample store" },
                { action: "experiment", label: "Run powered experiment" },
                { action: "storeSamples", label: "Store carried samples" },
                {
                  action: "repairCamp",
                  label: "Repair diagnosed camp connector",
                },
                { action: "campTransmit", label: "Transmit camp science" },
                { action: "selectCamp", label: "Choose sheltered camp site" },
                { action: "alignSolar", label: "Choose sunlit camp site" },
              ]
            : []),
          ...(m.id === "mission-2" && atSite(s, "survey")
            ? [
                {
                  action: "diagnoseSatellite",
                  label: "Inspect satellite service panel",
                },
                {
                  action: "repairSatellite",
                  label: "Replace satellite connector",
                },
                { action: "testSatellite", label: "Test satellite radio" },
              ]
            : []),
          { action: "drill", label: "Drill subsurface sample" },
          { action: "scan", label: "Use geological scanner" },
          { action: "sample", label: "Collect sample" },
          { action: "photo", label: "Take field photograph" },
          { action: "measureTemperature", label: "Measure temperature" },
          { action: "measureRadiation", label: "Measure radiation" },
        ] as { action: CampaignAction; label: string }[])
      : [];
  if (m.eva && (atSite(s, "airlock") || atSite(s, "innerHatch") || atSite(s, "outerHatch")))
    extras.push(
      ...([
        { action: "openInner", label: "Open cabin hatch" },
        { action: "closeInner", label: "Close cabin hatch" },
        { action: "vent", label: "Depressurize airlock" },
        { action: "openOuter", label: "Open exterior hatch" },
        { action: "closeOuter", label: "Close exterior hatch" },
        { action: "pressurize", label: "Repressurize airlock" },
      ] as { action: CampaignAction; label: string }[]),
    );
  const openRendezvous = () => {
    if (s.state.paused) {
      onTickPause(false);
      setHatchNotice("Mission resumed. Press the navigation button again.");
      return;
    }
    if (!atSite(s, "cockpit")) {
      setHatchNotice("Move to the Flight deck navigation console first. Use MAP to locate the Flight deck.");
      return;
    }
    if (s.state.sleeping || tablet || tutorial || navOpen) {
      setHatchNotice("Close other panels and wake up before opening the navigation computer.");
      return;
    }
    setRendezvousOpen(true);
    setHatchNotice("");
    setActions(false);
  };
  const handleWork = (target: AimTarget | null) => {
    if(s.state.paused){
      // The saved game may load paused. INTERACT is not silently swallowed.
      onTickPause(false);
      return;
    }
    if (s.state.sleeping || tablet || navOpen || tutorial) return;
    // Rendezvous is the active flight-deck task: touch any instrument on
    // the console or INTERACT while standing there. Never require finding
    // an invisible point behind the numerous physical monitor bezels.
    if(m.id==="mission-2"&&o?.action==="approach"&&atSite(s,"cockpit")){
      openRendezvous();return;
    }
    if(target?.kind==="airlock"){
      if(!m.eva){
        setHatchNotice("The rear pressure hatch is secured because this spacecraft is not EVA-equipped. To reach Communications, use the illuminated controls on the three interior section doors.");
        return;
      }
      setHatchNotice("");
      const id=target.id,lock=s.airlock;
      if(id==="inner"){
        if(lock.inner)run("closeInner");
        else if(lock.pressure<100)run("pressurize");
        else run("openInner");
      }else{
        if(lock.outer)run("closeOuter");
        else if(lock.pressure>0)run("vent");
        else run("openOuter");
      }
      setActions(false);return;
    }
    if (target?.kind === "door") {
      const door=doors[target.id as keyof typeof doors];
      if(Math.abs(s.position.z-door.z)>1.6||Math.abs(s.position.x)>1.5){
        setHatchNotice("Move closer to the illuminated hatch control on your side of the door, then press INTERACT.");
        return;
      }
      setHatchNotice("");
      onWorld({ kind: "door", id: target.id as keyof typeof doors });
      setActions(false);
      return;
    }
    if (target?.kind === "locker") {
      onWorld({ kind: "locker", id: target.id as keyof Session["world"]["lockers"] });
      setActions(true);
      return;
    }
    if (target?.kind === "station" || outside(s)) setActions(v => !v);
  };
  const openTab = (value: CampaignTab) => {
    setNavOpen(false);
    setTab(value);
    setTablet(true);
    setActions(false);
  };
  return (
    <div
      className={`cmd-session campaign-flight ${launching ? "launch-active" : ""}`}
    >
      {launching ? (
        <LaunchView s={s} onCommand={run} onControls={onControls} />
      ) : (
        <Cabin
          key={s.id}
          onArea={() => {}}
          onPosition={move}
          device={device}
          settings={preferences}
          onInteract={handleWork}
          onGraphicsError={() => onTickPause(true)}
          locked={s.state.paused || s.state.sleeping || tablet || navOpen || !!tutorial || rendezvousOpen}
          alarm={shipAlerts(s).some(
            (a) => a.level === "WARNING" || a.level === "EMERGENCY",
          )}
          effect={effect}
          telemetry={{
            ...s.state,
            oxygenCapacity: s.life.oxygen,
            batteryCapacity: s.life.batteries,
          }}
          world={{
            session: s,
            target: undefined,
          }}
        />
      )}
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
            className="commander-hud-tool"
            aria-label="Open mission objectives"
            onClick={() => openTab("MISSION")}
          >
            <Icon name="target" />
            <span>MISSION</span>
          </button>
          <button
            className="commander-hud-tool"
            aria-label="Open inventory"
            onClick={() => openTab("INVENTORY")}
          >
            <Icon name="box" />
            <span>INVENTORY</span>
          </button>
          <button
            className="cmd-icon-button"
            aria-label={s.state.paused ? "Resume mission" : "Pause mission"}
            onClick={() => onTickPause(!s.state.paused)}
          >
            <Icon name={s.state.paused ? "play" : "pause"} />
          </button>
          <button className="cmd-icon-button" aria-label="Open settings" title="Settings" onClick={onSettings}>
            <Icon name="settings" />
          </button>
          <button
            className="cmd-tablet-trigger"
            aria-label="Open mission tablet"
            aria-expanded={tablet}
            onClick={() => {
              openTab("STATUS");
            }}
          >
            <Icon name="tablet" />
            <span>SYSTEMS</span>
          </button>
        </div>
      </div>
      <button className="campaign-map-button" type="button" aria-label="Open navigation map"
        aria-expanded={navOpen} onClick={()=>{setActions(false);setNavOpen(true)}}>
        <Icon name="map" size={18}/> MAP
      </button>
      <div className="campaign-sim-rate">
        <label>
          SIM RATE{" "}
          <select
            aria-label="Simulation rate"
            value={s.simRate}
            onChange={(e) => onRate(Number(e.target.value))}
          >
            {[1, 5, 20, 100].map((n) => (
              <option key={n} value={n}>
                {n}×
              </option>
            ))}
          </select>
        </label>
      </div>
      {!s.state.paused && <div className={`campaign-guidance ${helpOpen ? "help-expanded" : "help-collapsed"}`}>
        <small>
          {m.title.toUpperCase()} / MISSION {m.level}
        </small>
        <p className="campaign-phase">
          PHASE {m.phases.indexOf(currentPhase(s)) + 1} / {m.phases.length} ·{" "}
          {currentPhase(s)}
        </p>
        <span>
          CURRENT OBJECTIVE{" "}
          <b>
            {Math.min(s.objective + 1, m.objectives.length)} /{" "}
            {m.objectives.length}
          </b>
        </span>
        {helpOpen && m.historical && <p className="campaign-real-mission">Inspired by {m.historical.inspiration} · {m.historical.year} · Fictional simulation</p>}
        <h2>{o?.title}</h2>
        {o?.site && (
          <p>
            Location: {sitePosition(o.site, m.destination).name}. Refer to the
            MAP above.
          </p>
        )}
        {helpOpen && o?.instruction !== o?.title && <p>{o?.instruction}</p>}
        {o && <section className="campaign-task-guide" aria-label="How to complete this objective">
          <button type="button" className="campaign-guide-toggle"
            aria-expanded={helpOpen} aria-controls="campaign-objective-help"
            onClick={()=>setHelpOpen(open=>!open)}>
            {helpOpen ? "▲ Hide instructions · Return to moving" : "ⓘ HOW TO COMPLETE · Show instructions ▼"}
          </button>
          {helpOpen && <div id="campaign-objective-help" className="campaign-task-guide-content">
          <p className="campaign-guide-next">{guide.next}</p>
          <ol>
            {guide.steps.map((step,i)=>
              <li className={step.done?"done":""} key={i}>
                <span aria-hidden="true">{step.done?"✓":i+1}</span>{step.text}
              </li>)}
          </ol>
          <div className="campaign-guide-actions">
            {s.state.paused
              ? <button type="button" onClick={()=>onTickPause(false)}>▶ Resume mission</button>
              : guide.recoveryStation && !atSite(s,guide.recoveryStation)
                ? <button type="button" className="primary" onClick={()=>setNavOpen(true)}>
                    Open MAP · Go to {sitePosition(guide.recoveryStation,m.destination).name} to repair
                  </button>
                : guide.recoveryStation && atSite(s,guide.recoveryStation)
                  ? <button type="button" className="primary" onClick={()=>{setHelpOpen(false);setActions(true)}}>
                      Open station controls · Follow the repair steps
                    </button>
                : o.site && !atSite(s,o.site)
                  ? <button type="button" onClick={()=>setNavOpen(true)}>Open MAP · Find the station</button>
                : <>
                  {o.event==="power" && !s.observations.powerDiagnosed &&
                    <button type="button" className="primary" onClick={()=>run("inspectPower")}>
                      Inspect power and diagnose faults
                    </button>}
                  {o.action==="land" &&
                    (!s.world.switches.navigation ?
                      <button type="button" className="primary" onClick={()=>onWorld({kind:"switch",id:"navigation"})}>
                        Turn ON Navigation computer
                      </button>
                      : s.world.target!=="moon" ?
                        <button type="button" className="primary" onClick={()=>onWorld({kind:"target",value:"moon"})}>
                          Set destination to Lunar approach
                        </button>
                        : !s.world.switches.maneuver ?
                          <button type="button" className="primary" onClick={()=>onWorld({kind:"switch",id:"maneuver"})}>
                            Turn ON Guarded manoeuvre arm
                          </button>
                          : <button type="button" className="primary" onClick={()=>run("land")}>
                              Execute lunar landing →
                            </button>)}
                  {o.action==="returnBurn" &&
                    (s.world.target!=="earth" ?
                      <button type="button" className="primary" onClick={()=>onWorld({kind:"target",value:"earth"})}>Set destination to Earth orbit / recovery</button>
                      : !s.world.switches.maneuver ?
                        <button type="button" className="primary" onClick={()=>onWorld({kind:"switch",id:"maneuver"})}>Turn ON guarded manoeuvre arm</button>
                        : <button type="button" className="primary" onClick={()=>run("returnBurn")}>Start controlled return burn →</button>)}
                  {o.choices?.map(choice=>
                    <button type="button" key={choice.action}
                      disabled={o.event==="power" && !s.observations.powerDiagnosed}
                      className={choice.action==="eventReroute"||choice.action==="powerSafe"?"primary":""}
                      onClick={()=>run(choice.action)}>
                      {choice.title}<small>{choice.detail}</small>
                    </button>)}
                  {m.id==="mission-2"&&o.action==="approach" &&
                    <button type="button" className="primary" onClick={openRendezvous}>Open Satellite Rendezvous Computer</button>}
                  {!launching && !!o.action && !o.choices && o.action!=="returnBurn" &&
                    !(m.id==="mission-2"&&o.action==="approach") &&
                    o.action!=="land" &&
                    o.action!=="eat" && o.action!=="drink" && o.action!=="wake" &&
                    <button type="button" className="primary" onClick={()=>run(o.action!)}>Perform: {o.title}</button>}
                  {!launching && !!area && !actions && <button type="button" onClick={()=>setActions(true)}>Show station controls</button>}
                </>}
          </div>
          {guideFeedback && <p className="campaign-guide-feedback" role="alert">{guideFeedback}</p>}
          <button type="button" className="campaign-guide-hide" onClick={()=>setHelpOpen(false)}>
            ▲ Hide help and move freely
          </button>
          </div>}
        </section>}
        {m.id==="mission-2"&&o?.action==="approach"&&
          <button type="button" className="campaign-direct-console"
           onClick={openRendezvous}>
           {s.state.paused?"▶ Resume mission to use navigation":
            atSite(s,"cockpit")?"◈ OPERATE RENDEZVOUS COMPUTER":"◈ Go to Flight deck · Open navigation computer"}
          </button>}
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
        {helpOpen && <button
          onClick={() => {
            setHelpOpen(false);
            setTab("MISSION");
            setTablet(true);
          }}
        >
          Mission steps <Icon name="chevron" size={12} />
        </button>}
      </div>}
      {m.id==="mission-2"&&o?.action==="approach"&&!s.state.paused&&!rendezvousOpen&&!tablet&&!tutorial&&
        <div className="cmd-rendezvous-shortcut" role="region" aria-label="Active rendezvous mission control">
          <strong>RENDEZVOUS COMPUTER</strong>
          <span>Objective: match the target satellite's approach geometry.</span>
          <button type="button" onClick={openRendezvous}>
            OPEN NAVIGATION COMPUTER →
          </button>
        </div>}
      {s.state.paused && !tutorial && !tablet && !rendezvousOpen && (
        <div className="campaign-paused" role="region" aria-label="Mission paused">
          <span>MISSION PAUSED</span>
          <p>Controls and mission actions are disabled while paused. Resume first.</p>
          <button onClick={() => onTickPause(false)}>Resume mission →</button>
          <button onClick={onHome}>Save & campaign</button>
        </div>
      )}
      {rendezvousOpen&&m.id==="mission-2"&&o?.action==="approach"&&
        <RendezvousConsole session={s}
          onClose={()=>setRendezvousOpen(false)}
          onResume={()=>onTickPause(false)}
          onComplete={()=>run("approach")}/>} 
      {hatchNotice&&<div className="cmd-hatch-notice" role="status">
        <strong>MISSION GUIDANCE</strong><span>{hatchNotice}</span>
        <button type="button" onClick={()=>setHatchNotice("")} aria-label="Dismiss airlock status">×</button>
      </div>}
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
      {!launching && (
        <div className="campaign-interaction">
          {actions && (
            <div
              className="cmd-action-menu"
              role="region"
              aria-label="Station operations"
            >
              <StationControls s={s} onWorld={onWorld} onCommand={run} />
              {actionable &&
                o?.choices &&
                o.choices.map((c) => (
                  <button
                    key={c.action}
                    disabled={s.state.paused}
                    onClick={() => run(c.action)}
                  >
                    <span>
                      {c.title}
                      <small>{c.detail}</small>
                    </span>
                    <Icon name="chevron" size={13} />
                  </button>
                ))}
              {actionable && o?.action && !o.choices && !inventoryTask && (
                <button
                  disabled={s.state.paused}
                  onClick={()=>{
                    if(m.id==="mission-2"&&o.action==="approach"){openRendezvous();}
                    else run(o.action!);
                  }}
                >
                  {o.title}
                  <Icon name="chevron" size={14} />
                </button>
              )}
              {extras.map((a) => (
                <button
                  disabled={s.state.paused}
                  key={a.action}
                  onClick={()=>{
                    if(m.id==="mission-2"&&o?.action==="approach"&&a.action==="approach"){
                      openRendezvous();
                    }else run(a.action);
                  }}
                >
                  {a.label}
                  <Icon name="chevron" size={13} />
                </button>
              ))}
            </div>
          )}
        </div>
      )}
      {s.state.sleeping && (
        <div className="cmd-rest-card">
          <Icon name="sleep" size={30} />
          <small>REST CYCLE</small>
          <h2>Rest & recover.</h2>
          <p>Energy {s.state.energy.toFixed(0)}% · time continues</p>
          {true ? (
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
      {shipAlerts(s).length > 0 && (
        <button
          className="ship-alert-indicator"
          onClick={() => openTab("STATUS")}
        >
          {shipAlerts(s)[0].level} · {shipAlerts(s)[0].text}
        </button>
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
      {navOpen && <NavigationMap s={s} onClose={()=>setNavOpen(false)} />}
      {tablet && (
        <CampaignTablet
          s={s}
          progress={progress}
          onOptional={onOptional}
          onAbort={onAbort}
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
