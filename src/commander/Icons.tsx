export type IconName =
  | "oxygen"
  | "food"
  | "water"
  | "power"
  | "fuel"
  | "crew"
  | "shield"
  | "comms"
  | "science"
  | "tool"
  | "box"
  | "map"
  | "target"
  | "log"
  | "tablet"
  | "close"
  | "pause"
  | "play"
  | "chevron"
  | "check"
  | "sleep"
  | "temperature"
  | "pressure"
  | "sun";
const paths: Record<IconName, string[]> = {
  oxygen: ["M9 4h6v3H9z", "M8 8h8l2 4v8H6v-8z", "M9 14h6"],
  food: ["M7 3h10l2 4-2 14H7L5 7z", "M6 7h12", "M9 12h6m-6 4h4"],
  water: ["M12 3S5 11 5 15a7 7 0 0014 0c0-4-7-12-7-12z", "M8 16c0 2 2 3 3 3"],
  power: ["M14 2L5 14h6l-1 8 9-12h-6z"],
  fuel: ["M5 4h9v17H4V4z", "M6 7h6v5H6z", "M14 9h3l3 3v6c0 2-3 2-3 0v-4h-3"],
  crew: ["M9 4h6l3 4v5l-3 3H9l-3-3V8z", "M6 20l3-4h6l3 4", "M9 9h6v3H9z"],
  shield: ["M12 3l8 3v6c0 4-5 8-8 10-3-2-8-6-8-10V6z"],
  comms: [
    "M5 6c0 7 6 13 13 13",
    "M6 6l12 12",
    "M5 17l4-4m-4 8h11",
    "M15 3a6 6 0 016 6m-6-2a2 2 0 012 2",
  ],
  science: ["M10 3h4m-3 0v7L5 19v2h14v-2l-6-9V3", "M8 15h8"],
  tool: ["M14 4l-2 5 3 3 5-2c1 5-4 7-7 4l-7 7-3-3 7-7c-3-4 0-8 4-7z"],
  box: ["M3 7l9-4 9 4v12l-9 3-9-3z", "M3 7l9 4 9-4M12 11v11"],
  map: ["M3 5l6-2 6 3 6-2v16l-6 2-6-3-6 2z", "M9 3v16m6-13v16"],
  target: ["M12 3v4m0 10v4M3 12h4m10 0h4", "M8 8h8v8H8z"],
  log: ["M5 3h14v18H5z", "M8 7h8M8 11h8M8 15h5"],
  tablet: ["M4 3h16v18H4z", "M8 7h3v4H8zM14 7h3m-3 4h3M8 15h9m-9 3h5"],
  close: ["M6 6l12 12M6 18L18 6"],
  pause: ["M8 5v14m8-14v14"],
  play: ["M7 4l14 8-14 8z"],
  chevron: ["M8 4l8 8-8 8"],
  check: ["M5 12l4 4L19 6"],
  sleep: ["M4 13h16v7M4 8v12m0-5h16", "M7 9h4v4H7zm6 0h6v4h-6z"],
  temperature: ["M10 14V5a2 2 0 014 0v9a4 4 0 11-4 0z", "M12 8v9"],
  pressure: ["M4 18a9 9 0 1116 0", "M12 13l5-6M6 17h12"],
  sun: [
    "M12 2v3m0 14v3M2 12h3m14 0h3M5 5l2 2m10 10l2 2M5 19l2-2M17 7l2-2",
    "M8 8h8v8H8z",
  ],
};
export default function Icon({
  name,
  size = 20,
}: {
  name: IconName;
  size?: number;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.35"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name].map((d, i) => (
        <path d={d} key={i} />
      ))}
    </svg>
  );
}
