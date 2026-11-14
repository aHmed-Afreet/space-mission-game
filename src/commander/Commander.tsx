import { worldAction, service, serviceEquipment, type WorldAction } from "./campaign/ship";
import CrewPanel from "./multiplayer/CrewPanel";
import {CommanderRoomNetwork} from "./multiplayer/network";
import {generateCrewCode,type CrewRoomState,type CrewAction,type CrewViewMode} from "./multiplayer/protocol";
import { useCallback, useEffect, useRef, useState } from "react";
import GameSettings from "./campaign/GameSettings";
import type { PlayerPreferences } from "./campaign/preferences";
import { initializeCommander, UNSAVED_WARNING } from "./campaign/commanderStorage";
import type { Design } from "../game";
import type { LifeSupport } from "./simulation";
import type { Position } from "./layout";
import LegacyCommander from "./LegacyCommander";
import CampaignHome from "./campaign/CampaignHome";
import Preparation from "./campaign/Preparation";
import Flight from "./campaign/Flight";
import { campaignLevel, campaignForMission, type CampaignId } from "./campaign/campaignTypes";
import {
  missions,
  missionById,
  type CampaignAction,
  type MissionDefinition,
} from "./campaign/definitions";
import {
  canStart,
  launchMission,
  optionalCommand,
  setSimRate,
  flightControls,
  makeReport,
  command,
  moveSession,
  tickSession,
  recordReport,
  unlockedChapters,
  type Session,
} from "./campaign/engine";
import {
  CampaignSaveRecoveryError,
  toggleGear,
  type Store,
} from "./campaign/save";
import type { Technology } from "./campaign/economy";
import type { EquipmentId } from "./campaign/equipment";
import { createCommanderTimeBudget, createForegroundClock } from "./foregroundTime";
import { useModalFocus } from "./modalFocus";
import { SimulationClockContext } from "./simulationClockContext";
import "./commander.css";
import "./campaign/campaign.css";
export default function Commander({
  onExit = () => {},
}: {
  onExit?: () => void;
}) {
  const [initial] = useState(() => initializeCommander());
  const { storage, loaded, saving } = initial;
  const [campaignRoute, setCampaignRoute] = useState<CampaignId | null>(null);
  const [store, setStore] = useState<Store>(loaded.store),
    [mode, setMode] = useState<"home" | "prepare" | "flight" | "legacy">(
      "home",
    ),
    [selected, setSelected] = useState<MissionDefinition>(missions[0]),
    [gear, setGear] = useState<EquipmentId[]>([]),
    [upgrades, setUpgrades] = useState<Technology[]>([]),
    [loadWarning, setLoadWarning] = useState(loaded.warning),
    [saveError, setSaveError] = useState(""),
    [device, setDevice] = useState<"ipad" | "iphone" | "laptop" | null>(null),
    [laptopIntro, setLaptopIntro] = useState(false),
    [settingsOpen, setSettingsOpen] = useState(false),
    [preferences, setPreferences] = useState(initial.preferences),
    [preferencesWarning, setPreferencesWarning] = useState(initial.preferencesSaving.warning);
  const [crewRoom,setCrewRoom]=useState<CrewRoomState|null>(null);
  const [crewConnecting,setCrewConnecting]=useState(false);
  const [crewError,setCrewError]=useState("");
  const [guestPosition,setGuestPosition]=useState<Position|null>(null);
  const roomRef=useRef<CrewRoomState|null>(null);
  const networkRef=useRef<CommanderRoomNetwork|null>(null);
  const savedBeforeJoin=useRef<Store|null>(null);
  const remoteSessionId=useRef("");
  const isGuest=useRef(false);
  roomRef.current=crewRoom;
  isGuest.current=crewRoom?.mode==="guest";
  const changePreferences = useCallback((next: PlayerPreferences) => {
    setPreferences(next);
    setPreferencesWarning(initial.preferencesSaving.save(next));
  }, [initial.preferencesSaving]);
  const latest = useRef(store);
  latest.current = store;
  const timeBudget = useRef(createCommanderTimeBudget());
  const simulationClock = useRef<ReturnType<typeof createForegroundClock> | null>(null);
  const resourceFrame = useRef<(now:number)=>void>(() => {});
  const advanceResourceClock = useCallback((now:number) => resourceFrame.current(now), []);
  const setupDialog = useRef<HTMLDivElement>(null);
  useModalFocus({ dialog:setupDialog, active:!device || laptopIntro, onClose:!device ? onExit : () => setLaptopIntro(false) });
  const save = useCallback(() => {
    // Guest snapshots must never overwrite the player\'s personal campaign save.
    if (isGuest.current || loaded.readOnly) return;
    if (!storage) { setSaveError(UNSAVED_WARNING); return; }
    try {
      setSaveError(saving.save(latest.current));
    } catch (error) {
      setSaveError(
        error instanceof CampaignSaveRecoveryError ? error.message :
          "Progress cannot be saved on this device. Keep this tab open or allow browser storage.",
      );
    }
  }, [loaded.readOnly, storage, saving]);
  useEffect(() => {
    const id = setInterval(save, 1500);
    const hide = () => {
      if (document.hidden && !isGuest.current) {
        const steps = timeBudget.current.takeSteps(true);
        simulationClock.current?.reset();
        setStore((v) => {
          if (!v.session) return v;
          const session = steps.reduce((session, minutes) => tickSession(session, minutes), v.session);
          return { ...v, session:{ ...session, state:{ ...session.state, paused:true } } };
        });
        save();
      }
    };
    window.addEventListener("pagehide", save);
    document.addEventListener("visibilitychange", hide);
    return () => {
      clearInterval(id);
      window.removeEventListener("pagehide", save);
      document.removeEventListener("visibilitychange", hide);
      save();
    };
  }, [save]);
  useEffect(
    () => save(),
    [
      store.progress,
      store.session?.objective,
      store.session?.state.paused,
      store.design,
      store.life,
      save,
    ],
  );
  useEffect(() => {
    if (mode !== "flight") return;
    const clock = createForegroundClock();
    simulationClock.current = clock;
    let frame = 0;
    const advance = (now:number) => {
      if(isGuest.current){clock.reset(now);return;}
      const session = latest.current.session;
      const accepted = clock.advance(now, {
        active:!!session && !session.state.paused && !session.state.ended && !session.report,
        visible:!document.hidden,
      }, () => {});
      if (session) timeBudget.current.add(accepted.acceptedSeconds, session.simRate);
      // Keep React updates bounded while retaining every accepted interval.
      // Actions and pause/visibility transitions flush the fractional budget.
      if (timeBudget.current.seconds >= .25 - 1e-9) {
        const steps = timeBudget.current.takeSteps();
        setStore((v) => {
          if (!v.session) return v;
          const next = steps.reduce((session, minutes) => tickSession(session, minutes), v.session);
          return next === v.session
            ? v
            : { ...v, session: next, progress: recordReport(v.progress, next) };
        });
      }
    };
    resourceFrame.current = advance;
    const loop = () => {
      advance(performance.now());
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(frame);
      simulationClock.current = null;
      resourceFrame.current = () => {};
    };
  }, [mode]);
  useEffect(() => {
    if (isGuest.current || !store.session?.report) return;
    setStore((v) => {
      if (!v.session) return v;
      const progress = recordReport(v.progress, v.session);
      return progress === v.progress ? v : { ...v, progress };
    });
  }, [store.session?.report]);
  const updateSession = useCallback(
    (fn: (s: Session) => Session) => {
      const steps = timeBudget.current.takeSteps(true);
      setStore((v) => {
        if (!v.session) return v;
        const next = fn(steps.reduce((session, minutes) => tickSession(session, minutes), v.session));
        return next === v.session
          ? v
          : { ...v, session: next, progress: recordReport(v.progress, next) };
      });
    },
    [],
  );
  const onRemoteCrewAction = useCallback((action:CrewAction,_senderId:string)=>{
    // Only the host is allowed to commit a shared mission change.
    if(roomRef.current?.mode!=="host")return;
    setStore(v=>{
      if(!v.session||v.session.report)return v;
      const captainPosition=v.session.position;
      const visiting={...v.session,position:action.position};
      let result:Session=visiting;
      try{
        switch(action.type){
         case "command":result=command(visiting,action.value as CampaignAction);break;
         case "world":result=worldAction(visiting,action.value as WorldAction);break;
         case "optional":result=optionalCommand(visiting,action.value as string);break;
         case "pause":result={...visiting,state:{...visiting.state,paused:action.value as boolean}};break;
         // Launch flight controls and simulation acceleration remain captain-only.
         case "controls":case "rate":return v;
        }
      }catch{return v;}
      const next={...result,position:captainPosition};
      return {...v,session:next,progress:recordReport(v.progress,next)};
    });
  },[]);
  const sendCrewAction=useCallback((type:CrewAction["type"],value:unknown)=>{
    if(roomRef.current?.mode!=="guest")return;
    const position=guestPosition??latest.current.session?.position;
    if(position)networkRef.current?.requestAction({type,value,position});
  },[guestPosition]);
  const onMove=useCallback((p:Position)=>{
    const room=roomRef.current;
    if(room?.mode==="guest"){
      setGuestPosition(p);
      networkRef.current?.publishPose(p,latest.current.session?.missionId??"");
      return;
    }
    setStore(v=>{
      if(!v.session)return v;
      const next=moveSession(v.session,p);
      return next===v.session?v:{...v,session:next,progress:recordReport(v.progress,next)};
    });
    if(room?.mode==="host")networkRef.current?.publishPose(p,latest.current.session?.missionId??"");
  },[]);
  const leaveCrew=useCallback(()=>{
    const guest=roomRef.current?.mode==="guest";
    networkRef.current?.close();networkRef.current=null;
    roomRef.current=null;isGuest.current=false;setCrewRoom(null);setCrewError("");
    if(guest){
      if(savedBeforeJoin.current)setStore(savedBeforeJoin.current);
      savedBeforeJoin.current=null;remoteSessionId.current="";
      setGuestPosition(null);setMode("home");
    }
  },[]);
  const createCrew=useCallback(async()=>{
    if(networkRef.current)return;
    setCrewConnecting(true);setCrewError("");
    const network=new CommanderRoomNetwork({
      onState:state=>{roomRef.current=state;isGuest.current=state?.mode==="guest";setCrewRoom(state);},
      onSession:()=>{},
      onAction:onRemoteCrewAction,
      onLost:message=>setCrewError(message)
    });
    networkRef.current=network;
    try{await network.create(generateCrewCode(),latest.current.session,
       mode==="flight"?"flight":"home");}
    catch(e){network.close();networkRef.current=null;setCrewError(e instanceof Error?e.message:String(e));}
    finally{setCrewConnecting(false);}
  },[mode,onRemoteCrewAction]);
  const joinCrew=useCallback(async(code:string)=>{
    if(networkRef.current)return;
    setCrewConnecting(true);setCrewError("");
    savedBeforeJoin.current=latest.current;remoteSessionId.current="";
    const network=new CommanderRoomNetwork({
      onState:state=>{roomRef.current=state;isGuest.current=state?.mode==="guest";setCrewRoom(state);},
      onSession:(session,view)=>{
        if(roomRef.current?.mode!=="guest")return;
        if(view==="flight"&&session){
          if(remoteSessionId.current!==session.id){
            remoteSessionId.current=session.id;
            setGuestPosition({...session.position,x:session.position.x+.55,z:session.position.z+.25});
          }
          setStore(v=>({...v,session}));setMode("flight");
        }else setMode("home");
      },
      onAction:()=>{},
      onLost:message=>setCrewError(message)
    });
    networkRef.current=network;
    try{await network.join(code);}
    catch(e){
      network.close();networkRef.current=null;savedBeforeJoin.current=null;
      setCrewError(e instanceof Error?e.message:String(e));
    }finally{setCrewConnecting(false);}
  },[]);
  useEffect(()=>{
    if(crewRoom?.mode!=="host")return;
    const timer=window.setTimeout(()=>{
      networkRef.current?.publishSession(store.session,mode==="flight"?"flight":"home");
    },160);
    return ()=>window.clearTimeout(timer);
  },[crewRoom?.mode,store.session,mode]);
  useEffect(()=>()=>{networkRef.current?.close();networkRef.current=null;},[]);
  const pause = useCallback(
    (paused: boolean) => {
      if(isGuest.current){sendCrewAction("pause",paused);return;}
      simulationClock.current?.reset(performance.now());
      updateSession((s) => ({ ...s, state: { ...s.state, paused } }));
    },
    [updateSession,sendCrewAction],
  );
  const onCommand = useCallback(
    (action: CampaignAction) => {
      if(isGuest.current)sendCrewAction("command",action);
      else updateSession((s) => command(s, action));
    },
    [updateSession,sendCrewAction],
  );
  const onCrewWorld=useCallback((action:WorldAction)=>{
    if(isGuest.current)sendCrewAction("world",action);
    else updateSession(s=>worldAction(s,action));
  },[updateSession,sendCrewAction]);
  const onCrewOptional=useCallback((id:string)=>{
    if(isGuest.current)sendCrewAction("optional",id);
    else updateSession(s=>optionalCommand(s,id));
  },[updateSession,sendCrewAction]);
  // A report is an immutable finished flight. Acknowledge it once and
  // discard only its stale session; keep the settled report in progress.history.
  const dismissReport = () => {
    if (store.session) setCampaignRoute(campaignForMission(store.session.missionId)?.id ?? null);
    setStore(v=>!v.session?.report?v:{
      ...v,progress:recordReport(v.progress,v.session),session:null
    });
    setMode("home");
  };
  const home = () => {
    if(store.session?.report){dismissReport();return;}
    if(store.session) setCampaignRoute(campaignForMission(store.session.missionId)?.id ?? null);
    pause(true);
    save();
    setMode("home");
  };
  const retryFinished = () => {
    const s=store.session;
    if(!s?.report || loaded.readOnly)return;
    // Retry intentionally starts a new flight under the latest definition.
    const m=missionById(s.missionId);
    setStore(v=>!v.session?.report?v:{...v,progress:recordReport(v.progress,v.session),session:null});
    setCampaignRoute(campaignForMission(m.id)?.id??null);
    setSelected(m);
    setGear([...m.requiredEquipment]);
    setUpgrades([]);
    setMode("prepare");
  };
  const nextFinished = () => {
    const s=store.session;
    if(!s?.report?.success || loaded.readOnly)return;
    const route=campaignForMission(s.missionId);
    if(!route)return;
    const index=(route.missionIds as readonly string[]).indexOf(s.missionId);
    const nextId=route.missionIds[index+1];
    if(!nextId){dismissReport();return;}
    const m=missionById(nextId);
    // Unlock only if this actual report counts as a completed mission.
    const settled=recordReport(store.progress,s);
    if(!canStart(m,settled)){dismissReport();return;}
    setStore(v=>v.session?.report?{...v,progress:recordReport(v.progress,v.session),session:null}:v);
    setCampaignRoute(route.id);
    setSelected(m);
    setGear([...m.requiredEquipment]);
    setUpgrades([]);
    setMode("prepare");
  };
  const prepare = (m: MissionDefinition) => {
    if (isGuest.current || !canStart(m, store.progress) || loaded.readOnly) return;
    setCampaignRoute(campaignForMission(m.id)?.id ?? null);
    setSelected(m);
    setGear([...m.requiredEquipment]);
    setUpgrades([]);
    setMode("prepare");
  };
  const deviceValue = device || "ipad";
  const openSettings = useCallback(() => { if (mode === "flight"&&!isGuest.current) pause(true); setSettingsOpen(true); }, [mode, pause]);
  const closeSettings = useCallback(() => setSettingsOpen(false), []);
  const resetProgress = () => {
    if (loaded.readOnly) return;
    if (!storage) {
      setSaveError("Reset is unavailable because browser storage is blocked. Your current progress has been kept.");
      return;
    }
    try {
      const { store: next, warning } = saving.reset();
      latest.current = next;
      setStore(next);
      setSelected(missions[0]);
      setGear([]);
      setUpgrades([]);
      setLoadWarning("");
      setSaveError(warning);
      setSettingsOpen(false);
      setMode("home");
    } catch (error) {
      setSaveError(error instanceof Error && /newer campaign save/.test(error.message)
        ? "Reset is unavailable because a newer campaign save is protected. Your current progress and saved data have been kept."
        : "Reset could not be saved. Your current progress and saved data have been kept.");
    }
  };
  const settingsView = settingsOpen ? (
    <GameSettings value={preferences} onChange={changePreferences} saveWarning={preferencesWarning} device={deviceValue}
      onDevice={setDevice} onClose={closeSettings}
      onReset={resetProgress} readonly={loaded.readOnly}/>
  ) : null;
  if (!device || laptopIntro) return (
    <div ref={setupDialog} className="cmd-device-setup" role="dialog" aria-modal="true" aria-label="Commander control setup">
      <section className="cmd-device-panel">
        <small>ORBITAL / COMMANDER MODE</small>
        {laptopIntro ? <>
          <h1>Laptop controls</h1>
          <p><strong>WASD / Arrow Keys</strong> to move · <strong>Shift</strong> to sprint · <strong>Drag mouse</strong> to look · Aim and press <strong>E</strong> to interact with equipment or open a hatch.</p>
          <p>Touch joystick and on-screen buttons will be hidden.</p>
          <button className="cmd-device-next" onClick={() => setLaptopIntro(false)}>Continue →</button>
        </> : <>
          <h1>What device are you using?</h1>
          <p>Choose your device to load the best game controls.</p>
          <div className="cmd-device-options">
            <button onClick={() => setDevice("ipad")}>iPad <span>Move by touching the left side. Sprint and Interact on the right.</span></button>
            <button onClick={() => setDevice("iphone")}>iPhone <span>Compact touch controls.</span></button>
            <button onClick={() => { setDevice("laptop"); setLaptopIntro(true); }}>Laptop <span>Keyboard and mouse controls, without touch buttons.</span></button>
          </div>
          <button className="cmd-device-back" onClick={onExit}>← Choose game mode</button>
        </>}
      </section>
    </div>
  );
  if (mode === "legacy")
    return (
      <div className="campaign-legacy-host">
        <button
          className="campaign-legacy-return"
          onClick={() => setMode("home")}
        >
          ← Save & campaign
        </button>
        <LegacyCommander />
      </div>
    );
  if (mode === "prepare")
    return (
      <>
        <div className="campaign-nav">
          <button onClick={() => setMode("home")}>← Campaign</button>
          <span>{campaignForMission(selected.id)?.name.toUpperCase()} / LEVEL {campaignLevel(selected.id)} · PREPARATION</span>
        </div>
        <Preparation
          mission={selected}
          progress={store.progress}
          upgrades={upgrades}
          onUpgrade={(id) =>
            setUpgrades((v) =>
              v.includes(id) ? v.filter((x) => x !== id) : [...v, id],
            )
          }
          design={store.design}
          setDesign={(value) =>
            setStore((v) => ({
              ...v,
              design: typeof value === "function" ? value(v.design) : value,
            }))
          }
          life={store.life}
          setLife={(value) =>
            setStore((v) => ({
              ...v,
              life: typeof value === "function" ? value(v.life) : value,
            }))
          }
          gear={gear}
          onGear={(id) => setGear((g) => toggleGear(g, id))}
          onLaunch={() => {
            if (
              store.session &&
              !store.session.report &&
              !window.confirm(
                "Start this mission? The unfinished flight will be recorded as an abort and its insurance settled. Your completed missions are kept.",
              )
            )
              return;
            try {
              let progress = store.progress;
              if (store.session && !store.session.report) {
                const ended = {
                  ...store.session,
                  state: { ...store.session.state, ended: true },
                };
                progress = recordReport(progress, {
                  ...ended,
                  report: makeReport(ended, false),
                });
              }
              const started = launchMission(
                selected,
                store.design,
                store.life,
                gear,
                progress,
                upgrades,
              );
              setStore((v) => ({ ...v, ...started }));
              setMode("flight");
            } catch (error) {
              setSaveError(
                error instanceof Error
                  ? error.message
                  : "Mission could not start.",
              );
            }
          }}
        />
        {saveError && <p className="cmd-alert critical">{saveError}</p>}
      </>
    );
  if (mode === "flight" && store.session) {
    const route = campaignForMission(store.session.missionId);
    const routeIndex = route ? (route.missionIds as readonly string[]).indexOf(store.session.missionId) : -1;
    const next = route && routeIndex >= 0
      ? missions.find(m => m.id === route.missionIds[routeIndex+1])
      : undefined;
    return (
      <>
      <SimulationClockContext.Provider value={advanceResourceClock}>
      <Flight
        device={device}
        preferences={preferences}
        onSettings={openSettings}
        onWorld={(action) => updateSession((s) => worldAction(s, action))}
        onOptional={(id) => updateSession((s) => optionalCommand(s, id))}
        onRate={(rate) => updateSession((s) => setSimRate(s, rate))}
        onControls={(throttle, pitch) =>
          updateSession((s) => flightControls(s, throttle, pitch))
        }
        onAbort={() => {
          if (
            window.confirm(
              "Abort this flight and recover insured hardware? Performance bonuses will be lost.",
            )
          )
            updateSession((s) => ({
              ...s,
              state: { ...s.state, ended: true, paused: false },
              report: makeReport(s, false),
            }));
        }}
        session={store.session}
        progress={store.progress}
        onMove={onMove}
        onTickPause={pause}
        onCommand={onCommand}
        onHome={home}
        onNext={store.session.report?.success && next ? nextFinished : undefined}
        onRetry={store.session.report && !store.session.report.success ? retryFinished : undefined}
        onDismissTutorial={(id) =>
          setStore((v) => ({
            ...v,
            progress: {
              ...v.progress,
              tutorials: [...new Set([...v.progress.tutorials, id])],
            },
          }))
        }
        onResetTutorials={() =>
          setStore((v) => ({
            ...v,
            progress: { ...v.progress, tutorials: [] },
          }))
        }
        saveError={saveError}
      />
      </SimulationClockContext.Provider>
      {settingsView}
      </>
    );
  }
  return (
    <>
    <CampaignHome
      selectedRoute={campaignRoute}
      setSelectedRoute={setCampaignRoute}
      onServiceEquipment={(id) =>
        setStore((v) => ({ ...v, progress: serviceEquipment(v.progress, id) }))
      }
      onService={(system) =>
        setStore((v) => ({ ...v, progress: service(v.progress, system) }))
      }
      progress={store.progress}
      session={store.session}
      legacy={loaded.legacy}
      warning={saveError || loadWarning}
      readOnly={loaded.readOnly}
      onSelect={prepare}
      onResume={() => store.session?.report ? dismissReport() : setMode("flight")}
      onLegacy={() => setMode("legacy")}
      onExit={onExit}
      onSettings={openSettings}
    />
    {settingsView}
    </>
  );
}
