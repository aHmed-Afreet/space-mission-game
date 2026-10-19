import { components, resources, rockets, trajectories, type Design, type Delta, zero } from "./game";
export type StrategyMission={
 id:string;number:number;title:string;description:string;budget:number;required:string[];
 minScience:number;minPower:number;minFuel:number;minCommunication:number;minReliability:number;
 focus:string;scienceGoal:string;minScore:number;
};
export const strategyMissions:StrategyMission[]=[
  {
    "id": "plan-1",
    "number": 1,
    "title": "Water Signature Survey",
    "description": "Map potential water signatures on Mars with an efficient science orbiter.",
    "budget": 200,
    "required": [
      "spectrometer",
      "antenna"
    ],
    "minScience": 35,
    "minPower": 10,
    "minFuel": 10,
    "minCommunication": 0,
    "minReliability": 50,
    "focus": "spectrometer",
    "scienceGoal": "Water-signature detection",
    "minScore": 55
  },
  {
    "id": "plan-2",
    "number": 2,
    "title": "Crater Reconnaissance",
    "description": "Photograph a candidate exploration region and transmit geological context images.",
    "budget": 205,
    "required": [
      "camera",
      "spectrometer",
      "antenna"
    ],
    "minScience": 45,
    "minPower": 10,
    "minFuel": 13,
    "minCommunication": 0,
    "minReliability": 52,
    "focus": "camera",
    "scienceGoal": "Terrain imagery",
    "minScore": 56
  },
  {
    "id": "plan-3",
    "number": 3,
    "title": "Ice-Mapping Radar",
    "description": "Combine radar and spectrometer data to investigate buried ice.",
    "budget": 230,
    "required": [
      "radar",
      "spectrometer",
      "antenna"
    ],
    "minScience": 75,
    "minPower": 11,
    "minFuel": 14,
    "minCommunication": 0,
    "minReliability": 54,
    "focus": "radar",
    "scienceGoal": "Subsurface ice",
    "minScore": 57
  },
  {
    "id": "plan-4",
    "number": 4,
    "title": "Dust-Storm Resilience",
    "description": "Protect a Mars science spacecraft against interruptions to sunlight and telemetry.",
    "budget": 225,
    "required": [
      "shield",
      "battery",
      "spectrometer",
      "antenna"
    ],
    "minScience": 35,
    "minPower": 25,
    "minFuel": 14,
    "minCommunication": 0,
    "minReliability": 52,
    "focus": "shield",
    "scienceGoal": "Dust and radiation protection",
    "minScore": 57
  },
  {
    "id": "plan-5",
    "number": 5,
    "title": "Power Autonomy Test",
    "description": "Operate a science payload with redundant arrays and battery reserves.",
    "budget": 225,
    "required": [
      "solar",
      "battery",
      "spectrometer",
      "antenna"
    ],
    "minScience": 36,
    "minPower": 42,
    "minFuel": 13,
    "minCommunication": 0,
    "minReliability": 56,
    "focus": "solar",
    "scienceGoal": "Energy resilience",
    "minScore": 57
  },
  {
    "id": "plan-6",
    "number": 6,
    "title": "Relay Communications",
    "description": "Deliver a dependable deep-space communications package for a remote surface team.",
    "budget": 215,
    "required": [
      "antenna",
      "spectrometer",
      "solar"
    ],
    "minScience": 37,
    "minPower": 13,
    "minFuel": 15,
    "minCommunication": 65,
    "minReliability": 50,
    "focus": "antenna",
    "scienceGoal": "Communications reliability",
    "minScore": 58
  },
  {
    "id": "plan-7",
    "number": 7,
    "title": "Geological Observer",
    "description": "Balance camera, spectroscopy and radar into a Mars science survey spacecraft.",
    "budget": 260,
    "required": [
      "camera",
      "radar",
      "spectrometer",
      "antenna"
    ],
    "minScience": 88,
    "minPower": 12,
    "minFuel": 16,
    "minCommunication": 0,
    "minReliability": 53,
    "focus": "camera",
    "scienceGoal": "Geological classification",
    "minScore": 59
  },
  {
    "id": "plan-8",
    "number": 8,
    "title": "Polar Ice Expedition",
    "description": "Plan a heavier science spacecraft for Mars polar ice reconnaissance.",
    "budget": 255,
    "required": [
      "radar",
      "spectrometer",
      "shield",
      "antenna"
    ],
    "minScience": 68,
    "minPower": 13,
    "minFuel": 17,
    "minCommunication": 0,
    "minReliability": 55,
    "focus": "radar",
    "scienceGoal": "Mars polar research",
    "minScore": 60
  },
  {
    "id": "plan-9",
    "number": 9,
    "title": "Solar Efficiency Trial",
    "description": "Test how a lightweight robotic probe survives energy-demanding science operations.",
    "budget": 225,
    "required": [
      "solar",
      "battery",
      "spectrometer",
      "antenna"
    ],
    "minScience": 40,
    "minPower": 45,
    "minFuel": 18,
    "minCommunication": 0,
    "minReliability": 58,
    "focus": "battery",
    "scienceGoal": "Power budgeting",
    "minScore": 60
  },
  {
    "id": "plan-10",
    "number": 10,
    "title": "Resilient Orbital Observatory",
    "description": "Build a mission capable of sustaining science through electrical and radio anomalies.",
    "budget": 260,
    "required": [
      "battery",
      "shield",
      "antenna",
      "spectrometer"
    ],
    "minScience": 45,
    "minPower": 22,
    "minFuel": 22,
    "minCommunication": 65,
    "minReliability": 61,
    "focus": "shield",
    "scienceGoal": "Spacecraft fault tolerance",
    "minScore": 61
  },
  {
    "id": "plan-11",
    "number": 11,
    "title": "Long-Range Data Return",
    "description": "Prioritize communications, protection and fuel for a long robotic Mars mission.",
    "budget": 260,
    "required": [
      "antenna",
      "shield",
      "tank",
      "spectrometer"
    ],
    "minScience": 48,
    "minPower": 20,
    "minFuel": 25,
    "minCommunication": 72,
    "minReliability": 57,
    "focus": "antenna",
    "scienceGoal": "Deep-space downlink",
    "minScore": 62
  },
  {
    "id": "plan-12",
    "number": 12,
    "title": "Flagship Mars Science",
    "description": "Integrate a high-performance multi-instrument mission while meeting strict engineering goals.",
    "budget": 290,
    "required": [
      "camera",
      "radar",
      "spectrometer",
      "shield",
      "antenna"
    ],
    "minScience": 95,
    "minPower": 24,
    "minFuel": 28,
    "minCommunication": 70,
    "minReliability": 62,
    "focus": "radar",
    "scienceGoal": "Integrated scientific operations",
    "minScore": 64
  }
];
export const STRATEGY_PROGRESS_KEY="orbital-strategy-progress-v1";
export function readStrategyProgress(store?:Pick<Storage,"getItem">):number {
  try {
    const raw=Number(store?.getItem(STRATEGY_PROGRESS_KEY)||"1");
    return Number.isInteger(raw)?Math.max(1,Math.min(strategyMissions.length,raw)):1;
  } catch{return 1}
}
export function strategyErrors(d:Design,m:StrategyMission,delta:Delta=zero):string[] {
  const r=resources(d,delta);
  const missing=m.required.filter(id=>!d.counts[id]).map(id=>"Install "+(components.find(c=>c.id===id)?.name||id)+".");
  return [
    r.cost>m.budget?`Mission cost exceeds the $${m.budget}M allocation.`:"",
    r.mass>rockets[d.rocket].payload?"Payload exceeds rocket capacity.":"",
    r.power<m.minPower?`Keep at least ${m.minPower} W electrical margin.`:"",
    r.fuel<m.minFuel?`Keep at least ${m.minFuel} fuel reserve units.`:"",
    r.science<m.minScience?`Increase science potential to ${m.minScience} points.`:"",
    r.communication<m.minCommunication?`Increase communication capability to ${m.minCommunication} points.`:"",
    r.reliability<m.minReliability?`Raise spacecraft reliability to ${m.minReliability}.`:"",
    ...missing
  ].filter(Boolean);
}
export function qualifyStrategy(d:Design,score:number,m:StrategyMission,delta:Delta):boolean {
 return score>=m.minScore&&strategyErrors(d,m,delta).length===0;
}
