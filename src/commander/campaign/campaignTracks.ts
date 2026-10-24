import type { MissionDefinition } from "./definitions";

/** Every Commander mission belongs to one campaign only.
 * Existing mission IDs are never renamed: browser saves and flight reports survive.
 */
export const campaignTracks = [
  {
    id:"orbit", name:"Orbital Training", destination:"earth",
    description:"Learn to command a spacecraft, operate its systems and recover safely.",
    missions:["mission-1","mission-6","mission-10"],
    accent:"earth",
  },
  {
    id:"satellite", name:"Satellite Repair & EVA", destination:"earth",
    description:"Rendezvous with orbiting equipment, perform spacewalks and repair hardware.",
    missions:["mission-2","mission-8","mission-12"],
    accent:"orbit",
  },
  {
    id:"landings", name:"Moon Landings", destination:"moon",
    description:"Pilot a lunar approach, touch down and explore rugged terrain.",
    missions:["mission-3","mission-5","mission-9"],
    accent:"moon",
  },
  {
    id:"research", name:"Lunar Research", destination:"moon",
    description:"Establish science stations, gather samples and deploy experiments.",
    missions:["mission-4","mission-7","mission-11"],
    accent:"research",
  },
  {
    id:"mars", name:"Mars Exploration", destination:"mars",
    description:"Begin with an orbital reconnaissance flight before future surface missions.",
    missions:["mission-13","mission-14","mission-15"],
    accent:"mars",
  },
  {
    id:"deep", name:"Deep Space Exploration", destination:"asteroid",
    description:"Begin with a remote asteroid science flight. More missions will follow.",
    missions:["mission-16"],
    accent:"deep",
  },
] as const;
export type CampaignTrack = (typeof campaignTracks)[number];
export type CampaignTrackId = CampaignTrack["id"];
export type CampaignDestination = "earth" | "moon" | "mars" | "asteroid";
export const destinationOptions: {id:CampaignDestination;name:string;description:string}[]=[
  {id:"earth",name:"Earth",description:"Orbital systems and spacecraft repair"},
  {id:"moon",name:"The Moon",description:"Landings, geology and research"},
  {id:"mars",name:"Mars",description:"Mars orbital reconnaissance"},
  {id:"asteroid",name:"Deep Space",description:"Asteroid and distant-object science"},
];
export function trackForMission(m: Pick<MissionDefinition,"id">): CampaignTrack | undefined {
  return campaignTracks.find(t => (t.missions as readonly string[]).includes(m.id));
}
export function levelInTrack(m: Pick<MissionDefinition,"id">): number {
  const track=trackForMission(m);
  return track ? (track.missions as readonly string[]).indexOf(m.id)+1 : 0;
}
export function previousTrackMission(m: Pick<MissionDefinition,"id">): string | null {
  const track=trackForMission(m);
  const index=track ? (track.missions as readonly string[]).indexOf(m.id) : -1;
  return track && index>0 ? track.missions[index-1] : null;
}
