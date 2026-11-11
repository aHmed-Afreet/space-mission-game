import type { StoryScenario } from "./storyScenarios";

export type StoryArchitecture = "ground-control" | "early-capsule" | "apollo" | "shuttle" | "station";
/** Architecture is a training interpretation. Role wins over vehicle family:
 * an uncrewed Orion or Sputnik mission is operated on Earth, never in a cabin. */
export function storyArchitecture(scenario: Pick<StoryScenario,"role"|"family"|"title">): StoryArchitecture {
  if (scenario.role !== "astronaut") return "ground-control";
  if (scenario.family === "shuttle") return "shuttle";
  if (scenario.family === "station") return "station";
  if (scenario.family === "apollo" || scenario.family === "lunar") return "apollo";
  return "early-capsule";
}

export const storyPalette = {
  "ground-control": { shell: 0x8a8d85, structure: 0x5b6568, trim: 0x313a3f, floor: 0x333d41, instrument: "#b5d5ba", label:"MISSION OPERATIONS / EARTH" },
  "early-capsule": { shell: 0x8a958b, structure: 0x535e60, trim: 0x232a2b, floor: 0x343c3e, instrument: "#d9d2b0", label:"CAPSULE SYSTEMS / TRAINING RECONSTRUCTION" },
  apollo: { shell: 0xc5c3af, structure: 0x8b9190, trim: 0x303435, floor: 0x44494a, instrument: "#d8d4b7", label:"APOLLO SYSTEMS / TRAINING RECONSTRUCTION" },
  shuttle: { shell: 0xc3b9a2, structure: 0x777c78, trim: 0x2a3031, floor: 0x3a3d3e, instrument: "#a6d7b2", label:"ORBITER FLIGHT DECK / TRAINING RECONSTRUCTION" },
  station: { shell: 0xd6d7cb, structure: 0xa0aaa9, trim: 0x444d50, floor: 0x67716d, instrument: "#c5e4e1", label:"ORBITAL LABORATORY / TRAINING RECONSTRUCTION" },
} as const;
