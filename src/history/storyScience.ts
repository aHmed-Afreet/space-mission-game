import type { HistoryMission } from "./missionHistory";
import { missionProfile } from "./missionProfiles";
export type StoryScienceExercise = {
 modelVersion: 1; title: string; provenance: "synthetic training data";
 rows: { label: string; value: number; unit: string }[];
 question: string; choices: [string, string]; correct: 0 | 1; explanation: string; source: string;
};
export type StoryScienceRecord = { version: 1; taskId: string; exercise: StoryScienceExercise; interpretation: 0 | 1 | null };
/** Numbers below are designed examples, never measurements attributed to NASA. */
export function storyScienceExercise(mission: HistoryMission): StoryScienceExercise {
 const common={modelVersion:1 as const,provenance:"synthetic training data" as const,source:mission.source};
 if(mission.title==="Explorer 1")return {...common,title:"Radiation counter saturation",rows:[
  {label:"Low-intensity pass",value:12,unit:"counts/s"},{label:"High-intensity test: counter saturated",value:0,unit:"reported counts/s"}],
  question:"Can a zero reported count prove there are no particles?",choices:["No. Check the detector's measurement range.","Yes. Zero always means no radiation."],correct:0,
  explanation:"A saturated detector can produce a misleading low or zero signal. Explorer 1's radiation observations required instrument interpretation; these example counts are invented for training."};
 if(mission.title==="Apollo 13")return {...common,title:"Emergency electrical budget",rows:[
  {label:"Training energy reserve",value:240,unit:"Wh"},{label:"Essential bus demand",value:20,unit:"W"},{label:"All-load demand",value:80,unit:"W"}],
  question:"Which configuration preserves the reserve longer?",choices:["Essential bus: 240 Wh / 20 W = 12 hours.","All loads: 240 Wh / 80 W = 12 hours."],correct:0,
  explanation:"Energy divided by power gives duration: essential loads last 12 h, all loads 3 h in this idealized example. It omits battery limits and other consumables and is not Apollo 13 telemetry."};
 if(/Gemini/.test(mission.title))return {...common,title:"Relative approach",rows:[
  {label:"Separation",value:30,unit:"m"},{label:"Closing speed",value:1,unit:"m/s"}],
  question:"What does the current closing speed imply before braking?",choices:["About 30 seconds to contact; reduce closure before approaching.","Matching position means relative speed is already zero."],correct:0,
  explanation:"Distance divided by closing speed gives 30 s in a constant-speed model. Rendezvous requires control of relative velocity as well as position. These are invented values, with orbital dynamics omitted."};
 if(mission.title==="Galileo Jupiter arrival")return {...common,title:"Downlink tradeoff",rows:[
  {label:"Uncompressed training image",value:800,unit:"kbit"},{label:"Example link rate",value:20,unit:"bit/s"},{label:"Compressed image",value:80,unit:"kbit"}],
  question:"How does this compression change transmission time?",choices:["It reduces 40,000 s to 4,000 s, with a possible detail tradeoff.","It increases radio propagation speed tenfold."],correct:0,
  explanation:"Bits divided by bits/s gives transmission duration; compression reduces the data volume, not light-travel time. The figures are synthetic and are not Galileo's measured link performance."};
 if(mission.category==="Telescope"||/Hubble/.test(mission.title))return {...common,title:"Pointing and calibration",rows:[
  {label:"Target signal",value:120,unit:"training detector units"},{label:"Dark reference",value:20,unit:"training detector units"}],
  question:"Which value removes this example detector offset?",choices:["Subtract the dark reference: corrected signal 100 units.","Add the dark reference: corrected signal 140 units."],correct:0,
  explanation:`Subtracting a measured background is one simplified calibration step. ${missionProfile(mission.title).observation}. These arbitrary detector units are not archived telescope readings.`};
 if(/Curiosity|Perseverance|Pathfinder|Viking/.test(mission.title))return {...common,title:"Compare surface samples",rows:[
  {label:"Sample A instrument response",value:18,unit:"arbitrary training units"},{label:"Sample B instrument response",value:21,unit:"arbitrary training units"},{label:"Repeatability bound",value:4,unit:"arbitrary training units"}],
  question:"Does this small difference establish different compositions?",choices:["No. Repeat measurements and inspect calibration and uncertainty.","Yes. One larger reading is conclusive."],correct:0,
  explanation:"A difference of 3 units is smaller than this example repeatability bound. This toy comparison is not a real instrument error model or evidence of a Martian composition."};
 return {...common,title:`${mission.title}: observation quality`,rows:[
  {label:"Example usable packets",value:9,unit:"packets"},{label:"Example transmitted packets",value:10,unit:"packets"}],
  question:`Before accepting this record (${missionProfile(mission.title).observation.toLowerCase()}), what should the team do?`,
  choices:["Check the missing packet, calibration and mission context.","Treat every transmitted packet as a verified observation."],correct:0,
  explanation:"Nine usable packets from ten transmitted gives a 90% usable fraction in this synthetic exercise. It describes data completeness, not a measurement of the historic mission's performance."};
}
export function validateStoryScienceRecord(value: unknown, mission: HistoryMission, taskIds: string[]): value is StoryScienceRecord {
 if(!value||typeof value!=="object"||Array.isArray(value))return false;
 const r=value as StoryScienceRecord;
 return r.version===1&&taskIds.includes(r.taskId)&&
  (r.interpretation===null||r.interpretation===0||r.interpretation===1)&&
  JSON.stringify(r.exercise)===JSON.stringify(storyScienceExercise(mission));
}
