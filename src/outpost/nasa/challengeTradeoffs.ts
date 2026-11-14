import {ACTIONS,advanceSol,availableAction,currentIncident,perform,projectPower,type Action,type Outpost} from "../engine";

/** Pure comparison of a single optional engineering choice.
 * Uses the SAME model as live gameplay without touching browser saves.
 * Real NASA sources explain engineering relationships, not numerical values. */
export const CHALLENGE_CHOICES=["solar","recycler","greenhouse","shield","battery","harvest"] as const;
export type ChallengeChoice=(typeof CHALLENGE_CHOICES)[number];
export type MissionProjection={
 action:ChallengeChoice;
 title:string;
 available:boolean;
 reason:string;
 creditsCost:number;
 currentPower:{generation:number;demand:number;projectedBattery:number};
 plannedPower:{generation:number;demand:number;projectedBattery:number};
 before:{oxygen:number;water:number;food:number;shielding:number;solar:number;recycling:number;greenhouses:number};
 after:{oxygen:number;water:number;food:number;shielding:number;solar:number;recycling:number;greenhouses:number};
 nextSol:{oxygen:number;water:number;food:number;battery:number;crop:number;radiation:number}|null;
 awaitingEmergency:boolean;
};
export function projectEngineeringChoice(s:Readonly<Outpost>,action:ChallengeChoice):MissionProjection{
 const state=s as Outpost;
 const possible=availableAction(state,action);
 const item=ACTIONS.find(a=>a.id===action)!;
 const planned=possible.ok?perform(state,action):state;
 const base=projectPower(state),power=projectPower(planned);
 const emergency=currentIncident(planned);
 const awaitingEmergency=Boolean(emergency&&planned.incidentSol!==planned.sol);
 // Without a completed emergency response there is no valid next-sol
 // prediction. We do not bypass the existing emergency decision.
 const next=planned.selected&&!awaitingEmergency?advanceSol(planned):null;
 const resourceKeys=["oxygen","water","food","shielding","solar","recycling","greenhouses"] as const;
 const resources=(snapshot:Outpost)=>Object.fromEntries(resourceKeys.map(k=>[k,snapshot[k]])) as MissionProjection["before"];
 return {
  action,title:item.title,available:possible.ok,reason:possible.reason??"",
  creditsCost:item.cost,
  currentPower:{generation:base.generation,demand:base.demand,projectedBattery:base.projectedBattery},
  plannedPower:{generation:power.generation,demand:power.demand,projectedBattery:power.projectedBattery},
  before:resources(state),after:resources(planned),
  nextSol:next?{oxygen:next.oxygen,water:next.water,food:next.food,battery:next.battery,crop:next.crop,radiation:next.radiation}:null,
  awaitingEmergency
 };
}
export function missionEngineeringLesson(choice:ChallengeChoice):string{
 switch(choice){
 case "solar":return "Extra solar panels increase daytime generation, but they cannot make electricity during simulated lunar night; storage still matters.";
 case "recycler":return "Water and air recycling recover more crew resources, but the equipment draws electrical power.";
 case "greenhouse":return "More growing space can increase food production, while lighting, water and maintenance compete with life support.";
 case "shield":return "Better shielding reduces simulated crew radiation exposure; a shelter has construction costs and does not produce oxygen or electricity.";
 case "battery":return "Batteries store energy for low-sunlight periods. They do not generate electricity.";
 case "harvest":return "Harvesting converts existing crop growth into food; the greenhouse must first produce enough crops.";
 }
}
