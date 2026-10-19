import * as T from "three";
import type { State } from "./simulation";
import type { Position } from "./layout";
export type Telemetry = Pick<
  State,
  | "minutes"
  | "oxygen"
  | "battery"
  | "fuel"
  | "science"
  | "communications"
  | "pressure"
  | "energy"
> & { oxygenCapacity?: number; batteryCapacity?: number };
/** Four tiny reusable display textures. Updated at telemetry speed, not render speed. */
export function createDisplays() {
  const titles = [
    "FC / INERTIAL NAVIGATION",
    "SCI / WATER-SEARCH ANALYSIS",
    "COM / SIGNAL PROCESSING",
    "ECLSS / RESOURCE MONITOR",
  ];
  const panels = titles.map(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 256;
    const ctx = canvas.getContext("2d")!;
    const texture = new T.CanvasTexture(canvas);
    texture.colorSpace = T.SRGBColorSpace;
    return {
      ctx,
      texture,
      material: new T.MeshBasicMaterial({ map: texture }),
    };
  });
  function draw(s: Telemetry, t: number, position: Position) {
    panels.forEach(({ ctx: c, texture }, i) => {
      c.fillStyle = "#09151e";
      c.fillRect(0, 0, 512, 256);
      c.strokeStyle = "#213844";
      c.lineWidth = 1;
      c.beginPath();
      c.moveTo(18, 43);
      c.lineTo(494, 43);
      c.moveTo(18, 218);
      c.lineTo(494, 218);
      c.stroke();
      c.font = "15px monospace";
      c.fillStyle = "#789aa3";
      c.fillText(titles[i], 18, 27);
      c.font = "13px monospace";
      c.fillText(
        `T+ ${String(Math.floor(s.minutes)).padStart(4, "0")} MIN`,
        340,
        240,
      );
      if (i === 0) {
        c.strokeStyle = "#395867";
        for (const r of [38, 65]) {
          c.beginPath();
          c.ellipse(156, 132, r * 1.5, r, 0, 0, Math.PI * 2);
          c.stroke();
        }
        c.strokeStyle = "#8bbcb6";
        c.beginPath();
        c.moveTo(47, 171);
        c.bezierCurveTo(110, 65, 190, 77, 243, 134);
        c.stroke();
        c.fillStyle = "#c3a17c";
        c.beginPath();
        c.arc(237, 130, 10, 0, Math.PI * 2);
        c.fill();
        c.fillStyle = "#a9d1c6";
        c.beginPath();
        c.moveTo(130, 104);
        c.lineTo(124, 118);
        c.lineTo(137, 113);
        c.closePath();
        c.fill();
        c.font = "13px monospace";
        c.fillStyle = "#7f9da6";
        c.fillText("VEHICLE ATTITUDE", 310, 85);
        c.font = "28px monospace";
        c.fillStyle = "#b0cfca";
        c.fillText(
          `${(((position.heading * 180) / Math.PI) % 360).toFixed(1)}°`,
          310,
          120,
        );
        c.font = "13px monospace";
        c.fillStyle = "#789aa3";
        c.fillText(`FUEL    ${s.fuel.toFixed(0)} U`, 310, 157);
        c.fillText("PROFILE  NOMINAL", 310, 186);
        c.fillText("ORBITAL / FLIGHT CONTROL", 18, 240);
      }
      if (i === 1) {
        for (let y = 70; y < 200; y += 30) {
          c.strokeStyle = "#1d3440";
          c.beginPath();
          c.moveTo(28, y);
          c.lineTo(480, y);
          c.stroke();
        }
        c.strokeStyle = "#92bcb2";
        c.lineWidth = 2;
        c.beginPath();
        for (let x = 28; x < 480; x += 3) {
          const y =
            178 -
            Math.exp(-Math.pow((x - 210) / 17, 2)) * 90 -
            Math.exp(-Math.pow((x - 350) / 29, 2)) * 45 +
            Math.sin(x * 0.15 + t) * 3;
          if (x === 28) c.moveTo(x, y);
          else c.lineTo(x, y);
        }
        c.stroke();
        c.font = "16px monospace";
        c.fillStyle = "#bed0c8";
        c.fillText(`SCIENCE RETURN  ${s.science.toFixed(0)} PTS`, 29, 78);
        c.font = "13px monospace";
        c.fillStyle = "#789aa3";
        c.fillText("REMOTE OBSERVATIONS", 18, 240);
      }
      if (i === 2) {
        c.strokeStyle = "#29414c";
        for (let x = 30; x < 490; x += 35) {
          c.beginPath();
          c.moveTo(x, 60);
          c.lineTo(x, 202);
          c.stroke();
        }
        c.strokeStyle = s.communications ? "#87b4b2" : "#be926b";
        c.lineWidth = 2;
        c.beginPath();
        for (let x = 22; x < 490; x += 3) {
          const y =
            143 +
            Math.sin(x * 0.04 + t * 2) * (s.communications ? 23 : 5) +
            Math.sin(x * 0.12 + t) * 4;
          if (x === 22) c.moveTo(x, y);
          else c.lineTo(x, y);
        }
        c.stroke();
        c.fillStyle = s.communications ? "#a9cfc6" : "#c8a06f";
        c.font = "23px monospace";
        c.fillText(
          s.communications ? "DOWNLINK / CONNECTED" : "SIGNAL / LOST",
          24,
          85,
        );
        c.font = "13px monospace";
        c.fillStyle = "#789aa3";
        c.fillText("DEEP SPACE NETWORK", 18, 240);
      }
      if (i === 3) {
        [
          [
            "OXYGEN",
            s.oxygen / (s.oxygenCapacity || 4),
            `${s.oxygen.toFixed(2)} KG`,
          ],
          [
            "BATTERY",
            s.battery / (s.batteryCapacity || 1),
            `${s.battery.toFixed(2)} KWH`,
          ],
          ["PRESSURE", s.pressure / 101.3, `${s.pressure.toFixed(1)} KPA`],
          ["CREW", s.energy / 100, `${s.energy.toFixed(0)} %`],
        ].forEach(([name, ratio, value], n) => {
          const y = 76 + n * 34;
          c.font = "13px monospace";
          c.fillStyle = "#8aabb2";
          c.fillText(String(name), 22, y);
          c.fillStyle = "#263b44";
          c.fillRect(143, y - 10, 210, 5);
          c.fillStyle = Number(ratio) < 0.2 ? "#c7986b" : "#8db9a9";
          c.fillRect(
            143,
            y - 10,
            210 * Math.max(0, Math.min(1, Number(ratio))),
            5,
          );
          c.fillStyle = "#b6ccc4";
          c.fillText(String(value), 375, y);
        });
        c.font = "13px monospace";
        c.fillStyle = "#789aa3";
        c.fillText("LIFE SUPPORT / LIVE", 18, 240);
      }
      texture.needsUpdate = true;
    });
  }
  return { panels, draw };
}
