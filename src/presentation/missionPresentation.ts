import type { Destination } from "../commander/campaign/environments";
import type { StoryScenario } from "../history/storyScenarios";

export type GraphicsTier = "battery" | "balanced" | "quality";
export type PlayerContext = "surface" | "orbit" | "cruise" | "mission-control";
export type WorksiteProfile = "none" | "satellite" | "telescope" | "relay";
export type MissionPresentation = {
  missionId: string;
  destination: Destination;
  playerContext: PlayerContext;
  worksite: WorksiteProfile;
  terrain: "none" | "regolith";
  sky: "airless" | "interior";
  vehicle: "expedition-trainer";
};

// Destination describes the science target. Player context describes where the
// training vehicle actually operates; an asteroid target never grants a landing.
const lunar = new Set([3, 4, 5, 7, 9, 11]);
export const commanderPresentations: readonly MissionPresentation[] = Array.from({ length: 18 }, (_, index) => {
  const level = index + 1;
  const destination: Destination = lunar.has(level) ? "moon" : level >= 16 ? "asteroid" : level >= 13 ? "mars" : "earth";
  return Object.freeze({
    missionId: `mission-${level}`,
    destination,
    playerContext: lunar.has(level) ? "surface" : level === 15 || level <= 12 ? "orbit" : "cruise",
    worksite: level === 2 ? "satellite" : level === 8 ? "telescope" : level === 12 ? "relay" : "none",
    terrain: lunar.has(level) ? "regolith" : "none",
    sky: "airless",
    vehicle: "expedition-trainer",
  });
});

export function commanderPresentation(missionId: string | undefined, destination: Destination): MissionPresentation {
  const profile = commanderPresentations.find(p => p.missionId === missionId);
  if (profile) return profile;
  // Unknown/legacy preview contexts keep the destination but cannot invent EVA.
  return { missionId: missionId ?? "preview", destination, playerContext: destination === "earth" ? "orbit" : "cruise", worksite: "none", terrain: "none", sky: "airless", vehicle: "expedition-trainer" };
}

export function storyPresentation(scenario: Pick<StoryScenario, "missionId" | "destination" | "setting" | "role">) {
  const surface = scenario.role === "astronaut" && (scenario.setting === "moon" || scenario.setting === "mars");
  return {
    missionId: scenario.missionId,
    destination: scenario.destination,
    playerContext: surface ? "surface" : scenario.role === "mission operator" ? "mission-control" : scenario.setting === "orbit" ? "orbit" : "cruise",
    sky: surface && scenario.setting === "mars" ? "dusty" : "airless",
    historicCabin: false,
  } as const;
}

/** Construction limits, not measured device frame-rate promises. No tier adds
 * lights with shadows, postprocessing or a mandatory network asset. */
export const presentationBudgets = Object.freeze({
  battery: { rockInstances: 40, terrainSegments: 50, skyWidth: 512, detail: 1, worksiteSegments: 12 },
  balanced: { rockInstances: 135, terrainSegments: 90, skyWidth: 1024, detail: 2, worksiteSegments: 20 },
  quality: { rockInstances: 225, terrainSegments: 140, skyWidth: 1024, detail: 3, worksiteSegments: 28 },
});
