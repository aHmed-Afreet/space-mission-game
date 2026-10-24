/** Commander branches have independent numbering and unlocks.
 * Keep historical mission IDs unchanged so local saved flights/reports still load.
 */
export const campaigns = [
  { id:"earth-orbit", destination:"earth", icon:"🌍", name:"Orbital Training", eyebrow:"EARTH / FLIGHT SCHOOL",
    description:"Operate the spacecraft, test power and conduct orbital research.",missionIds:["mission-1","mission-6","mission-10"] },
  { id:"satellite",destination:"earth",icon:"🛰️",name:"Satellite Repair & EVA",eyebrow:"EARTH / SPACEWALK OPERATIONS",
    description:"Rendezvous, inspect hardware and restore orbiting satellites.",missionIds:["mission-2","mission-8","mission-12"] },
  { id:"lunar-landing",destination:"moon",icon:"🌕",name:"Lunar Landings",eyebrow:"MOON / LANDING & EXPLORATION",
    description:"Descend to the lunar surface and explore geological sites.",missionIds:["mission-3","mission-5","mission-7","mission-9"] },
  { id:"lunar-research",destination:"moon",icon:"🔬",name:"Scientific Research",eyebrow:"MOON / SCIENCE STATIONS",
    description:"Build a research camp and deploy scientific instruments.",missionIds:["mission-4","mission-11"] },
  { id:"mars",destination:"mars",icon:"🔴",name:"Mars Exploration",eyebrow:"MARS / CRUISE & ORBIT",
    description:"Pilot Mars cruise, navigation and observation training flights.",missionIds:["mission-13","mission-14","mission-15"] },
  { id:"deep",destination:"asteroid",icon:"☄️",name:"Deep Space",eyebrow:"DEEP SPACE / ASTEROID APPROACH",
    description:"Operate remote asteroid survey and deep-space research flights.",missionIds:["mission-16","mission-17","mission-18"] },
] as const;
export type CampaignId = (typeof campaigns)[number]["id"];
export const campaignById = (id: string) => campaigns.find(c=>c.id===id);
export const campaignForMission = (id: string) => campaigns.find(c=>
  (c.missionIds as readonly string[]).includes(id));
export const campaignLevel = (id: string) => {
  const group=campaignForMission(id);
  return group ? (group.missionIds as readonly string[]).indexOf(id)+1 : 0;
};
export const previousInCampaign = (id: string) => {
  const group=campaignForMission(id);
  if (!group) return undefined;
  const n=(group.missionIds as readonly string[]).indexOf(id);
  return n>0 ? group.missionIds[n-1] : undefined;
};
