import TouchActionButton from "../TouchActionButton";
import { createFixtures } from "./campaign/fixtures";
import {
  useEffect,
  useContext,
  useRef,
  useState,
  type PointerEvent as ReactPointer,
} from "react";
import * as THREE from "three";
import { nearby, spawn, walkable, deck, type Position } from "./layout";
import { createInterior, type VisualAction } from "./interior";
import type { Area } from "./simulation";
import type { Telemetry } from "./displays";
import { joystickVector } from "./controls";
import type { Session } from "./campaign/engine";
import { campaignWalkable, currentObjective } from "./campaign/engine";
import { doors, lockers } from "./campaign/ship";
import { environments } from "./campaign/environments";
import { missionForSession } from "./campaign/definitions";
import { createForegroundClock } from "./foregroundTime";
import { adaptiveGraphicsRatio, graphicsRatioBounds, publishGraphicsTrace } from "./graphicsPolicy";
import { stepLocomotion } from "./locomotion";
import { SimulationClockContext } from "./simulationClockContext";
import type { PlayerPreferences } from "./campaign/preferences";
import { pickAimTarget, type AimTarget } from "./targeting";
import {CrewAvatarManager} from "./multiplayer/CrewAvatars";
import type {CrewMember} from "./multiplayer/protocol";

export type { AimTarget } from "./targeting";
type Props = {
  crew?: CrewMember[];
  device?: "ipad" | "iphone" | "laptop";
  settings?: PlayerPreferences;
  onArea: (area: Area | undefined) => void;
  onPosition: (p: Position) => void;
  onInteract: (target: AimTarget | null, position?: Position) => void;
  onGraphicsError: () => void;
  locked: boolean;
  alarm: boolean;
  effect?: VisualAction;
  telemetry: Telemetry;
  world?: {
    session: Session;
    target?: Area | null;
  };
};
export default function Cabin(props: Props) {
  const advanceResources = useContext(SimulationClockContext);
  const host = useRef<HTMLDivElement>(null),
    current = useRef(props),
    keys = useRef(new Set<string>()),
    stick = useRef({ x: 0, y: 0 }),
    look = useRef({ yaw: 0, pitch: 0 }),
    thumb = useRef<HTMLSpanElement>(null),
    joystick = useRef<HTMLDivElement>(null),
    origin = useRef({ x: 0, y: 0 }),
    pointer = useRef<number | undefined>(undefined),
    sprint = useRef(false),
    sprintTouch = useRef<{id:number;x:number;y:number}|null>(null),
    workLook = useRef<{id:number;x:number;y:number;startX:number;startY:number;dragged:boolean}|null>(null),
    suppressWorkAction = useRef(false),
    aim = useRef<AimTarget | null>(null),
    [aimLabel, setAimLabel] = useState(""),
    lookPointer = useRef<{ id: number; x: number; y: number; startX:number; startY:number; dragged:boolean } | undefined>(
      undefined,
    ),
    jump = useRef({ height: 0, velocity: 0 }),
    orbitalContacts = useRef(new Map<number, number>()),
    clearInput = useRef(() => {}),
    flushMotion = useRef(() => {}),
    interactionTarget = useRef((): AimTarget | null => aim.current),
    commitInteraction = useRef(() => {}),
    [error, setError] = useState("");
  current.current = props;
  useEffect(() => {
    const el = host.current!;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: true,
        powerPreference: "high-performance",
      });
    } catch {
      current.current.onGraphicsError();
      setError(
        "Your browser could not start 3D graphics. Enable WebGL and reopen Commander Mode. Your saved mission is safe.",
      );
      return;
    }
    // Adapt rendering resolution to the iPad's actual graphics performance.
    const graphicsMode=props.settings?.graphics||"balanced";
    let ratioBounds=graphicsRatioBounds(window.devicePixelRatio,graphicsMode);
    let renderRatio=ratioBounds.limit;
    const targetFps=graphicsMode==="battery"?30:60;
    renderer.setPixelRatio(renderRatio);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    el.appendChild(renderer.domElement);
    const traceRatio = (measuredFps:number|null) => publishGraphicsTrace(renderer.domElement, {
      preset:graphicsMode, deviceRatio:window.devicePixelRatio, ratio:renderRatio,
      ...ratioBounds, measuredFps, targetFps,
    });
    traceRatio(null);
    renderer.domElement.setAttribute(
      "aria-label",
      "Explorable spacecraft cabin",
    );
    let disposed = false;
    let needsDraw = true;
    // Paused scenes stay idle, but accepted asynchronous scene additions still
    // need one fresh frame. Never wake a renderer that has been disposed.
    const invalidateScene = () => { if (!disposed) needsDraw = true; };
    let interior: ReturnType<typeof createInterior>;
    try {
      interior = createInterior(
        props.world
          ? {
              eva: missionForSession(props.world.session).eva,
              destination: missionForSession(props.world.session).destination,
              graphics: props.settings?.graphics,
              onSceneChange: invalidateScene,
            }
          : { onSceneChange: invalidateScene },
      );
    } catch (error) {
      disposed = true;
      renderer.dispose();
      renderer.domElement.remove();
      current.current.onGraphicsError();
      setError("Cabin graphics could not load. Your mission is preserved.");
      console.error(error);
      return;
    }
    const fixtures = props.world ? createFixtures(interior.scene, invalidateScene) : undefined;
    let field:
      { update: (s: Session) => void; dispose: () => void } | undefined;
    if (props.world && missionForSession(props.world.session).eva) {
      import("./campaign/world")
        .then(({ createFieldWorld }) => {
          if (disposed) return;
          field = createFieldWorld(
            interior.scene,
            missionForSession(props.world!.session).destination,
            props.world!.session.missionId,
            graphicsMode,
            invalidateScene,
          );
          invalidateScene();
        })
        .catch(() => {
          if (disposed) return;
          current.current.onGraphicsError();
          setError(
            "The field environment could not load. Reload to retry; your mission is saved.",
          );
        });
    }
    current.current.onArea(undefined);
    const { camera, scene } = interior;
    const remoteAstronauts=new CrewAvatarManager(scene);
    const resize = () => {
      const w = Math.max(1, el.clientWidth),
        h = Math.max(1, el.clientHeight);
      ratioBounds=graphicsRatioBounds(window.devicePixelRatio,graphicsMode);
      renderRatio=Math.max(ratioBounds.floor,Math.min(ratioBounds.limit,renderRatio));
      renderer.setPixelRatio(renderRatio);
      traceRatio(null);
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      needsDraw = true;
    };
    const observer = new ResizeObserver(resize);
    observer.observe(el);
    resize();
    const foregroundClock = createForegroundClock();
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const movement={forward:0,sideways:0};
    const down = (e: KeyboardEvent) => {
      if (current.current.locked || document.hidden) return;
      if (
        (e.target as HTMLElement).closest(
          'input,select,textarea,[contenteditable="true"],[role="dialog"]',
        )
      )
        return;
      flushMotion.current();
      const k = e.key.toLowerCase();
      if (k === "shift") keys.current.add("shift");
      const currentFlight=current.current.world?.session;
      if([" ","control","pageup","pagedown"].includes(k) &&
        currentFlight && currentFlight.position.z>10.4 &&
        missionForSession(currentFlight).destination==="earth"){
        e.preventDefault();keys.current.add(k);
      }
      if (
        [
          "w",
          "a",
          "s",
          "d",
          "arrowup",
          "arrowdown",
          "arrowleft",
          "arrowright",
        ].includes(k)
      ) {
        e.preventDefault();
        keys.current.add(k);
      }
      if (
        k === " " &&
        current.current.world &&
        current.current.world.session.position.z > 10.4 &&
        missionForSession(current.current.world.session).destination !==
          "earth" &&
        !current.current.locked
      ) {
        e.preventDefault();
        if (jump.current.height === 0) jump.current.velocity = 2.1;
      }
      if (k === "e" && !e.repeat && !current.current.locked) {
        e.preventDefault();
        commitInteraction.current();
      }
    };
    const up = (e: KeyboardEvent) => {
      flushMotion.current();
      keys.current.delete(e.key.toLowerCase());
    };
    const clear = () => {
      keys.current.clear();
      stick.current = { x: 0, y: 0 };
      pointer.current = undefined;
      sprint.current = false;
      orbitalContacts.current.clear();
      sprintTouch.current = null;
      workLook.current = null;
      suppressWorkAction.current = false;
      lookPointer.current = undefined;
      movement.forward=0; movement.sideways=0;
      el.parentElement?.querySelectorAll(".cmd-look-surface.using").forEach(element=>element.classList.remove("using"));
      if (thumb.current) thumb.current.style.transform = "translate(0px,0px)";
      joystick.current?.classList.remove("using");
    };
    clearInput.current = clear;
    const suspendInput = () => { clear(); foregroundClock.reset(); };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", suspendInput);
    document.addEventListener("visibilitychange", suspendInput);
    let frame = 0,
      lastReport = 0,
      lastDraw = 0,
      lastArea: Area | undefined,
      lastAim = 0,
      elapsed = 0;
    // Keep touch input fluid: adaptive pixel ratio instead of a hard 30 FPS cap.
    // Balance visual quality by pixel ratio, not a 30 FPS touch-device cap.
    // 60 Hz rAF calls land at ~16.67 ms; slight pacing slack prevents
    // accidental every-other-frame rendering at a nominal 60 FPS.
    const frameDuration=1000/targetFps;
    let sampleStart=performance.now(),sampleFrames=0,lastResizeAdjust=0;
    const allowed = (x: number, z: number) =>
      current.current.world
        ? campaignWalkable(x, z, current.current.world.session)
        : walkable(x, z);
    const advanceMotion = (now: number) => {
      advanceResources(now);
      foregroundClock.advance(now, { active:!current.current.locked, visible:!document.hidden }, dt => {
        elapsed += dt;
        const k = keys.current;
        const env = current.current.world ? environments[missionForSession(current.current.world.session).destination] : null;
        let touchLift = 0;
        for (const lift of orbitalContacts.current.values()) touchLift += lift;
        stepLocomotion({ position:camera.position, movement, jump:jump.current }, {
          forward:Number(k.has("w") || k.has("arrowup")) - Number(k.has("s") || k.has("arrowdown")) - stick.current.y,
          sideways:Number(k.has("d") || k.has("arrowright")) - Number(k.has("a") || k.has("arrowleft")) + stick.current.x,
          yaw:look.current.yaw, sprint:sprint.current || k.has("shift"),
          lift:Number(k.has(" ") || k.has("pageup")) - Number(k.has("control") || k.has("pagedown")) + touchLift,
        }, env, dt, allowed, elapsed, reducedMotion.matches);
      });
      camera.rotation.set(look.current.pitch, look.current.yaw, 0);
    };
    // Input edges integrate the preceding interval using the preceding input.
    // A 100 ms press between one-Hz draws remains a 100 ms press, and a new
    // press never applies retroactively to a slow frame's entire elapsed time.
    flushMotion.current = () => advanceMotion(performance.now());
    interactionTarget.current = () => {
      flushMotion.current();
      const session = current.current.world?.session;
      return session ? pickAimTarget(camera, session, missionForSession(session).eva) : aim.current;
    };
    commitInteraction.current = () => {
      flushMotion.current();
      // The camera moves continuously while onPosition updates session only
      // every 150ms. Sync the live position before the queued world action:
      // otherwise a player already at the hatch can be denied as too far away.
      const position = {x: camera.position.x, z: camera.position.z, heading: look.current.yaw};
      const target = interactionTarget.current();
      current.current.onPosition(position);
      current.current.onInteract(target, position);
    };
    const loop = (_timestamp: number) => {
      const now = performance.now();
      advanceMotion(now);
      if (current.current.world && now - lastAim > 120) {
        lastAim = now;
        const supportsEva=missionForSession(current.current.world.session).eva;
        const picked = pickAimTarget(camera, current.current.world.session, supportsEva);
        aim.current = picked;
        const gateState = picked?.kind === "door"
          ? current.current.world.session.world.doors[picked.id as keyof typeof doors]
          : undefined;
        const inMotion = gateState !== undefined && Date.now() < gateState.readyAt;
        const doorVerb = inMotion
          ? gateState?.open ? "OPENING" : "CLOSING"
          : gateState?.open ? "CLOSE" : "OPEN";
        const label = picked
          ? picked.kind === "airlock" ? (supportsEva
              ? `${picked.id==="inner"?"INNER":"OUTER"} AIRLOCK CONTROL · INTERACT`
              : "RESTRICTED AIRLOCK · INTERACT FOR INFO")
          : picked.kind === "door" ? (
              Math.abs(camera.position.z-doors[picked.id as keyof typeof doors].z)>1.55
              || Math.abs(camera.position.x)>1.45
              ? `MOVE CLOSER · ${doors[picked.id as keyof typeof doors].name.toUpperCase()}`
              : `${doorVerb} ${doors[picked.id as keyof typeof doors].name.toUpperCase()} · ${inMotion?"WAIT FOR DOOR":"INTERACT"}`)
          : picked.kind === "locker" ? lockers[picked.id as keyof typeof lockers].name
          : deck[picked.id as keyof typeof deck].name
          : "";
        setAimLabel(prev => prev === label ? prev : label);
      }
      const near = nearby(camera.position.x, camera.position.z);
      if (near !== lastArea) {
        lastArea = near;
        current.current.onArea(near);
      }
      const pos = {
        x: camera.position.x,
        z: camera.position.z,
        heading: look.current.yaw,
      };
      if (now - lastReport > 150) {
        lastReport = now;
        current.current.onPosition(pos);
      }
      interior.update(
        elapsed,
        near,
        current.current.alarm,
        current.current.effect,
        pos,
        current.current.telemetry,
        current.current.world?.target,
        current.current.world?.session.landed ||
          current.current.world?.session.flight.status === "pad",
        current.current.world?.session.world,
        !!current.current.world?.session.suit.equipped,
      );
      if (current.current.world) {
        field?.update(current.current.world.session);
        fixtures?.update(current.current.world.session);
        remoteAstronauts.update(current.current.crew??[],current.current.world.session.id,elapsed);
      }
      // Movement is suspended behind maps, tablets and paused procedures. Keep
      // the last cabin image there so software GPUs leave time for those controls.
      // A resize still gets a fresh frame, and unlocking resumes immediately.
      if (current.current.locked) {
        sampleStart = now;
        sampleFrames = 0;
      }
      if (!document.hidden && (needsDraw || !current.current.locked) &&
          now - lastDraw >= frameDuration*.83) {
        renderer.render(scene, camera);
        needsDraw = false;
        lastDraw = now;
        sampleFrames++;
        const sampleElapsed=now-sampleStart;
        if(sampleElapsed>3200&&now-lastResizeAdjust>2700){
          const actualFps=sampleFrames*1000/sampleElapsed;
          const nextRatio=adaptiveGraphicsRatio(renderRatio,ratioBounds,actualFps,targetFps);
          if(Math.abs(nextRatio-renderRatio)>.015){
            renderRatio=nextRatio;
            renderer.setPixelRatio(renderRatio);
            renderer.setSize(Math.max(1,el.clientWidth),Math.max(1,el.clientHeight),false);
            lastResizeAdjust=now;
          }
          traceRatio(actualFps);
          sampleStart=now;sampleFrames=0;
        }
      }
      frame = requestAnimationFrame(loop);
    };
    const start = props.world?.session.position || spawn;
    camera.position.set(start.x, 1.63, start.z);
    look.current.yaw = start.heading;
    camera.rotation.y = start.heading;
    frame = requestAnimationFrame(loop);
    const lost = (e: Event) => {
      e.preventDefault();
      current.current.onGraphicsError();
      setError(
        "3D view paused because graphics were interrupted. Reload to restore your saved mission.",
      );
    };
    renderer.domElement.addEventListener("webglcontextlost", lost);
    return () => {
      disposed = true;
      field?.dispose();
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", suspendInput);
      document.removeEventListener("visibilitychange", suspendInput);
      renderer.domElement.removeEventListener("webglcontextlost", lost);
      clear();
      flushMotion.current = () => {};
      commitInteraction.current = () => {};
      remoteAstronauts.dispose();
      fixtures?.dispose();
      interior.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, []);
  useEffect(() => {
    if (props.locked) clearInput.current();
  }, [props.locked]);
  const startStick = (e: ReactPointer<HTMLDivElement>) => {
    if (props.locked || pointer.current !== undefined) return;
    flushMotion.current();
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    pointer.current = e.pointerId;
    const r = e.currentTarget.getBoundingClientRect();
    origin.current = { x: e.clientX, y: e.clientY };
    if (joystick.current) {
      joystick.current.style.left = `${e.clientX-r.left}px`;
      joystick.current.style.top = `${e.clientY-r.top}px`;
      joystick.current.classList.add("using");
    }
    moveStick(e);
  };
  const moveStick = (e: ReactPointer<HTMLDivElement>) => {
    if (pointer.current !== e.pointerId) return;
    flushMotion.current();
    const dx = e.clientX - origin.current.x,
      dy = e.clientY - origin.current.y,
      radius = props.device === "iphone" ? 52 : 67;
    stick.current = joystickVector(dx, dy, radius);
    if (thumb.current)
      thumb.current.style.transform = `translate(${stick.current.x * radius * 0.8}px,${stick.current.y * radius * 0.8}px)`;
  };
  const stopStick = (e: ReactPointer<HTMLDivElement>) => {
    if (pointer.current !== e.pointerId) return;
    flushMotion.current();
    pointer.current = undefined;
    stick.current = { x: 0, y: 0 };
    if (thumb.current) thumb.current.style.transform = "translate(0px,0px)";
    joystick.current?.classList.remove("using");
  };
  const startLook = (e: ReactPointer<HTMLDivElement>) => {
    if (props.locked || lookPointer.current) return;
    flushMotion.current();
    e.preventDefault();
    // Retain a right-side camera drag even if the finger leaves that region.
    e.currentTarget.setPointerCapture(e.pointerId);
    lookPointer.current = { id: e.pointerId, x: e.clientX, y: e.clientY, startX:e.clientX, startY:e.clientY, dragged:false };
    e.currentTarget.classList.add("using");
  };
  const moveLook = (e: ReactPointer<HTMLDivElement>) => {
    const p = lookPointer.current;
    if (!p || p.id !== e.pointerId || props.locked) return;
    flushMotion.current();
    if(Math.hypot(e.clientX-p.startX,e.clientY-p.startY)>12) p.dragged=true;
    look.current.yaw -=
      (e.clientX - p.x) *
      (current.current.world?.session.position.z! > 10.4 ? 0.0028 : 0.0035) * (current.current.settings?.lookSensitivity ?? 1);
    look.current.pitch = Math.max(
      -1.15,
      Math.min(1.15, look.current.pitch - (e.clientY - p.y) * 0.0035 * (current.current.settings?.lookSensitivity ?? 1)),
    );
    p.x = e.clientX;
    p.y = e.clientY;
  };
  const stopLook = (e: ReactPointer<HTMLDivElement>) => {
    const p=lookPointer.current;
    if(p?.id===e.pointerId){
      flushMotion.current();
      const wasTap=e.type==="pointerup" && !p.dragged &&
        Math.hypot(e.clientX-p.startX,e.clientY-p.startY)<12;
      lookPointer.current=undefined;
      e.currentTarget.classList.remove("using");
      if (wasTap && !props.locked && props.world) {
        // The LOOK surface must NEVER toggle a section door. On iPad an
        // ordinary tap used to turn the camera could otherwise open and then
        // close the same hatch accidentally. INTERACT is the only door input.
        // Preserve the intentional Mission-2 cockpit accessibility shortcut.
        const s = props.world.session;
        const cockpitTap = s.missionId === "mission-2" &&
          currentObjective(s)?.action === "approach" &&
          Math.hypot(s.position.x-deck.cockpit.x,s.position.z-deck.cockpit.z)<1.7;
        if (cockpitTap) props.onInteract({ kind:"station", id:"cockpit" });
      }
    }
  };
  const startSprint = (e: ReactPointer<HTMLButtonElement>) => {
    if(props.locked || sprintTouch.current) return;
    flushMotion.current();
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    sprint.current = true;
    sprintTouch.current = {id:e.pointerId,x:e.clientX,y:e.clientY};
  };
  const dragSprint = (e: ReactPointer<HTMLButtonElement>) => {
    const last=sprintTouch.current;
    if(!last || last.id!==e.pointerId || props.locked) return;
    flushMotion.current();
    const factor=0.0035 * (current.current.settings?.lookSensitivity ?? 1);
    look.current.yaw -= (e.clientX-last.x)*factor;
    look.current.pitch = Math.max(-1.15,Math.min(1.15,look.current.pitch-(e.clientY-last.y)*factor));
    last.x=e.clientX;
    last.y=e.clientY;
  };
  const stopSprint = (e: ReactPointer<HTMLButtonElement>) => {
    if(sprintTouch.current?.id!==e.pointerId) return;
    flushMotion.current();
    sprintTouch.current=null;
    sprint.current=false;
  };
  // Touches that begin on INTERACT can turn the camera, but a drag MUST NOT
  // operate equipment or toggle doors. Capture-phase handlers continue to see
  // the pointer even when TouchActionButton owns pointer capture.
  const workDown = (e: ReactPointer<HTMLDivElement>) => {
    if(props.locked || e.pointerType!=="touch" || !(e.target as Element).closest(".cmd-work"))return;
    workLook.current={id:e.pointerId,x:e.clientX,y:e.clientY,startX:e.clientX,startY:e.clientY,dragged:false};
    suppressWorkAction.current=false;
  };
  const workMove=(e:ReactPointer<HTMLDivElement>)=>{
    const p=workLook.current;
    if(!p||p.id!==e.pointerId||props.locked)return;
    const dx=e.clientX-p.x,dy=e.clientY-p.y;
    if(Math.hypot(e.clientX-p.startX,e.clientY-p.startY)>12)p.dragged=true;
    flushMotion.current();
    const factor=.0035*(current.current.settings?.lookSensitivity??1);
    look.current.yaw-=dx*factor;
    look.current.pitch=Math.max(-1.15,Math.min(1.15,look.current.pitch-dy*factor));
    p.x=e.clientX;p.y=e.clientY;
  };
  const workEnd=(e:ReactPointer<HTMLDivElement>)=>{
    const p=workLook.current;
    if(!p||p.id!==e.pointerId)return;
    suppressWorkAction.current=p.dragged;
    workLook.current=null;
  };
  const orbitalEva = !!props.world && props.world.session.position.z > 10.4 &&
    missionForSession(props.world.session).destination === "earth";
  return (
    <div className={`cmd-world${orbitalEva ? " cmd-world-orbital" : ""}`}
      onPointerDownCapture={workDown}
      onPointerMoveCapture={workMove}
      onPointerUpCapture={workEnd}
      onPointerCancelCapture={workEnd}>
      <div className="cmd-canvas" ref={host} />
      <div
        className="cmd-look-surface"
        aria-label="Drag to look around"
        onPointerDown={startLook}
        onPointerMove={moveLook}
        onPointerUp={stopLook}
        onPointerCancel={stopLook}
        onLostPointerCapture={stopLook}
      >
        <span>DRAG TO LOOK</span>
      </div>
      <div className={`cmd-reticle ${aimLabel ? "cmd-reticle-active" : ""}`} aria-hidden="true">
        <i />
      </div>
      {props.device !== "laptop" && <>
        <div className={`cmd-floating-zone ${props.device === "iphone" ? "phone" : ""}`}
          aria-label="Touch and drag on the left to move"
          onPointerDown={startStick} onPointerMove={moveStick} onPointerUp={stopStick}
          onPointerCancel={stopStick} onLostPointerCapture={stopStick}>
          <div ref={joystick} className="cmd-joystick" aria-hidden="true">
            <div className="cmd-stick-ring"><span ref={thumb} /></div>
          </div>
          <small className="cmd-floating-hint">TOUCH TO MOVE</small>
        </div>
        <div className="cmd-touch-actions">
          <button type="button" className="cmd-sprint" aria-label="Hold to sprint"
            onPointerDown={startSprint}
            onPointerMove={dragSprint}
            onPointerUp={stopSprint}
            onPointerCancel={stopSprint}
            onLostPointerCapture={stopSprint}>SPRINT</button>
          <TouchActionButton type="button" className="cmd-work" aria-label="Interact with aimed target"
            disabled={props.locked} onActivate={() => {
              const drag=suppressWorkAction.current;
              suppressWorkAction.current=false;
              if(!drag)commitInteraction.current();
            }}>INTERACT</TouchActionButton>
        </div>
      </>}
      {orbitalEva&&props.device!=="laptop"&&
        <div className="cmd-orbital-thrusters" aria-label="Spacesuit vertical thrusters">
          {(["UP","DOWN"] as const).map(direction=><button key={direction} type="button"
            disabled={props.locked}
            onPointerDown={e=>{if(props.locked)return;flushMotion.current();e.preventDefault();e.currentTarget.setPointerCapture(e.pointerId);orbitalContacts.current.set(e.pointerId,direction==="UP"?1:-1);}}
            onPointerUp={e=>{flushMotion.current();orbitalContacts.current.delete(e.pointerId)}}
            onPointerCancel={e=>{flushMotion.current();orbitalContacts.current.delete(e.pointerId)}}
            onLostPointerCapture={e=>{flushMotion.current();orbitalContacts.current.delete(e.pointerId)}}>
            {direction==="UP"?"↑ ASCEND":"↓ DESCEND"}
          </button>)}
        </div>}
      {props.settings?.showHints !== false && <div className="cmd-control-hint">
        {props.device === "laptop"
          ? "WASD MOVE · SHIFT SPRINT · DRAG TO LOOK · E INTERACT · SPACE/CTRL EVA THRUSTERS"
          : "LEFT MOVE · DRAG ANYWHERE RIGHT TO LOOK · SPRINT OPTIONAL · INTERACT"}
      </div>}
      {props.settings?.showHints !== false && aimLabel && !props.locked && <div className="cmd-aim-target"><i />{aimLabel}</div>}
      {props.world &&
        props.world.session.position.z > 10.4 &&
        missionForSession(props.world.session).destination !== "earth" && (
          <TouchActionButton
            className="campaign-hop"
            onActivate={() => {
              flushMotion.current();
              if (!props.locked && jump.current.height === 0)
                jump.current.velocity = 2.1;
            }}
          >
            Small hop
          </TouchActionButton>
        )}
      {error && (
        <div role="alert" className="cmd-graphics-error">
          <strong>Graphics unavailable</strong>
          <p>{error}</p>
        </div>
      )}
    </div>
  );
}
