import {BASE_FACILITIES,doorPosition,distance,type Point2} from "./worldLogic";
import {currentIncident,type Outpost} from "./engine";
import {dayBrief} from "./missionFlow";
import type {FacilityId} from "./FacilityScene";

/** Facility purposes match the equipment the astronaut can operate. */
export const FACILITY_GUIDE:Record<FacilityId,{purpose:string;task:string}>={
 habitat:{purpose:"Protects the astronauts and houses crew recovery equipment.",task:"Repair the habitat, restore crew safety, or unpack emergency supplies."},
 solar:{purpose:"Produces electricity when sunlight reaches the panels.",task:"Expand solar arrays. During Martian dust, operate the cleaning robot."},
 shield:{purpose:"Shields the astronauts from dangerous radiation.",task:"Reinforce shielding, and respond to radiation warnings."},
 recycle:{purpose:"Recycles air and water for the crew.",task:"Upgrade oxygen and water recycling; respond to water leaks."},
 greenhouse:{purpose:"Grows food but uses water and electricity.",task:"Select a crop, plant seeds, expand the greenhouse, or harvest food."},
 battery:{purpose:"Stores solar energy for darkness and storms.",task:"Add battery capacity and decide whether to conserve power or grow crops."},
};
const emergencyDestination:Record<string,FacilityId>={
 radiation:"shield",blackout:"battery",dust:"solar",leak:"recycle"
};
export function missionDestination(s:Outpost):FacilityId{
 const incident=currentIncident(s);
 if(incident && s.incidentSol!==s.sol) return emergencyDestination[incident.id]??"habitat";
 return dayBrief(s).focus;
}
export function compassDirection(from:Point2,to:Point2):string{
 const dx=to.x-from.x, north=from.z-to.z;
 if(Math.hypot(dx,north)<2)return "HERE";
 const sectors=["N","NE","E","SE","S","SW","W","NW"];
 return sectors[(Math.round(Math.atan2(dx,north)/(Math.PI/4))+8)%8];
}
export function destinationGuide(position:Point2,room:FacilityId|null,target:FacilityId){
 const facility=BASE_FACILITIES.find(f=>f.id===target)!;
 if(room===target)return {title:"USE THE CONTROL CONSOLE",description:"Walk to the glowing equipment screen and tap INTERACT.",distance:0,direction:"HERE"};
 if(room)return {title:"EXIT TO THE SURFACE",description:"Use the room airlock and then follow the highlighted building.",distance:null,direction:"EXIT"};
 const door=doorPosition(facility);
 const meters=Math.round(distance(position,door));
 if(meters<=2.5)return {title:"OPEN "+facility.title.toUpperCase()+" AIRLOCK",description:"Press INTERACT at the front door; walk inside and use the console.",distance:meters,direction:"HERE"};
 const bearing=compassDirection(position,door);
 return {title:"GO TO "+facility.title.toUpperCase(),description:"Head "+bearing+" for about "+meters+" m. Follow the glowing building marker.",distance:meters,direction:bearing};
}
