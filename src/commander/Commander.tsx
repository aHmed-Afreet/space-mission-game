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
  createSession,
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
          const next = tickSession(v.session, 0.5);
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
                "Start this mission? Your unfinished campaign checkpoint will be replaced. Your completed levels are kept.",
              )
            )
              return;
            try {
              const session = createSession(
                selected,
                store.design,
                store.life,
                gear,
                store.progress,
              );
              setStore((v) => ({ ...v, session }));
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
        session={store.session}
        progress={store.progress}
        onMove={onMove}
        onTickPause={pause}
        onCommand={onCommand}
        onHome={home}
        onNext={next ? () => prepare(next) : undefined}
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
