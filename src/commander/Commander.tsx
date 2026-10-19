import { worldAction, service, serviceEquipment } from "./campaign/ship";
import { useCallback, useEffect, useRef, useState } from "react";
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
    [saveError, setSaveError] = useState("");
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
      <Flight
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
    );
  }
  return (
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
    />
  );
}
