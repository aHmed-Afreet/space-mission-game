import { createFixtures } from "./campaign/fixtures";
import {
  useEffect,
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
import { campaignWalkable } from "./campaign/engine";
import { doors, lockers } from "./campaign/ship";
import { environments } from "./campaign/environments";
import { missionById } from "./campaign/definitions";
import type { PlayerPreferences } from "./campaign/preferences";

export type AimTarget = { kind: "door" | "locker" | "station" | "airlock"; id: string };
const lockerPositions: Record<string, [number, number, number]> = {
  food: [2.2,1.3,.45], water: [2.7,1.8,.75], science: [-2.45,1.8,-2.7],
  samples: [-2.45,1.8,-3.7], equipment: [2.4,1.8,5.7],
  eva: [2.45,1.8,3.8], repair: [2.45,1.8,4.8], emergency: [1.5,1.8,6.1],
  maintenance: [-2.4,1.8,.75]
};
type Props = {
  device?: "ipad" | "iphone" | "laptop";
  settings?: PlayerPreferences;
  onArea: (area: Area | undefined) => void;
  onPosition: (p: Position) => void;
  onInteract: (target: AimTarget | null) => void;
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
    aim = useRef<AimTarget | null>(null),
    [aimLabel, setAimLabel] = useState(""),
    lookPointer = useRef<{ id: number; x: number; y: number; startX:number; startY:number; dragged:boolean } | undefined>(
      undefined,
    ),
    jump = useRef({ height: 0, velocity: 0 }),
    orbitalThrust = useRef(0),
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
    const pixelRatioLimit=Math.min(devicePixelRatio||1,
      graphicsMode==="quality"?1.85:graphicsMode==="battery"?1:1.45);
    let renderRatio=pixelRatioLimit;
    renderer.setPixelRatio(renderRatio);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    el.appendChild(renderer.domElement);
    renderer.domElement.setAttribute(
      "aria-label",
      "Explorable spacecraft cabin",
    );
    let interior: ReturnType<typeof createInterior>;
    try {
      interior = createInterior(
        props.world
          ? {
              eva: missionById(props.world.session.missionId).eva,
              destination: missionById(props.world.session.missionId).destination,
              graphics: props.settings?.graphics,
            }
          : {},
      );
    } catch (error) {
      renderer.dispose();
      renderer.domElement.remove();
      current.current.onGraphicsError();
      setError("Cabin graphics could not load. Your mission is preserved.");
      console.error(error);
      return;
    }
    const fixtures = props.world ? createFixtures(interior.scene) : undefined;
    let field:
      { update: (s: Session) => void; dispose: () => void } | undefined;
    let disposed = false;
    if (props.world && missionById(props.world.session.missionId).eva) {
      import("./campaign/world")
        .then(({ createFieldWorld }) => {
          if (!disposed)
            field = createFieldWorld(
              interior.scene,
              missionById(props.world!.session.missionId).destination,
              props.world!.session.missionId,
              graphicsMode,
            );
        })
        .catch(() => {
          current.current.onGraphicsError();
          setError(
            "The field environment could not load. Reload to retry; your mission is saved.",
          );
        });
    }
    current.current.onArea(undefined);
    const { camera, scene } = interior;
    const resize = () => {
      const w = Math.max(1, el.clientWidth),
        h = Math.max(1, el.clientHeight);
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    const observer = new ResizeObserver(resize);
    observer.observe(el);
    resize();
    const down = (e: KeyboardEvent) => {
      if (
        (e.target as HTMLElement).closest(
          'input,select,textarea,[role="dialog"]',
        )
      )
        return;
      const k = e.key.toLowerCase();
      if (k === "shift") keys.current.add("shift");
      const currentFlight=current.current.world?.session;
      if([" ","control","pageup","pagedown"].includes(k) &&
        currentFlight && currentFlight.position.z>10.4 &&
        missionById(currentFlight.missionId).destination==="earth"){
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
        missionById(current.current.world.session.missionId).destination !==
          "earth" &&
        !current.current.locked
      ) {
        e.preventDefault();
        if (jump.current.height === 0) jump.current.velocity = 2.1;
      }
      if (k === "e" && !e.repeat && !current.current.locked) {
        e.preventDefault();
        current.current.onInteract(aim.current);
      }
    };
    const up = (e: KeyboardEvent) => keys.current.delete(e.key.toLowerCase());
    const clear = () => {
      keys.current.clear();
      stick.current = { x: 0, y: 0 };
      pointer.current = undefined;
      sprint.current = false;
      orbitalThrust.current=0;
      sprintTouch.current = null;
      lookPointer.current = undefined;
      if (thumb.current) thumb.current.style.transform = "translate(0px,0px)";
      joystick.current?.classList.remove("using");
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", clear);
    let frame = 0,
      last = performance.now(),
      lastReport = 0,
      lastDraw = 0,
      lastArea: Area | undefined,
      lastAim = 0,
      elapsed = 0;
    // Keep touch input fluid: adaptive pixel ratio instead of a hard 30 FPS cap.
    // Balance visual quality by pixel ratio, not a 30 FPS touch-device cap.
    // 60 Hz rAF calls land at ~16.67 ms; slight pacing slack prevents
    // accidental every-other-frame rendering at a nominal 60 FPS.
    const targetFps=graphicsMode==="battery"?30:60;
    const frameDuration=1000/targetFps;
    let sampleStart=performance.now(),sampleFrames=0,lastResizeAdjust=0;
    const movement={forward:0,sideways:0};
    const clock = performance.now();
    const allowed = (x: number, z: number) =>
      current.current.world
        ? campaignWalkable(x, z, current.current.world.session)
        : walkable(x, z);
    const loop = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      elapsed = (now - clock) / 1000;
      if (!current.current.locked) {
        const k = keys.current;
        let forward =
          Number(k.has("w") || k.has("arrowup")) -
          Number(k.has("s") || k.has("arrowdown")) -
          stick.current.y;
        let sideways =
          Number(k.has("d") || k.has("arrowright")) -
          Number(k.has("a") || k.has("arrowleft")) +
          stick.current.x;
        const length = Math.max(1, Math.hypot(forward, sideways));
        forward /= length;
        sideways /= length;
        // Soft acceleration avoids jitter as the floating joystick changes angle.
        const smoothing=Math.min(1,dt*10);
        movement.forward+=(forward-movement.forward)*smoothing;
        movement.sideways+=(sideways-movement.sideways)*smoothing;
        forward=movement.forward;sideways=movement.sideways;
        const yaw = look.current.yaw;
        const env = current.current.world
          ? environments[
              missionById(current.current.world.session.missionId).destination
            ]
          : null;
        const speed =
          (camera.position.z > 10.4 && env ? env.movement * 0.88 : 1.8) *
          (sprint.current || k.has("shift") ? 1.65 : 1);
        const x =
          camera.position.x +
          (Math.cos(yaw) * sideways - Math.sin(yaw) * forward) * dt * speed;
        const z =
          camera.position.z +
          (-Math.sin(yaw) * sideways - Math.cos(yaw) * forward) * dt * speed;
        if (allowed(x, camera.position.z)) camera.position.x = x;
        if (allowed(camera.position.x, z)) camera.position.z = z;
        camera.rotation.set(look.current.pitch, yaw, 0);
        if(camera.position.z>10.4&&env?.gravity===0){
          // Suit cold-gas training thrusters: drift persists until counter-thrust
          // or damping slows it. The anchor boundary prevents untethered escape.
          const lift=(Number(k.has(" ")||k.has("pageup"))-
            Number(k.has("control")||k.has("pagedown"))+orbitalThrust.current);
          jump.current.velocity=Math.max(-2.3,Math.min(2.3,
            jump.current.velocity+(Math.max(-1,Math.min(1,lift))*3.2-
              jump.current.velocity*.8)*dt));
          jump.current.height=Math.max(-.65,Math.min(5.4,
            jump.current.height+jump.current.velocity*dt));
          if((jump.current.height===-.65&&jump.current.velocity<0)||
             (jump.current.height===5.4&&jump.current.velocity>0))
            jump.current.velocity=0;
        }else if (camera.position.z > 10.4 && env) {
          jump.current.height = Math.max(
            0,
            jump.current.height + jump.current.velocity * dt,
          );
          jump.current.velocity -= Math.max(0.5, env.gravity) * dt;
          if (jump.current.height === 0 && jump.current.velocity < 0)
            jump.current.velocity = 0;
        } else {
          jump.current.height = 0;
          jump.current.velocity = 0;
        }
        camera.position.y =
          1.63 +
          jump.current.height +
          Math.sin(elapsed * 8) *
            0.009 *
            Math.min(1, Math.hypot(forward, sideways));
      }
      if (current.current.world && now - lastAim > 120) {
        lastAim = now;
        const targets: {kind: AimTarget["kind"]; id: string; position: THREE.Vector3; distance: number}[] = [];
        // Large touch-accessible door panels and frame controls on the facing side.
        // Aim at the door itself to open it, even if the tiny control is hard to see.
        for(const [id,d] of Object.entries(doors)){
          const facingSide=camera.position.z>d.z?1:-1;
          for(const x of [-1.08,1.08,.53,0]){
            targets.push({kind:"door",id,position:new THREE.Vector3(x,1.35,d.z+facingSide*.19),distance:3.5});
          }
        }
        const supportsEva=missionById(current.current.world.session.missionId).eva;
        for(const [id,z] of [["inner",7.75],["outer",10.25]] as const){
          if(id==="outer"&&!supportsEva)continue;
          const facingSide=camera.position.z>z?1:-1;
          for(const x of [.67,0]){
            targets.push({kind:"airlock",id,position:new THREE.Vector3(x,1.35,z+facingSide*.24),distance:3.4});
          }
        }
        for (const [id, loc] of Object.entries(lockerPositions))
          targets.push({kind:"locker",id,position:new THREE.Vector3(...loc),distance:2.6});
        for (const [id, loc] of Object.entries(deck))
          targets.push({kind:"station",id,position:new THREE.Vector3(loc.x,1.3,loc.z+.48),distance:2.9});
        let picked: AimTarget | null = null, best = Infinity;
        for (const t of targets) {
          const d = t.position.distanceTo(camera.position);
          if (d > t.distance) continue;
          const p = t.position.clone().project(camera);
          if (p.z < -1 || p.z > 1) continue;
          const error = Math.hypot(p.x, p.y*.8);
          if (error > (t.kind === "door" || t.kind === "airlock" ? .68 : .52)) continue;
          if (error + d*.04 < best) { best = error + d*.04; picked = {kind:t.kind,id:t.id}; }
        }
        aim.current = picked;
        const label = picked
          ? picked.kind === "airlock" ? (supportsEva
              ? `${picked.id==="inner"?"INNER":"OUTER"} AIRLOCK CONTROL · INTERACT`
              : "RESTRICTED AIRLOCK · INTERACT FOR INFO")
          : picked.kind === "door" ? (
              Math.abs(camera.position.z-doors[picked.id as keyof typeof doors].z)>1.55
              || Math.abs(camera.position.x)>1.45
              ? `MOVE CLOSER · ${doors[picked.id as keyof typeof doors].name.toUpperCase()}`
              : `${current.current.world.session.world.doors[picked.id as keyof typeof doors].open?"CLOSE":"OPEN"} ${doors[picked.id as keyof typeof doors].name.toUpperCase()} · INTERACT`)
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
      }
      if (!document.hidden && now - lastDraw >= frameDuration*.83) {
        renderer.render(scene, camera);
        lastDraw = now;
        sampleFrames++;
        const sampleElapsed=now-sampleStart;
        if(sampleElapsed>3200&&now-lastResizeAdjust>2700){
          const actualFps=sampleFrames*1000/sampleElapsed;
          const minRatio=graphicsMode==="battery"?.7:.85;
          let nextRatio=renderRatio;
          if(actualFps<targetFps*.78)nextRatio=Math.max(minRatio,renderRatio-.13);
          else if(actualFps>targetFps*.93)nextRatio=Math.min(pixelRatioLimit,renderRatio+.07);
          if(Math.abs(nextRatio-renderRatio)>.015){
            renderRatio=nextRatio;
            renderer.setPixelRatio(renderRatio);
            renderer.setSize(Math.max(1,el.clientWidth),Math.max(1,el.clientHeight),false);
            lastResizeAdjust=now;
          }
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
      window.removeEventListener("blur", clear);
      renderer.domElement.removeEventListener("webglcontextlost", lost);
      clear();
      fixtures?.dispose();
      interior.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, []);
  useEffect(() => {
    if (props.locked) {
      keys.current.clear();
      pointer.current = undefined;
      sprint.current = false;
      sprintTouch.current = null;
      stick.current = { x: 0, y: 0 };
      if (thumb.current) thumb.current.style.transform = "translate(0px,0px)";
    }
  }, [props.locked]);
  const startStick = (e: ReactPointer<HTMLDivElement>) => {
    if (props.locked || pointer.current !== undefined) return;
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
    const dx = e.clientX - origin.current.x,
      dy = e.clientY - origin.current.y,
      radius = props.device === "iphone" ? 52 : 67;
    stick.current = joystickVector(dx, dy, radius);
    if (thumb.current)
      thumb.current.style.transform = `translate(${stick.current.x * radius * 0.8}px,${stick.current.y * radius * 0.8}px)`;
  };
  const stopStick = (e: ReactPointer<HTMLDivElement>) => {
    if (pointer.current !== e.pointerId) return;
    pointer.current = undefined;
    stick.current = { x: 0, y: 0 };
    if (thumb.current) thumb.current.style.transform = "translate(0px,0px)";
    joystick.current?.classList.remove("using");
  };
  const startLook = (e: ReactPointer<HTMLDivElement>) => {
    if (props.locked || lookPointer.current) return;
    e.preventDefault();
    // Retain a right-side camera drag even if the finger leaves that region.
    e.currentTarget.setPointerCapture(e.pointerId);
    lookPointer.current = { id: e.pointerId, x: e.clientX, y: e.clientY, startX:e.clientX, startY:e.clientY, dragged:false };
    e.currentTarget.classList.add("using");
  };
  const moveLook = (e: ReactPointer<HTMLDivElement>) => {
    const p = lookPointer.current;
    if (!p || p.id !== e.pointerId || props.locked) return;
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
      const wasTap=e.type==="pointerup" && !p.dragged &&
        Math.hypot(e.clientX-p.startX,e.clientY-p.startY)<12;
      lookPointer.current=undefined;
      e.currentTarget.classList.remove("using");
      if(wasTap && !props.locked && props.world) {
        const a=aim.current,loc=props.world.session.position;
        // Tapping the actual cockpit console is equivalent to pressing
        // INTERACT. In Mission 2 this opens the rendezvous control panel.
        if(a || Math.hypot(loc.x-deck.cockpit.x,loc.z-deck.cockpit.z)<1.7)
          props.onInteract(a);
      }
    }
  };
  const startSprint = (e: ReactPointer<HTMLButtonElement>) => {
    if(props.locked) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    sprint.current = true;
    sprintTouch.current = {id:e.pointerId,x:e.clientX,y:e.clientY};
  };
  const dragSprint = (e: ReactPointer<HTMLButtonElement>) => {
    const last=sprintTouch.current;
    if(!last || last.id!==e.pointerId || props.locked) return;
    const factor=0.0035 * (current.current.settings?.lookSensitivity ?? 1);
    look.current.yaw -= (e.clientX-last.x)*factor;
    look.current.pitch = Math.max(-1.15,Math.min(1.15,look.current.pitch-(e.clientY-last.y)*factor));
    last.x=e.clientX;
    last.y=e.clientY;
  };
  const stopSprint = (e: ReactPointer<HTMLButtonElement>) => {
    if(sprintTouch.current?.id!==e.pointerId) return;
    sprintTouch.current=null;
    sprint.current=false;
  };
  return (
    <div className="cmd-world">
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
          <button type="button" className="cmd-work" aria-label="Interact with aimed target"
            disabled={props.locked} onClick={() => props.onInteract(aim.current)}>INTERACT</button>
        </div>
      </>}
      {props.world&&props.world.session.position.z>10.4&&
        missionById(props.world.session.missionId).destination==="earth"&&
        props.device!=="laptop"&&
        <div className="cmd-orbital-thrusters" aria-label="Spacesuit vertical thrusters">
          {(["UP","DOWN"] as const).map(direction=><button key={direction} type="button"
            onPointerDown={e=>{e.preventDefault();e.currentTarget.setPointerCapture(e.pointerId);orbitalThrust.current=direction==="UP"?1:-1;}}
            onPointerUp={()=>orbitalThrust.current=0}
            onPointerCancel={()=>orbitalThrust.current=0}
            onLostPointerCapture={()=>orbitalThrust.current=0}>
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
        missionById(props.world.session.missionId).destination !== "earth" && (
          <button
            className="campaign-hop"
            onClick={() => {
              if (!props.locked && jump.current.height === 0)
                jump.current.velocity = 2.1;
            }}
          >
            Small hop
          </button>
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
