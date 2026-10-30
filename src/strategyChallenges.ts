import { components, rockets, trajectories, type Design, type Delta } from "./game";
import {strategyResources, strategyEnergyIssues, type StrategyEnergy} from './strategyEnergy';
export type StrategyChallenge={
 id:string;level:number;title:string;brief:string;
 minScience:number;minReliability:number;minFuel:number;minCommunication:number;budgetCap:number;
 required:Record<string,number>;trajectory?:number;massCap?:number;
};
// The supplied first mission has science headroom for any flight-event deck.
export const strategyStarter:Design={counts:{camera:1,spectrometer:1,solar:1,battery:1,tank:1,antenna:1},rocket:0,trajectory:1};
export const strategyChallenges:StrategyChallenge[] = [
  {
    "id": "strategy-1",
    "level": 1,
    "title": "Mars Water Scout",
    "brief": "Establish a reliable water-search probe.",
    "minScience": 30,
    "minReliability": 45,
    "minFuel": 12,
    "minCommunication": 45,
    "budgetCap": 220,
    "required": {}
  },
  {
    "id": "strategy-2",
    "level": 2,
    "title": "High Resolution Mapping",
    "brief": "Add a surface camera and return detailed images.",
    "minScience": 35,
    "minReliability": 45,
    "minFuel": 12,
    "minCommunication": 48,
    "budgetCap": 220,
    "required": {
      "camera": 1
    }
  },
  {
    "id": "strategy-3",
    "level": 3,
    "title": "Ice Radar Survey",
    "brief": "Carry subsurface radar to investigate buried ice.",
    "minScience": 40,
    "minReliability": 42,
    "minFuel": 12,
    "minCommunication": 50,
    "budgetCap": 220,
    "required": {
      "radar": 1
    }
  },
  {
    "id": "strategy-4",
    "level": 4,
    "title": "Power Reserve Trial",
    "brief": "Demonstrate strong power reserve during flight.",
    "minScience": 38,
    "minReliability": 50,
    "minFuel": 15,
    "minCommunication": 52,
    "budgetCap": 215,
    "required": {
      "battery": 1
    }
  },
  {
    "id": "strategy-5",
    "level": 5,
    "title": "Solar Weather Shield",
    "brief": "Protect instruments against energetic solar conditions.",
    "minScience": 38,
    "minReliability": 58,
    "minFuel": 12,
    "minCommunication": 52,
    "budgetCap": 220,
    "required": {
      "shield": 1
    }
  },
  {
    "id": "strategy-6",
    "level": 6,
    "title": "Communications Upgrade",
    "brief": "Provide strong links across the deep-space transfer.",
    "minScience": 38,
    "minReliability": 52,
    "minFuel": 12,
    "minCommunication": 75,
    "budgetCap": 220,
    "required": {
      "antenna": 1
    }
  },
  {
    "id": "strategy-7",
    "level": 7,
    "title": "Fuel Discipline",
    "brief": "Preserve reserve fuel for unexpected corrections.",
    "minScience": 30,
    "minReliability": 48,
    "minFuel": 28,
    "minCommunication": 56,
    "budgetCap": 220,
    "required": {
      "tank": 1
    }
  },
  {
    "id": "strategy-8",
    "level": 8,
    "title": "Fast Transfer Probe",
    "brief": "Design a science craft for the high-energy fast transfer.",
    "minScience": 35,
    "minReliability": 45,
    "minFuel": 12,
    "minCommunication": 55,
    "budgetCap": 220,
    "required": {},
    "trajectory": 0
  },
  {
    "id": "strategy-9",
    "level": 9,
    "title": "Economy Explorer",
    "brief": "Use limited money without sacrificing mission safety.",
    "minScience": 30,
    "minReliability": 40,
    "minFuel": 12,
    "minCommunication": 53,
    "budgetCap": 180,
    "required": {}
  },
  {
    "id": "strategy-10",
    "level": 10,
    "title": "Heavy Science Payload",
    "brief": "Fly both radar and camera while keeping enough power.",
    "minScience": 65,
    "minReliability": 45,
    "minFuel": 10,
    "minCommunication": 52,
    "budgetCap": 220,
    "required": {
      "camera": 1,
      "radar": 1
    }
  },
  {
    "id": "strategy-11",
    "level": 11,
    "title": "Redundant Communications",
    "brief": "Carry two antennas for high-rate science downlink.",
    "minScience": 35,
    "minReliability": 46,
    "minFuel": 10,
    "minCommunication": 87,
    "budgetCap": 220,
    "required": {
      "antenna": 2
    }
  },
  {
    "id": "strategy-12",
    "level": 12,
    "title": "Robust Systems",
    "brief": "Deliver a reliability-oriented engineering package.",
    "minScience": 35,
    "minReliability": 78,
    "minFuel": 12,
    "minCommunication": 58,
    "budgetCap": 220,
    "required": {
      "battery": 1,
      "shield": 1
    }
  },
  {
    "id": "strategy-13",
    "level": 13,
    "title": "Lightweight Path",
    "brief": "Keep spacecraft mass low while preserving research goals.",
    "minScience": 35,
    "minReliability": 48,
    "minFuel": 10,
    "minCommunication": 53,
    "budgetCap": 215,
    "required": {},
    "massCap": 950
  },
  {
    "id": "strategy-14",
    "level": 14,
    "title": "Long Cruise Research",
    "brief": "Save fuel using an extended interplanetary transfer.",
    "minScience": 50,
    "minReliability": 48,
    "minFuel": 12,
    "minCommunication": 60,
    "budgetCap": 220,
    "required": {},
    "trajectory": 2
  },
  {
    "id": "strategy-15",
    "level": 15,
    "title": "Double Spectrometer",
    "brief": "Build an unusually sensitive water-sensing payload.",
    "minScience": 65,
    "minReliability": 46,
    "minFuel": 10,
    "minCommunication": 60,
    "budgetCap": 220,
    "required": {
      "spectrometer": 2
    }
  },
  {
    "id": "strategy-16",
    "level": 16,
    "title": "Radar and Power",
    "brief": "Install radar and dual arrays for resource-intensive science.",
    "minScience": 62,
    "minReliability": 48,
    "minFuel": 10,
    "minCommunication": 52,
    "budgetCap": 220,
    "required": {
      "radar": 1,
      "solar": 2
    }
  },
  {
    "id": "strategy-17",
    "level": 17,
    "title": "Exploration Reliability",
    "brief": "Qualify shielding plus redundant reserve energy.",
    "minScience": 44,
    "minReliability": 77,
    "minFuel": 13,
    "minCommunication": 65,
    "budgetCap": 220,
    "required": {
      "shield": 1,
      "battery": 2
    }
  },
  {
    "id": "strategy-18",
    "level": 18,
    "title": "High-Value Mission",
    "brief": "Earn an excellent final flight score with improved science.",
    "minScience": 60,
    "minReliability": 62,
    "minFuel": 15,
    "minCommunication": 70,
    "budgetCap": 220,
    "required": {
      "camera": 1,
      "radar": 1
    }
  },
  {
    "id": "strategy-19",
    "level": 19,
    "title": "Mars Science Flagship",
    "brief": "Combine advanced sensors and communications redundancy.",
    "minScience": 72,
    "minReliability": 55,
    "minFuel": 10,
    "minCommunication": 85,
    "budgetCap": 220,
    "required": {
      "radar": 1,
      "camera": 1,
      "antenna": 2
    }
  },
  {
    "id": "strategy-20",
    "level": 20,
    "title": "Mission Architect",
    "brief": "Prove a balanced high-performance spacecraft.",
    "minScience": 80,
    "minReliability": 62,
    "minFuel": 16,
    "minCommunication": 86,
    "budgetCap": 220,
    "required": {
      "camera": 1,
      "radar": 1,
      "antenna": 2
    }
  }
];
export const STRATEGY_SAVE_KEY="orbital-strategy-levels-v1";
export const STRATEGY_RECEIPT_PREFIX="orbital-strategy-best-v1:";
export type StrategyStorage=Pick<Storage,"getItem"|"setItem"> & Partial<Pick<Storage,"key"|"length">>;
export function strategyStorage(host:{readonly localStorage:StrategyStorage}|undefined=typeof window==="undefined"?undefined:window):StrategyStorage|undefined{
 try{return host?.localStorage;}catch{return undefined;}
}
function parseStrategyProgress(value:string|null):Record<string,number>{
 const x:unknown=value===null?{}:JSON.parse(value);
 if(!x||typeof x!=="object"||Array.isArray(x)||Object.entries(x).some(([k,v])=>!/^strategy-\d+$/.test(k)||typeof v!=="number"||!Number.isFinite(v)||v<0||v>100))throw Error('Unsupported Strategy progress; stored bytes were preserved');
 return {...x} as Record<string,number>;
}
export function readStrategyProgressStrict(storage:Pick<StrategyStorage,'getItem'|'key'|'length'>|undefined):Record<string,number>{
 if(!storage)throw Error('Browser storage is unavailable');
 const progress=parseStrategyProgress(storage.getItem(STRATEGY_SAVE_KEY));
 if(storage.key&&typeof storage.length==='number')for(let i=0;i<storage.length;i++){
  const key=storage.key(i);
  if(!key?.startsWith(STRATEGY_RECEIPT_PREFIX))continue;
  const match=/^(strategy-\d+):((?:0|[1-9]\d*)(?:\.\d+)?(?:e[+-]?\d+)?)$/.exec(key.slice(STRATEGY_RECEIPT_PREFIX.length));
  if(!match||!Number.isFinite(Number(match[2]))||Number(match[2])>100||storage.getItem(key)!=='earned')throw Error('Unsupported Strategy receipt; stored bytes were preserved');
  progress[match[1]]=Math.max(progress[match[1]]??0,Number(match[2]));
 }
 return progress;
}
export function readStrategyProgress(storage?:Pick<StrategyStorage,'getItem'|'key'|'length'>):Record<string,number>{
 try{return readStrategyProgressStrict(storage);}catch{return {};}
}
export function recordStrategyScore(progress:Record<string,number>,id:string,score:number):Record<string,number>{
 return (progress[id]||0)>=score?progress:{...progress,[id]:score};
}
export function saveStrategyProgress(progress:Record<string,number>,storage:StrategyStorage|undefined=strategyStorage()):{saved:true;progress:Record<string,number>}|{saved:false}{
 try{
  if(!storage)return {saved:false};
  // Read before writing so a retry or another tab cannot erase existing bests.
  // A read error leaves storage untouched and can be retried when it recovers.
  let next=readStrategyProgressStrict(storage);
  parseStrategyProgress(JSON.stringify(progress));
  for(const [id,score] of Object.entries(progress))next=recordStrategyScore(next,id,score);
  // Immutable earned receipts retain a concurrent tab's higher score even if
  // localStorage's non-atomic summary write is interleaved by another tab.
  for(const [id,score] of Object.entries(next))storage.setItem(`${STRATEGY_RECEIPT_PREFIX}${id}:${score}`,'earned');
  storage.setItem(STRATEGY_SAVE_KEY,JSON.stringify(next));
  return {saved:true,progress:next};
 }catch{return {saved:false};}
}
export function strategyBudget(cost:number,budgetCap:number){
 const maintained=cost<=budgetCap;
 return {remaining:budgetCap-cost,percent:100-cost/budgetCap*100,exceeded:!maintained,
  allocation:`$${cost}M allocated / $${budgetCap}M`,
  detail:`Spent $${cost}M of $${budgetCap}M. ${maintained?'Budget maintained.':'Event costs exceeded your allocation.'}`};
}
export function strategyDebrief(success:boolean,score:number){
 return {headline:!success?'Mission needs refinement.':score>=75?'Discovery delivered.':'Mission completed.',scoreLabel:'PERFORMANCE SCORE'};
}
export function strategyUnlocked(index:number,progress:Record<string,number>){
 return index===0||!!progress[strategyChallenges[index-1].id];
}
export function strategyIssues(d:Design,c:StrategyChallenge,delta?:Delta,energy?:StrategyEnergy):string[]{
 const r=strategyResources(d,delta,energy);
 const checks=[
  r.cost>c.budgetCap?`Mission spending must stay at or below $${c.budgetCap}M.`:"",
  r.science<c.minScience?`Science capability must reach ${c.minScience}.`:"",
  r.reliability<c.minReliability?`Flight reliability index must reach ${c.minReliability}.`:"",
  r.fuel<c.minFuel?`Fuel reserve must reach ${c.minFuel} units.`:"",
  r.communication<c.minCommunication?`Communications must reach ${c.minCommunication}.`:"",
  c.massCap&&r.mass>c.massCap?`Vehicle mass must stay below ${c.massCap} kg.`:"",
  c.trajectory!==undefined&&d.trajectory!==c.trajectory?`Select ${trajectories[c.trajectory].name}.`:"",
  ...Object.entries(c.required).map(([id,num])=>(d.counts[id]||0)<num?`Install ${num} × ${components.find(x=>x.id===id)?.name||id}.`:""),
  r.mass>rockets[d.rocket].payload?"The rocket payload is not large enough.":"",
  ...strategyEnergyIssues(d,delta,energy),
 ];
 return checks.filter(Boolean);
}
export function strategyGoalMet(d:Design,c:StrategyChallenge,delta:Delta,score:number,energy?:StrategyEnergy){
 return strategyIssues(d,c,delta,energy).length===0&&score>=45;
}
