import {
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointer,
} from "react";
import * as THREE from "three";
import { nearby, spawn, walkable, type Position } from "./layout";
import { createInterior, type VisualAction } from "./interior";
import type { Area } from "./simulation";
import type { Telemetry } from "./displays";
import { joystickVector } from "./controls";
import type { Session } from "./campaign/engine";
import { campaignWalkable } from "./campaign/engine";
import { environments } from "./campaign/environments";
import { missionById } from "./campaign/definitions";

type Props = {
  onArea: (area: Area | undefined) => void;
  onPosition: (p: Position) => void;
  onInteract: () => void;
  onGraphicsError: () => void;
  locked: boolean;
  alarm: boolean;
  effect?: VisualAction;
  telemetry: Telemetry;
  world?: {
    session: Session;
    waypoint?: { x: number; z: number; name: string };
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
    lookPointer = useRef<{ id: number; x: number; y: number } | undefined>(
      undefined,
    ),
    waypoint = useRef<HTMLDivElement>(null),
    waypointDistance = useRef<HTMLSpanElement>(null),
    jump = useRef({ height: 0, velocity: 0 }),
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
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.5));
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
              destination: missionById(props.world.session.missionId)
                .destination,
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
      if (k === "e" && !e.repeat && !current.current.locked)
        current.current.onInteract();
    };
    const up = (e: KeyboardEvent) => keys.current.delete(e.key.toLowerCase());
    const clear = () => {
      keys.current.clear();
      stick.current = { x: 0, y: 0 };
      pointer.current = undefined;
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
      elapsed = 0;
    const frameDuration = matchMedia("(pointer: coarse)").matches
      ? 1000 / 30
      : 1000 / 60;
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
        const yaw = look.current.yaw;
        const env = current.current.world
          ? environments[
              missionById(current.current.world.session.missionId).destination
            ]
          : null;
        const speed = camera.position.z > 10.4 && env ? env.movement : 1.8;
        const x =
          camera.position.x +
          (Math.cos(yaw) * sideways - Math.sin(yaw) * forward) * dt * speed;
        const z =
          camera.position.z +
          (-Math.sin(yaw) * sideways - Math.cos(yaw) * forward) * dt * speed;
        if (allowed(x, camera.position.z)) camera.position.x = x;
        if (allowed(camera.position.x, z)) camera.position.z = z;
        camera.rotation.set(look.current.pitch, yaw, 0);
        if (camera.position.z > 10.4 && env) {
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
      );
      if (current.current.world) field?.update(current.current.world.session);
      const wp = current.current.world?.waypoint;
      if (wp && waypoint.current) {
        const vector = new THREE.Vector3(wp.x, 1.1, wp.z);
        const front =
          vector
            .clone()
            .sub(camera.position)
            .dot(camera.getWorldDirection(new THREE.Vector3())) > 0;
        vector.project(camera);
        const w = el.clientWidth,
          h = el.clientHeight;
        const px = front
          ? Math.max(55, Math.min(w - 90, (vector.x * 0.5 + 0.5) * w))
          : w * 0.5;
        const py = front
          ? Math.max(170, Math.min(h - 180, (-vector.y * 0.5 + 0.5) * h))
          : h * 0.33;
        waypoint.current.style.left = px + "px";
        waypoint.current.style.top = py + "px";
        waypoint.current.dataset.behind = front ? "false" : "true";
        if (waypointDistance.current)
          waypointDistance.current.textContent = `${front ? "" : "Turn around · "}${Math.hypot(wp.x - camera.position.x, wp.z - camera.position.z).toFixed(1)} m`;
      }
      if (!document.hidden && now - lastDraw >= frameDuration) {
        renderer.render(scene, camera);
        lastDraw = now;
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
      interior.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, []);
  useEffect(() => {
    if (props.locked) {
      keys.current.clear();
      pointer.current = undefined;
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
    origin.current = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    joystick.current?.classList.add("using");
    moveStick(e);
  };
  const moveStick = (e: ReactPointer<HTMLDivElement>) => {
    if (pointer.current !== e.pointerId) return;
    const dx = e.clientX - origin.current.x,
      dy = e.clientY - origin.current.y,
      radius = Math.max(
        32,
        Math.min(60, e.currentTarget.getBoundingClientRect().width * 0.25),
      );
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
    e.currentTarget.setPointerCapture(e.pointerId);
    lookPointer.current = { id: e.pointerId, x: e.clientX, y: e.clientY };
    e.currentTarget.classList.add("using");
  };
  const moveLook = (e: ReactPointer<HTMLDivElement>) => {
    const p = lookPointer.current;
    if (!p || p.id !== e.pointerId || props.locked) return;
    look.current.yaw -= (e.clientX - p.x) * 0.0035;
    look.current.pitch = Math.max(
      -1.15,
      Math.min(1.15, look.current.pitch - (e.clientY - p.y) * 0.0035),
    );
    p.x = e.clientX;
    p.y = e.clientY;
  };
  const stopLook = (e: ReactPointer<HTMLDivElement>) => {
    if (lookPointer.current?.id === e.pointerId) {
      lookPointer.current = undefined;
      e.currentTarget.classList.remove("using");
    }
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
      <div className="cmd-reticle" aria-hidden="true">
        <i />
      </div>
      <div
        ref={joystick}
        className="cmd-joystick"
        role="group"
        aria-label="Virtual movement joystick"
        onPointerDown={startStick}
        onPointerMove={moveStick}
        onPointerUp={stopStick}
        onPointerCancel={stopStick}
        onLostPointerCapture={stopStick}
      >
        <div className="cmd-stick-ring">
          <span ref={thumb} />
        </div>
        <small>MOVE</small>
      </div>
      <div className="cmd-control-hint">
        WASD / ARROWS <span>MOVE</span> · DRAG <span>LOOK</span> · E{" "}
        <span>INTERACT</span>
      </div>
      {props.world?.waypoint && (
        <div ref={waypoint} className="campaign-waypoint">
          <i />
          <strong>{props.world.waypoint.name}</strong>
          <span ref={waypointDistance} />
        </div>
      )}
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
