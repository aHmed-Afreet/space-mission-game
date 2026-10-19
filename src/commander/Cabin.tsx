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
type Props = {
  onArea: (area: Area | undefined) => void;
  onPosition: (p: Position) => void;
  onInteract: () => void;
  onGraphicsError: () => void;
  locked: boolean;
  alarm: boolean;
  effect?: VisualAction;
  telemetry: Telemetry;
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
      interior = createInterior();
    } catch (error) {
      renderer.dispose();
      renderer.domElement.remove();
      current.current.onGraphicsError();
      setError("Cabin graphics could not load. Your mission is preserved.");
      console.error(error);
      return;
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
        const x =
          camera.position.x +
          (Math.cos(yaw) * sideways - Math.sin(yaw) * forward) * dt * 1.8;
        const z =
          camera.position.z +
          (-Math.sin(yaw) * sideways - Math.cos(yaw) * forward) * dt * 1.8;
        if (walkable(x, camera.position.z)) camera.position.x = x;
        if (walkable(camera.position.x, z)) camera.position.z = z;
        camera.rotation.set(look.current.pitch, yaw, 0);
        camera.position.y =
          1.63 +
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
      );
      if (!document.hidden && now - lastDraw >= frameDuration) {
        renderer.render(scene, camera);
        lastDraw = now;
      }
      frame = requestAnimationFrame(loop);
    };
    camera.position.set(spawn.x, 1.63, spawn.z);
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
      length = Math.max(38, Math.hypot(dx, dy));
    stick.current = { x: dx / length, y: dy / length };
    if (thumb.current)
      thumb.current.style.transform = `translate(${stick.current.x * 32}px,${stick.current.y * 32}px)`;
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
      {error && (
        <div role="alert" className="cmd-graphics-error">
          <strong>Graphics unavailable</strong>
          <p>{error}</p>
        </div>
      )}
    </div>
  );
}
