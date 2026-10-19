import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { areas, type Area } from "./simulation";
export default function Cabin({
  onArea,
  locked,
}: {
  onArea: (area: Area | undefined) => void;
  locked: boolean;
}) {
  const host = useRef<HTMLDivElement>(null),
    controls = useRef(new Set<string>()),
    lock = useRef(locked),
    [error, setError] = useState("");
  lock.current = locked;
  useEffect(() => {
    const el = host.current!;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true });
    } catch {
      setError(
        "3D graphics are unavailable. Enable WebGL in your browser to explore the cabin.",
      );
      return;
    }
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    el.appendChild(renderer.domElement);
    renderer.domElement.setAttribute(
      "aria-label",
      "First-person spacecraft cabin. Drag to look; use arrow keys or movement controls.",
    );
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x080f1d);
    scene.fog = new THREE.Fog(0x080f1d, 12, 36);
    const camera = new THREE.PerspectiveCamera(70, 1, 0.1, 80);
    camera.position.set(0, 1.65, 9);
    camera.rotation.order = "YXZ";
    scene.add(new THREE.HemisphereLight(0xb5e4ff, 0x122032, 2));
    const light = new THREE.PointLight(0x83ead6, 35, 25);
    light.position.set(0, 3, -3);
    scene.add(light);
    const geometries: THREE.BufferGeometry[] = [],
      materials: THREE.Material[] = [],
      textures: THREE.Texture[] = [];
    function box(
      x: number,
      y: number,
      z: number,
      w: number,
      h: number,
      depth: number,
      color: number,
    ) {
      const geo = new THREE.BoxGeometry(w, h, depth),
        mat = new THREE.MeshStandardMaterial({
          color,
          roughness: 0.65,
          metalness: 0.35,
        });
      geometries.push(geo);
      materials.push(mat);
      const m = new THREE.Mesh(geo, mat);
      m.position.set(x, y, z);
      scene.add(m);
      return m;
    }
    box(0, -0.15, 0, 10, 0.3, 26, 0x223449);
    box(-5, 2, 0, 0.2, 4, 26, 0x18263b);
    box(5, 2, 0, 0.2, 4, 26, 0x18263b);
    box(0, 4, 0, 10, 0.2, 26, 0x142338);
    box(0, 2, -13, 10, 4, 0.3, 0x20344a);
    box(0, 2, 13, 10, 4, 0.3, 0x20344a);
    for (let z = -12; z <= 12; z += 3) {
      box(0, 3.9, z, 8, 0.04, 0.08, 0x7edccb);
      box(-4.85, 2, z, 0.2, 4, 0.12, 0x39516a);
      box(4.85, 2, z, 0.2, 4, 0.12, 0x39516a);
    }
    // A clear central aisle keeps every station reachable without teleporting.
    for (const a of areas) {
      box(a.x, 0.6, a.z, 1.55, 1.2, 1.2, 0x263d55);
      box(a.x, 1.3, a.z, 0.95, 0.15, 0.7, a.color);
      const canvas = document.createElement("canvas");
      canvas.width = 512;
      canvas.height = 128;
      const ctx = canvas.getContext("2d")!;
      ctx.fillStyle = "#102031";
      ctx.fillRect(0, 0, 512, 128);
      ctx.fillStyle = "#9ff5e0";
      ctx.font = "bold 38px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(a.label, 256, 77);
      const texture = new THREE.CanvasTexture(canvas);
      textures.push(texture);
      const mat = new THREE.MeshBasicMaterial({
        map: texture,
        side: THREE.DoubleSide,
      });
      materials.push(mat);
      const geo = new THREE.PlaneGeometry(2.5, 0.625);
      geometries.push(geo);
      const label = new THREE.Mesh(geo, mat);
      label.position.set(a.x, 2.35, a.z);
      scene.add(label);
      if (a.id === "sleep") box(-3, 0.4, 7, 1.7, 0.4, 2.2, 0x6b719e);
      if (a.id === "galley") {
        box(3.5, 1.8, 0, 0.35, 0.8, 0.4, 0x63a6c7);
        box(2.5, 1.7, 0, 0.4, 0.5, 0.4, 0xbca574);
      }
    }
    box(0, 2.4, -12.8, 5, 1.6, 0.05, 0x070d1a);
    const stars = new THREE.BufferGeometry(),
      coords = [];
    for (let i = 0; i < 140; i++)
      coords.push((Math.random() - 0.5) * 4, 1.7 + Math.random() * 1.3, -12.7);
    stars.setAttribute("position", new THREE.Float32BufferAttribute(coords, 3));
    geometries.push(stars);
    const starMat = new THREE.PointsMaterial({ color: 0xc0e5ff, size: 0.018 });
    materials.push(starMat);
    scene.add(new THREE.Points(stars, starMat));
    let yaw = 0,
      pitch = 0,
      drag = false,
      px = 0,
      py = 0,
      last = performance.now(),
      frame = 0,
      lastArea: Area | undefined;
    const resize = () => {
      const w = el.clientWidth,
        h = el.clientHeight;
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    const observer = new ResizeObserver(resize);
    observer.observe(el);
    resize();
    const down = (e: PointerEvent) => {
      if (lock.current) return;
      drag = true;
      px = e.clientX;
      py = e.clientY;
      renderer.domElement.setPointerCapture(e.pointerId);
    };
    const move = (e: PointerEvent) => {
      if (!drag || lock.current) return;
      yaw -= (e.clientX - px) * 0.004;
      pitch = Math.max(-1.1, Math.min(1.1, pitch - (e.clientY - py) * 0.004));
      px = e.clientX;
      py = e.clientY;
    };
    const up = () => {
      drag = false;
    };
    const key = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).matches("input,button,select,textarea"))
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
        controls.current.add(k);
      }
    };
    const release = (e: KeyboardEvent) =>
      controls.current.delete(e.key.toLowerCase());
    const blur = () => {
      controls.current.clear();
      drag = false;
    };
    renderer.domElement.addEventListener("pointerdown", down);
    renderer.domElement.addEventListener("pointermove", move);
    renderer.domElement.addEventListener("pointerup", up);
    renderer.domElement.addEventListener("pointercancel", up);
    window.addEventListener("keydown", key);
    window.addEventListener("keyup", release);
    window.addEventListener("blur", blur);
    function loop(now: number) {
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      if (!lock.current) {
        const k = controls.current;
        let f =
          Number(k.has("w") || k.has("arrowup")) -
          Number(k.has("s") || k.has("arrowdown"));
        let side =
          Number(k.has("d") || k.has("arrowright")) -
          Number(k.has("a") || k.has("arrowleft"));
        const length = Math.hypot(f, side) || 1;
        f /= length;
        side /= length;
        const x =
          camera.position.x +
          (Math.cos(yaw) * side - Math.sin(yaw) * f) * dt * 3;
        const z =
          camera.position.z +
          (-Math.sin(yaw) * side - Math.cos(yaw) * f) * dt * 3;
        const blocked = (xx: number, zz: number) =>
          areas.some(
            (a) => Math.abs(xx - a.x) < 1.05 && Math.abs(zz - a.z) < 0.9,
          ) ||
          (xx < -1.9 && xx > -4.1 && zz > 5.7 && zz < 8.4);
        if (!blocked(x, camera.position.z))
          camera.position.x = Math.max(-4.5, Math.min(4.5, x));
        if (!blocked(camera.position.x, z))
          camera.position.z = Math.max(-12, Math.min(12, z));
        camera.rotation.set(pitch, yaw, 0);
      }
      const near = areas.find(
        (a) =>
          Math.hypot(a.x - camera.position.x, a.z - camera.position.z) < 2.7,
      )?.id;
      if (near !== lastArea) {
        lastArea = near;
        onArea(near);
      }
      renderer.render(scene, camera);
      frame = requestAnimationFrame(loop);
    }
    frame = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("keydown", key);
      window.removeEventListener("keyup", release);
      window.removeEventListener("blur", blur);
      renderer.domElement.removeEventListener("pointerdown", down);
      renderer.domElement.removeEventListener("pointermove", move);
      renderer.domElement.removeEventListener("pointerup", up);
      renderer.domElement.removeEventListener("pointercancel", up);
      geometries.forEach((g) => g.dispose());
      materials.forEach((m) => m.dispose());
      textures.forEach((t) => t.dispose());
      renderer.dispose();
      renderer.domElement.remove();
      controls.current.clear();
    };
  }, [onArea]);
  const press = (k: string) => ({
    onPointerDown: (e: React.PointerEvent<HTMLButtonElement>) => {
      e.preventDefault();
      e.currentTarget.setPointerCapture(e.pointerId);
      controls.current.add(k);
    },
    onPointerUp: () => controls.current.delete(k),
    onPointerCancel: () => controls.current.delete(k),
    onLostPointerCapture: () => controls.current.delete(k),
  });
  return (
    <div className="cmd-world">
      <div ref={host} className="cmd-canvas" />
      {error && (
        <div className="cmd-graphics-error" role="alert">
          {error}
        </div>
      )}
      <div className="cmd-crosshair" aria-hidden="true">
        +
      </div>
      <div className="cmd-move" aria-label="Movement controls">
        <button aria-label="Move forward" {...press("w")}>
          ↑
        </button>
        <div>
          <button aria-label="Move left" {...press("a")}>
            ←
          </button>
          <button aria-label="Move back" {...press("s")}>
            ↓
          </button>
          <button aria-label="Move right" {...press("d")}>
            →
          </button>
        </div>
      </div>
      <div className="cmd-look">
        Drag view to look · WASD / arrows or hold touch controls to walk
      </div>
    </div>
  );
}
