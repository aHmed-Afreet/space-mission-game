import {currentIncident,forecast,type Outpost} from "./engine";

export type MissionFocus="habitat"|"solar"|"shield"|"recycle"|"greenhouse"|"battery";
export type DayBrief={title:string;description:string;focus:MissionFocus;tip:string};
const lunar:DayBrief[]=[
 {title:"Power up your new Moon base",description:"Your astronauts need reliable electricity. Inspect the solar field and decide how to prepare the base.",focus:"solar",tip:"Solar arrays earn energy in daylight. Batteries are needed when the Sun is gone."},
 {title:"Grow food for your astronauts",description:"Your crew cannot live on stored meals forever. Visit the greenhouse and prepare for a harvest.",focus:"greenhouse",tip:"Growing crops costs electricity and water. A harvest converts growth into actual food."},
 {title:"Protect your crew from the Sun",description:"A solar radiation alert is approaching. Choose how to protect the crew, then prepare the storm shelter.",focus:"shield",tip:"Sheltering reduces radiation exposure but also uses supplies."},
 {title:"Prepare for the long lunar night",description:"Tomorrow, your solar panels will stop generating electricity. Save enough battery power for life support.",focus:"battery",tip:"Even a large solar field generates no electricity at night."},
 {title:"Survive without sunlight",description:"The base is in darkness. Choose which systems to conserve and keep essential equipment running.",focus:"battery",tip:"Turning off greenhouse lights reduces demand, but crops stop growing."},
 {title:"Keep air and water running",description:"Life support and your greenhouse compete for power and water. Check the recycling system.",focus:"recycle",tip:"If the battery runs out, recycling becomes less effective."},
 {title:"Repair the damaged water circuit",description:"A fault threatens your supply. Decide how to contain the leak, then inspect the crew habitat.",focus:"habitat",tip:"Emergency repair costs credits; isolating a leak sacrifices water and oxygen."},
 {title:"Prepare a final food supply",description:"The mission is nearing completion. Check crop growth and harvest enough food for the crew.",focus:"greenhouse",tip:"You need at least 22 units of food produced to complete the mission."},
 {title:"Face the final radiation warning",description:"A second solar warning is approaching. Keep shielding and crew safety within mission limits.",focus:"shield",tip:"Shield upgrades are useful before a storm; they cannot undo exposure already received."},
 {title:"Complete the outpost inspection",description:"One last day. Protect the crew, check resources and finish your ten-day demonstration.",focus:"habitat",tip:"You need safety 60+, shielding level 2, food production 22+ and remaining life support."}
];
const martian:DayBrief[]=[
 {title:"Start a reliable Mars power grid",description:"Mars receives less sunlight than the Moon in this simulation. Inspect solar generation and battery reserves.",focus:"solar",tip:"Solar arrays generate less energy on Mars; battery storage protects against dust."},
 {title:"Start greenhouse food production",description:"Plan your first harvest while reserving water for the crew.",focus:"greenhouse",tip:"Crops vary in growth rate, power demand, irrigation use and food yield."},
 {title:"Protect the crew during radiation alert",description:"A radiation warning is approaching. Decide whether to shelter or keep exterior work going.",focus:"shield",tip:"Radiation shielding lowers exposure over time."},
 {title:"A dust storm blocks the Sun",description:"Dust reduces power production. Choose an equipment response and inspect the solar field.",focus:"solar",tip:"Cleaning helps power but strains hardware and costs credits."},
 {title:"Ride out another dusty day",description:"Power remains limited. Balance essential systems and greenhouse lighting.",focus:"battery",tip:"Lowering electrical demand saves battery reserves."},
 {title:"Emergency: water circuit leak",description:"A life-support connector has failed. Handle the leak and check crew resources.",focus:"recycle",tip:"Repairing costs credits; isolating the circuit loses usable water."},
 {title:"Restore greenhouse supplies",description:"Your crew needs food for the final days. Check your plants and harvest available crops.",focus:"greenhouse",tip:"You must actually harvest crops to count them as produced food."},
 {title:"Protect equipment during dust",description:"Another storm is arriving. Decide whether to clean solar panels or protect hardware.",focus:"solar",tip:"Equipment integrity also affects your ability to grow crops."},
 {title:"Survive the radiation warning",description:"Keep your crew protected without exhausting your last supplies.",focus:"shield",tip:"Sheltering uses some food and battery power."},
 {title:"Final Mars base check",description:"Complete your ten-sol demonstration with a working greenhouse and safe crew.",focus:"habitat",tip:"The mission evaluates survival, food production, safety, shielding and radiation."}
];
export function dayBrief(s:Outpost):DayBrief{
  if(s.phase!=="active")return {title:s.phase==="won"?"Mission accomplished!":"Mission debrief",description:"Review the consequences of your decisions and the crew's final condition.",focus:"habitat",tip:""};
  const incident=currentIncident(s);
  const normal=(s.destination==="moon"?lunar:martian)[Math.max(0,Math.min(9,s.sol-1))];
  if(s.oxygen<23||s.water<23) return {title:"Emergency: protect life support",description:"Air or water reserves are running low. Inspect recycling or emergency stores before proceeding.",focus:"recycle",tip:"Low supplies can end the mission even if the crew has power."};
  if(s.food<19) return {title:"Emergency: crew needs food",description:"Food supplies are dangerously low. Visit the greenhouse or open emergency cargo.",focus:"greenhouse",tip:"You must harvest grown crops to turn them into usable food."};
  if(!incident && s.battery<15)return {title:"Power warning: battery nearly empty",description:"Protect your oxygen and water recycling by reducing power demand and checking battery storage.",focus:"battery",tip:"Power shortage reduces recycling efficiency and crew safety."};
  return normal;
}
export type StatKey="oxygen"|"water"|"food"|"battery"|"safety"|"radiation"|"crop";
export type StatChange={key:StatKey;label:string;before:number;after:number;delta:number};
const stats:{key:StatKey;label:string}[]=[
 {key:"oxygen",label:"Air"},{key:"water",label:"Water"},{key:"food",label:"Food"},
 {key:"battery",label:"Power"},{key:"safety",label:"Crew safety"},
 {key:"radiation",label:"Radiation"},{key:"crop",label:"Crop growth"}
];
export function dailyChanges(before:Outpost,after:Outpost):StatChange[]{
 return stats.map(({key,label})=>({key,label,before:before[key],after:after[key],delta:Math.round((after[key]-before[key])*10)/10}));
}
export function dayLesson(before:Outpost,after:Outpost):string{
 const state=forecast(before.destination,before.sol);
 const changes=dailyChanges(before,after);
 const biggest=changes.filter(c=>c.delta!==0).sort((a,b)=>Math.abs(b.delta)-Math.abs(a.delta))[0];
 if(after.phase==="lost")return "This attempt did not meet the mission's safety and sustainability requirements. Review the supplies and decisions that caused it.";
 if(state.sunlight===0)return "Without sunlight, the battery must provide power to the crew. Cutting non-essential demand protects life support.";
 if(state.dust)return "Martian dust reduced electricity generation. Equipment protection and energy reserves both matter.";
 if(state.storm)return "Radiation exposure depends on shielding and your emergency response. Protection has a resource cost.";
 return biggest ? biggest.label+" changed by "+(biggest.delta>0?"+":"")+biggest.delta+" today. Review the other meters to see what your decision traded away." : "Resources remained stable this day.";
}
