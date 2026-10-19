import { worldAction, service, serviceEquipment } from "./campaign/ship";
import { useCallback, useEffect, useRef, useState } from "react";
import GameSettings from "./campaign/GameSettings";
import { readPreferences, writePreferences } from "./campaign/preferences";
import { SAVE_KEY } from "./campaign/save";
import type { Design } from "../game";
import type { LifeSupport } from "./simulation";
import type { Position } from "./layout";
import LegacyCommander from "./LegacyCommander";
import CampaignHome from "./campaign/CampaignHome";
import Preparation from "./campaign/Preparation";
import Flight from "./campaign/Flight";
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
  loadStore,
  newStore,
  persist,
  toggleGear,
  type Store,
} from "./campaign/save";
import type { Technology } from "./campaign/economy";
import type { EquipmentId } from "./campaign/equipment";
import "./commander.css";
import "./campaign/campaign.css";
export default function Commander({
  onExit = () => {},
}: {
  onExit?: () => void;
}) {
  const [loaded] = useState(() => {
    try {
      return loadStore(localStorage);
    } catch {
      return {
        store: newStore(),
        warning: "Saving is unavailable in this browser.",
        readOnly: false,
        legacy: false,
      };
    }
  });
  const [store, setStore] = useState<Store>(loaded.store),
    [mode, setMode] = useState<"home" | "prepare" | "flight" | "legacy">(
      "home",
    ),
    [selected, setSelected] = useState<MissionDefinition>(missions[0]),
    [gear, setGear] = useState<EquipmentId[]>([]),
    [upgrades, setUpgrades] = useState<Technology[]>([]),
    [saveError, setSaveError] = useState(""),
    [device, setDevice] = useState<"ipad" | "iphone" | "laptop" | null>(null),
    [laptopIntro, setLaptopIntro] = useState(false),
    [settingsOpen, setSettingsOpen] = useState(false),
    [preferences, setPreferences] = useState(() => readPreferences(typeof localStorage !== "undefined" ? localStorage : undefined));
  useEffect(() => { try { writePreferences(localStorage, preferences); } catch { /* Storage may be blocked. */ } }, [preferences]);
  const latest = useRef(store);
  latest.current = store;
  const save = useCallback(() => {
    if (loaded.readOnly) return;
    try {
      persist(localStorage, latest.current);
      setSaveError("");
    } catch {
      setSaveError(
        "Progress cannot be saved on this device. Keep this tab open or allow browser storage.",
      );
    }
  }, [loaded.readOnly]);
  useEffect(() => {
    const id = setInterval(save, 1500);
    const hide = () => {
      if (document.hidden) {
        setStore((v) =>
          v.session
            ? {
                ...v,
                session: {
                  ...v.session,
                  state: { ...v.session.state, paused: true },
                },
              }
            : v,
        );
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
    const id = setInterval(() => {
      if (!document.hidden)
        setStore((v) => {
          if (!v.session) return v;
          const next = tickSession(v.session, 0.5 * v.session.simRate);
          return next === v.session
            ? v
            : { ...v, session: next, progress: recordReport(v.progress, next) };
        });
    }, 1000);
    return () => clearInterval(id);
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
    (fn: (s: Session) => Session) =>
      setStore((v) => {
        if (!v.session) return v;
        const next = fn(v.session);
        return next === v.session
          ? v
          : { ...v, session: next, progress: recordReport(v.progress, next) };
      }),
    [],
  );
  const onMove = useCallback(
    (p: Position) => updateSession((s) => moveSession(s, p)),
    [updateSession],
  );
  const pause = useCallback(
    (paused: boolean) =>
      updateSession((s) => ({ ...s, state: { ...s.state, paused } })),
    [updateSession],
  );
  const onCommand = useCallback(
    (action: CampaignAction) => updateSession((s) => command(s, action)),
    [updateSession],
  );
  const home = () => {
    pause(true);
    save();
    setMode("home");
  };
  const prepare = (m: MissionDefinition) => {
    if (!canStart(m, store.progress) || loaded.readOnly) return;
    setSelected(m);
    setGear([...m.requiredEquipment]);
    setUpgrades([]);
    setMode("prepare");
  };
  const deviceValue = device || "ipad";
  const openSettings = () => { if (mode === "flight") pause(true); setSettingsOpen(true); };
  const resetProgress = () => {
    if (loaded.readOnly) return;
    try {
      localStorage.removeItem(SAVE_KEY);
      localStorage.removeItem(SAVE_KEY + ".backup");
      const next = newStore();
      latest.current = next;
      persist(localStorage, next);
      setStore(next);
      setSelected(missions[0]);
      setGear([]);
      setUpgrades([]);
      setSaveError("");
      setSettingsOpen(false);
      setMode("home");
    } catch { setSaveError("Reset failed because browser storage is unavailable. No changes were made."); }
  };
  const settingsView = settingsOpen ? (
    <GameSettings value={preferences} onChange={setPreferences} device={deviceValue}
      onDevice={setDevice} onClose={() => setSettingsOpen(false)}
      onReset={resetProgress} readonly={loaded.readOnly}/>
  ) : null;
  if (!device || laptopIntro) return (
    <div className="cmd-device-setup" role="dialog" aria-modal="true" aria-label="Commander control setup">
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
          <span>MISSION PREPARATION / LEVEL {selected.level}</span>
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
    const next = missions.find(
      (m) => !store.progress.completed[m.id] && canStart(m, store.progress),
    );
    return (
      <>
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
        onNext={next ? home : undefined}
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
      {settingsView}
      </>
    );
  }
  return (
    <>
    <CampaignHome
      onServiceEquipment={(id) =>
        setStore((v) => ({ ...v, progress: serviceEquipment(v.progress, id) }))
      }
      onService={(system) =>
        setStore((v) => ({ ...v, progress: service(v.progress, system) }))
      }
      progress={store.progress}
      session={store.session}
      legacy={loaded.legacy}
      warning={saveError || loaded.warning}
      readOnly={loaded.readOnly}
      onSelect={prepare}
      onResume={() => setMode("flight")}
      onLegacy={() => setMode("legacy")}
      onExit={onExit}
      onSettings={openSettings}
    />
    {settingsView}
    </>
  );
}
