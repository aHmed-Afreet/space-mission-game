import type { StrategyChallenge } from "./strategyChallenges";
import type { Design } from "./game";

/** Fictional mission commander for Strategy Mode. Player acts as a ground engineer:
 * the commander flies; the player configures hardware and handles ground decisions. */
export const pilot = {
  name: "Commander Alex Morgan",
  role: "Astronaut / flight crew",
  note: "Fictional astronaut — ORBITAL educational simulation",
};
export function pilotBriefing(c: StrategyChallenge) {
  const requirements = Object.entries(c.required)
    .filter(([,qty])=>qty>0)
    .map(([part,qty])=>`${qty} × ${part.replace(/([A-Z])/g," $1")}`);
  return {
    title: `Commander request — ${c.title}`,
    message: `Ground Engineer, I'm assigned to ${c.brief.toLowerCase()} I need you to configure my spacecraft, launch vehicle, transfer trajectory and science payload. I'll handle flight controls once you've approved the design.`,
    requirements: [
      ...requirements.map(item=>`Include ${item} in my payload.`),
      `Science ≥ ${c.minScience}; reliability ≥ ${c.minReliability}.`,
      `Fuel ≥ ${c.minFuel}; communication ≥ ${c.minCommunication}.`,
      `Stay within the $ ${c.budgetCap}M level budget.`,
      ...(c.trajectory!==undefined ? [`Use the specified trajectory option ${c.trajectory+1}.`] : []),
      ...(c.massCap!==undefined ? [`Keep mass ≤ ${c.massCap} kg.`] : []),
    ],
  };
}
export function flightMessage(progress: number, design: Design) {
  if(progress<25)return "Pilot: Liftoff confirmed. Mission Control, monitor vehicle performance — flight controls are mine.";
  if(progress<70)return `Pilot: Transfer flight underway on trajectory ${design.trajectory+1}. Watch energy, fuel and science telemetry.`;
  return "Pilot: Approaching Mars operations. Ground Engineer, prepare to advise me on any anomaly.";
}
export function eventMessage(title:string){
  return `Pilot to Mission Control: ${title}. I need your engineering decision before proceeding. Choose a response and I'll execute it.`;
}
