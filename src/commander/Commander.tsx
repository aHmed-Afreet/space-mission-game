import { worldAction, service, serviceEquipment, doors, lockers, type WorldAction } from "./campaign/ship";
import { useCallback, useEffect, useRef, useState } from "react";
import GameSettings from "./campaign/GameSettings";
import type { PlayerPreferences } from "./campaign/preferences";
import { initializeCommander, UNSAVED_WARNING } from "./campaign/commanderStorage";
import type { Design } from "../game";
import type { LifeSupport } from "./simulation";
import {spawn, type Position} from "./layout";
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
  campaignWalkable,
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
import MultiplayerLobby from "./multiplayer/MultiplayerLobby";
import {CommanderNetwork} from "./multiplayer/network";
import {generateCrewCode,roomCapacity,initialCrewPose,validCrewPosition,
 type RoomRole,type CrewMember} from "./multiplayer/protocol";
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
  const changePreferences = useCallback((next: PlayerPreferences) => {
    setPreferences(next);
    setPreferencesWarning(initial.preferencesSaving.save(next));
  }, [initial.preferencesSaving]);
  const latest = useRef(store);
  latest.current = store;
  // Live co-op is opt-in: only the Commander host saves v3 progress.
  const [crewRoom,setCrewRoom]=useState<{role:RoomRole|null;code:string;
   capacity:2|3|4;members:CrewMember[];status:string;connecting:boolean}>({
    role:null,code:"",capacity:4,members:[],status:"",connecting:false
   });
  const roomRef=useRef<CommanderNetwork|null>(null);
  const soloBackup=useRef<Store|null>(null);
  const guestMissionId=useRef<string|null>(null);
  const guestSeat=useRef(1);
  const guestPose=useRef<Position>({...spawn});
  const [guestPosition,setGuestPosition]=useState<Position>({...spawn});
  const modeRef=useRef(mode);
  modeRef.current=mode;
  const lastPoseSend=useRef(0);
  const leaveCrew=()=>{
    const guest=roomRef.current?.role==="guest";
    roomRef.current?.leave();roomRef.current=null;
    guestMissionId.current=null;
    if(guest&&soloBackup.current){
      setStore(soloBackup.current);soloBackup.current=null;setMode("home");
    }
    setCrewRoom({role:null,code:"",capacity:4,members:[],status:"",connecting:false});
  };
  useEffect(()=>()=>{roomRef.current?.leave();roomRef.current=null;},[]);
  const startRoom=async(role:RoomRole,code:string,capacity:2|3|4)=>{
    if(roomRef.current)return;
    if(roomCapacity(code)!==capacity){
      setCrewRoom(v=>({...v,status:"The room code is invalid."}));return;
    }
    if(role==="guest"){soloBackup.current=latest.current;setMode("home");}
    setCrewRoom({role,code,capacity,members:[],status:"Connecting securely…",connecting:true});
    const network=new CommanderNetwork(role,code,capacity,{
      onRoster:(members,seat)=>{
        guestSeat.current=seat;
        setCrewRoom(v=>({...v,members,connecting:false}));
      },
      onStatus:status=>setCrewRoom(v=>({...v,status,connecting:false})),
      onSnapshot:packet=>{
        if(roomRef.current!==network||role!=="guest")return;
        if(packet.active&&packet.session){
          if(guestMissionId.current!==packet.session.id){
            guestMissionId.current=packet.session.id;
            const pose=initialCrewPose(guestSeat.current,packet.session.position);
            guestPose.current=pose;setGuestPosition(pose);
            network.sendPose(pose,packet.session.id);
          }
          setStore(v=>({...v,session:packet.session}));
          setMode("flight");
        }else{
          guestMissionId.current=null;
          setMode("home");
        }
      },
      onAction:(_userId,task)=>{
        if(role!=="host")return;
        setStore(v=>{
          const session=v.session;
          if(!session||session.id!==task.sessionId||session.state.ended||session.report||
             !validCrewPosition(task.position)||
             !campaignWalkable(task.position.x,task.position.z,session))return v;
          // Apply guest actions at their physical position, then restore the
          // host's own camera position; the host remains the only authority.
          const projected={...session,position:task.position};
          let next=projected;
          try{
            if(task.type==="command"&&typeof task.value==="string"&&
               /^[a-zA-Z]{1,32}$/.test(task.value)){
              next=command(projected,task.value as CampaignAction);
            }else if(task.type==="optional"&&typeof task.value==="string"&&
                     /^[a-zA-Z0-9_-]{1,64}$/.test(task.value)){
              next=optionalCommand(projected,task.value);
            }else if(task.type==="world"&&task.value&&typeof task.value==="object"){
              const event=task.value as Partial<WorldAction>;
              if(event.kind==="door"&&typeof event.id==="string"&&event.id in doors)
                next=worldAction(projected,{kind:"door",id:event.id as keyof typeof doors});
              else if(event.kind==="locker"&&typeof event.id==="string"&&event.id in lockers)
                next=worldAction(projected,{kind:"locker",id:event.id as keyof typeof lockers});
            }
          }catch{/* Ignore malformed or unavailable remote actions. */}
          if(next===projected)return v;
          const restored={...next,position:session.position};
          return {...v,session:restored,progress:recordReport(v.progress,restored)};
        });
      },
      onHostLost:()=>{
        if(roomRef.current!==network)return;
        network.leave();roomRef.current=null;guestMissionId.current=null;
        if(soloBackup.current){setStore(soloBackup.current);soloBackup.current=null;}
        setMode("home");
        setCrewRoom({role:null,code:"",capacity:4,members:[],
         status:"The host disconnected. Your solo progress is safe.",connecting:false});
      }
    });
    roomRef.current=network;
    try{
      await network.connect();
      if(role==="host")network.publishMission(latest.current.session,modeRef.current==="flight");
    }catch(error){
      network.leave();if(roomRef.current===network)roomRef.current=null;
      if(role==="guest"&&soloBackup.current){setStore(soloBackup.current);soloBackup.current=null;}
      setCrewRoom({role:null,code:"",capacity:4,members:[],
        status:"Online connection failed: "+(error instanceof Error?error.message:String(error)),
        connecting:false});
    }
  };
  // Keep the host's single shared simulation in sync, including mission
  // starts, pauses, resource changes and late joiners.
  useEffect(()=>{
    if(crewRoom.role!=="host")return;
    const publish=()=>roomRef.current?.publishMission(latest.current.session,modeRef.current==="flight");
    publish();
    const timer=window.setInterval(publish,1000);
    return ()=>window.clearInterval(timer);
  },[crewRoom.role,crewRoom.code]);

  const timeBudget = useRef(createCommanderTimeBudget());
  const simulationClock = useRef<ReturnType<typeof createForegroundClock> | null>(null);
  const resourceFrame = useRef<(now:number)=>void>(() => {});
  const advanceResourceClock = useCallback((now:number) => resourceFrame.current(now), []);
  const setupDialog = useRef<HTMLDivElement>(null);
  useModalFocus({ dialog:setupDialog, active:!device || laptopIntro, onClose:!device ? onExit : () => setLaptopIntro(false) });
  const save = useCallback(() => {
    if (roomRef.current?.role==="guest"||loaded.readOnly) return;
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
      if (document.hidden&&roomRef.current?.role!=="guest") {
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
      if(roomRef.current?.role==="guest")return;
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
    if (!store.session?.report) return;
    setStore((v) => {
      if (!v.session) return v;
      const progress = recordReport(v.progress, v.session);
      return progress === v.progress ? v : { ...v, progress };
    });
  }, [store.session?.report]);
  const updateSession = useCallback(
    (fn: (s: Session) => Session) => {
      if(roomRef.current?.role==="guest")return;
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
  const onMove = useCallback(
    (p: Position) => {
      const net=roomRef.current;
      if(net?.role==="guest"){
        guestPose.current=p;setGuestPosition(p);
        if(performance.now()-lastPoseSend.current>90){
          lastPoseSend.current=performance.now();
          net.sendPose(p,guestMissionId.current);
        }
        return;
      }
      if(net?.role==="host"&&performance.now()-lastPoseSend.current>90){
        lastPoseSend.current=performance.now();
        net.sendPose(p,latest.current.session?.id??null);
      }
      setStore(v=>{
        if(!v.session)return v;
        const next=moveSession(v.session,p);
        return next===v.session?v:{...v,session:next,progress:recordReport(v.progress,next)};
      });
    },
    [],
  );
  const pause = useCallback(
    (paused: boolean) => {
      simulationClock.current?.reset(performance.now());
      updateSession((s) => ({ ...s, state: { ...s.state, paused } }));
    },
    [updateSession],
  );
  const sendCrewAction=(type:"command"|"world"|"optional",value:unknown):boolean=>{
    const network=roomRef.current;
    if(network?.role!=="guest")return false;
    const sessionId=guestMissionId.current;
    if(sessionId)network.sendTask({type,value,position:guestPose.current,sessionId});
    return true;
  };
  const onCommand = useCallback(
    (action: CampaignAction) => {
      if(roomRef.current?.role==="guest"){
        if(guestMissionId.current)roomRef.current.sendTask({type:"command",value:action,
          position:guestPose.current,sessionId:guestMissionId.current});
        return;
      }
      updateSession(s=>command(s,action));
    },
    [updateSession],
  );
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
    if(roomRef.current?.role==="guest"){leaveCrew();return;}
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
    if (!canStart(m, store.progress) || loaded.readOnly) return;
    setCampaignRoute(campaignForMission(m.id)?.id ?? null);
    setSelected(m);
    setGear([...m.requiredEquipment]);
    setUpgrades([]);
    setMode("prepare");
  };
  const deviceValue = device || "ipad";
  const openSettings = useCallback(() => { if (mode === "flight") pause(true); setSettingsOpen(true); }, [mode, pause]);
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
        crew={crewRoom.role?crewRoom.members:[]}
        crewCode={crewRoom.role?crewRoom.code:""}
        crewOwnId={roomRef.current?.selfId??""}
        onLeaveCrew={leaveCrew}
        device={device}
        preferences={preferences}
        onSettings={openSettings}
        onWorld={(action) => {if(!sendCrewAction("world",action))updateSession(s=>worldAction(s,action));}}
        onOptional={(id) => {if(!sendCrewAction("optional",id))updateSession(s=>optionalCommand(s,id));}}
        onRate={(rate) => updateSession((s) => setSimRate(s, rate))}
        onControls={(throttle, pitch) =>
          updateSession((s) => flightControls(s, throttle, pitch))
        }
        onAbort={() => {
          if(roomRef.current?.role==="guest"){setCrewRoom(v=>({...v,status:"Only the host can abort the shared flight."}));return;}
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
        session={crewRoom.role==="guest"?{...store.session,position:guestPosition}:store.session}
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
    <MultiplayerLobby role={crewRoom.role} code={crewRoom.code} maxPlayers={crewRoom.capacity}
      members={crewRoom.members} message={crewRoom.status} connecting={crewRoom.connecting}
      onCreate={capacity=>{void startRoom("host",generateCrewCode(capacity),capacity);}}
      onJoin={code=>{const capacity=roomCapacity(code);if(capacity)void startRoom("guest",code,capacity);}}
      onLeave={leaveCrew}/>
    {crewRoom.role!=="guest"&&<CampaignHome
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
    />}
    {settingsView}
    </>
  );
}
