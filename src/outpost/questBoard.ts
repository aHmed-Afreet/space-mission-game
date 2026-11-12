import {missionSchedule,dayBrief} from "./missionFlow";
import type {Outpost} from "./engine";

export type Quest={id:string;title:string;detail:string;progress:number;goal:number;done:boolean;unit:string};
/** Optional challenges evaluate the REAL resources already stored in v2. No
 * invisible rewards or unsupported mission state are created. */
export function sideQuests(s:Readonly<Outpost>):Quest[]{
 const raw=[
  {id:"shield",title:"Radiation ready",detail:"Upgrade the shelter to level 2.",value:s.shielding,goal:2,unit:"level"},
  {id:"harvest",title:"Homegrown food",detail:"Harvest at least 22 units of food.",value:s.foodProduced,goal:22,unit:"units"},
  {id:"recycling",title:"Close the loop",detail:"Upgrade air and water recycling to level 2.",value:s.recycling,goal:2,unit:"level"},
  {id:"solar",title:"Power builder",detail:"Expand the solar field to three arrays.",value:s.solar,goal:3,unit:"arrays"},
  {id:"plants",title:"Green thumb",detail:"Expand the greenhouse to level 2.",value:s.greenhouses,goal:2,unit:"level"},
  {id:"reserve",title:"Emergency water reserve",detail:"Keep at least 60% of the water supply.",value:s.water,goal:60,unit:"%"},
  {id:"safe",title:"Crew first",detail:"Keep crew safety at 80% or higher.",value:s.safety,goal:80,unit:"%"},
 ] as const;
 return raw.map(q=>({id:q.id,title:q.title,detail:q.detail,
   progress:Math.min(q.goal,Math.max(0,q.value)),goal:q.goal,done:q.value>=q.goal,unit:q.unit}));
}
export function allMainMissions(s:Readonly<Outpost>){
 return missionSchedule(s.destination).map((planned,index)=>({
  day:index+1,planned,
  current:index+1===s.sol,
  done:index+1<s.sol,
  status:index+1<s.sol?"COMPLETED":index+1===s.sol?"IN PROGRESS":"UPCOMING",
 }));
}
export function currentMainMission(s:Outpost){return dayBrief(s);}
