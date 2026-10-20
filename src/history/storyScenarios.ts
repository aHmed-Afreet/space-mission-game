import type { HistoryMission } from "./missionHistory";
export type CraftFamily="sphere"|"capsule"|"gemini"|"apollo"|"lunar"|"shuttle"|"station"|"telescope"|"probe"|"lander"|"rover"|"observatory";
export type Station="brief"|"systems"|"operations"|"science";
export type StoryTask={id:string;station:Station;heading:string;action:string;procedure:string;complete:string};
export type StoryScenario={missionId:string;craft:string;family:CraftFamily;destination:string;setting:"moon"|"mars"|"orbit"|"deep";role:"astronaut"|"mission operator";tasks:StoryTask[];historicalNote:string};
const build=(id:string,station:Station,heading:string,action:string,procedure:string,complete:string):StoryTask=>({id,station,heading,action,procedure,complete});
export function historicalCraft(m:HistoryMission):{craft:string;family:CraftFamily}{
 const t=m.title;
 if(/Sputnik/.test(t))return {craft:t+" spherical radio satellite",family:"sphere"};
 if(/Explorer 1/.test(t))return {craft:"Explorer 1 cylindrical radiation satellite",family:"probe"};
 if(/Vostok|Voskhod/.test(t))return {craft:t+" spherical descent capsule",family:"sphere"};
 if(/Freedom 7|Friendship 7/.test(t))return {craft:"Mercury single-crew capsule",family:"capsule"};
 if(/Gemini/.test(t))return {craft:"Gemini two-crew spacecraft",family:"gemini"};
 if(/Apollo 11|Apollo 12|Apollo 15|Apollo 17/.test(t))return {craft:"Apollo Lunar Module and Command/Service Module",family:"lunar"};
 if(/Apollo /.test(t))return {craft:"Apollo Command and Service Module",family:"apollo"};
 if(/STS-|Hubble servicing|Hubble deployment/.test(t))return {craft:"Space Shuttle Orbiter and payload",family:"shuttle"};
 if(/Salyut|Skylab|Mir|ISS |Apollo–Soyuz/.test(t))return {craft:"Modular orbital station",family:"station"};
 if(/James Webb/.test(t))return {craft:"James Webb segmented infrared telescope",family:"observatory"};
 if(/Hubble|Kepler/.test(t))return {craft:t+" orbital observatory",family:"telescope"};
 if(/Mars Pathfinder|Curiosity|Perseverance|Ingenuity/.test(t))return {craft:t+" Mars exploration vehicle",family:"rover"};
 if(/Luna 9|Luna 16|Viking 1|Chandrayaan|SLIM|Blue Ghost/.test(t))return {craft:t+" robotic lunar or planetary lander",family:"lander"};
 if(/Voyager|Pioneer|Mariner|Juno|Galileo|Cassini|Rosetta|Deep Impact|New Horizons|JUICE|Europa Clipper|OSIRIS/.test(t))return {craft:t+" uncrewed interplanetary probe",family:"probe"};
 if(/Artemis I/.test(t))return {craft:"Uncrewed Orion capsule and service module",family:"apollo"};
 if(m.category==="Space station")return {craft:"Orbital laboratory",family:"station"};
 if(m.category==="Telescope")return {craft:"Space science observatory",family:"telescope"};
 if(m.category==="Crewed")return {craft:"Crewed space capsule",family:"capsule"};
 return {craft:"Uncrewed science probe",family:"probe"};
}
function tailored(m:HistoryMission):StoryTask[]|undefined{
 const t=m.title;
 if(t==="Apollo 11")return [
 build("landing","brief","Prepare Eagle's lunar landing","Review descent checklist","Confirm landing-site observations and descent flight plan.","Lunar landing briefing accepted."),
 build("guidance","systems","Check lunar module guidance and fuel","Verify descent controls","Read the simplified guidance and propellant indications.","Descent configuration verified."),
 build("eva","operations","Prepare first lunar surface EVA","Check suit and access ladder","Review Apollo 11 surface access and spacesuit readiness.","EVA preparation complete."),
 build("samples","science","Document Moon rocks and photographs","Record sample context","Enter the location and scientific context of sample collections.","Lunar geology records secured.")];
 if(t==="Apollo 13")return [
 build("report","brief","Identify the Apollo 13 emergency","Read mission report","Review the in-flight malfunction and the decision to abort lunar landing.","Emergency briefing logged."),
 build("conserve","systems","Conserve onboard power","Verify limited-resource operation","Review electrical, water and oxygen conservation using the lunar module as a lifeboat.","Consumables plan confirmed."),
 build("course","operations","Prepare an Earth-return trajectory","Confirm return corridor","Check the mission-control return route via the Moon.","Return trajectory verified."),
 build("reentry","science","Review safe crew recovery","Check reentry preparations","Confirm that the command module is prepared for recovery.","Crew recovery briefing completed.")];
 if(/Voyager 1|Voyager 2/.test(t))return [
 build("route","brief","Review outer-planet flight plan","Check flyby sequence","Study spacecraft navigation and gravity-assist geometry.","Encounter schedule verified."),
 build("rtg","systems","Check radioisotope power","Inspect electrical reserve","Check long-duration probe power without using solar arrays.","Power and thermal readings logged."),
 build("imaging","operations","Point the science instruments","Configure flyby observations","Plan instrument observations during the high-speed planetary encounter.","Flyby imaging sequence stored."),
 build("radio","science","Downlink distant planet observations","Verify high-gain antenna","Send encounter observations through the communications system.","Deep-space science downlinked.")];
 if(t==="Vostok 1")return [
 build("flight","brief","Review Gagarin's single orbit","Confirm crewed-flight plan","Check the first human orbital mission's flight objectives.","Vostok flight plan accepted."),
 build("cabin","systems","Monitor crew cabin conditions","Check life support","Review the capsule environment needed for Gagarin's flight.","Cabin checks completed."),
 build("track","operations","Track Vostok in Earth orbit","Record orbit data","Log the capsule's orbital progress using mission-control indications.","First human orbit tracked."),
 build("recovery","science","Study separate parachute landing","Review landing sequence","Gagarin ejected from the descent capsule and landed by parachute.","Vostok recovery history verified.")];
 if(/STS-125/.test(t))return [
 build("rendezvous","brief","Review Hubble rendezvous","Verify Shuttle operations","Confirm the planned encounter with the telescope.","Rendezvous checks complete."),
 build("suits","systems","Prepare servicing spacewalk equipment","Review EVA gear","Check the tools and support systems used during Hubble servicing.","EVA readiness verified."),
 build("repair","operations","Service Hubble instruments","Complete repair sequence","Work through an instrument-repair training checklist.","Simulated instrument repair finished."),
 build("test","science","Validate Hubble upgrades","Run instrument test","Check science instrument status before returning to Earth.","Hubble functional tests logged.")];
 if(/Curiosity|Perseverance|Mars Pathfinder/.test(t))return [
 build("approach","brief","Review Mars landing and rover deployment","Confirm surface site","Study the planned landing or operations location.","Mars briefing completed."),
 build("engineering","systems","Check rover energy and thermal systems","Verify rover health","Monitor robotic exploration system health before surface travel.","Rover ready."),
 build("traverse","operations","Drive toward a safe geology target","Plan rover traverse","Check terrain and select a safe investigation location.","Rover traverse completed."),
 build("geology","science","Analyze and document Mars rocks","Record sample observations","Study the actual mission's search for geological evidence.","Martian science logged.")];
 if(/ISS |Skylab 2|Mir station|Salyut/.test(t))return [
 build("docking","brief","Review station arrival and work plan","Confirm docking procedures","Study how this station was assembled or operated.","Station procedures confirmed."),
 build("support","systems","Check station environmental systems","Verify life support","Review atmospheric controls and electrical reserves.","Crew-support checks completed."),
 build("maintenance","operations","Service orbital laboratory equipment","Inspect station systems","Perform a simulated hardware inspection.","Orbital workstation verified."),
 build("science","science","Complete orbital research records","Transmit laboratory science","Compile experiment results for the ground research team.","Station science logged.")];
 if(/James Webb/.test(t))return [
 build("orbit","brief","Review telescope journey to L2","Confirm mission route","Check the deep-space commissioning sequence.","Webb flight review completed."),
 build("shield","systems","Inspect sunshield and cooling","Check thermal readiness","Monitor the large deployed sunshield and infrared operating conditions.","Thermal commissioning complete."),
 build("mirror","operations","Align segmented gold mirrors","Calibrate optical pointing","Verify segment alignment in a simplified training procedure.","Mirror alignment completed."),
 build("image","science","Prepare infrared observations","Run instrument calibration","Review the scientific readiness of the observatory.","Infrared calibration complete.")];
 return undefined;
}
export function createStoryScenario(m:HistoryMission):StoryScenario{
 const {craft,family}=historicalCraft(m);
 const setting:StoryScenario["setting"]=/Mars/i.test(m.destination)?"mars":/Moon/i.test(m.destination)?"moon":/Earth orbit|Suborbital/i.test(m.destination)?"orbit":"deep";
 const role:StoryScenario["role"]=m.category==="Crewed"||m.category==="Space station"?"astronaut":"mission operator";
 const tasks=tailored(m)||[
 build("brief","brief","Review "+m.title+" mission flight plan","Confirm mission briefing",m.background,"Historical mission briefing completed."),
 build("systems","systems","Check "+craft+" readiness","Verify engineering status",m.challenge+" Check the corresponding craft systems before the operation.","Spacecraft systems reviewed."),
 build("operations","operations",m.mission,"Execute mission procedure","Training exercise: "+m.mission,"Mission operation completed."),
 build("science","science","Record "+m.skill.toLowerCase(),"Log and transmit observations","Document the mission objective and relevant observations: "+m.mission,"Science data logged.")];
 return {missionId:m.id,craft,family,destination:m.destination,setting,role,tasks,
 historicalNote:m.title+" ("+m.year+") was a real space mission. This is a simplified first-person training scene with mission-inspired models and procedures, not an exact reconstruction."};
}
