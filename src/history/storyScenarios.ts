import type { HistoryMission } from "./missionHistory";
import {missionProfile,type HistoricProfile} from "./missionProfiles";
export type CraftFamily="sphere"|"capsule"|"gemini"|"apollo"|"lunar"|"shuttle"|"station"|"telescope"|"probe"|"lander"|"rover"|"helicopter"|"observatory";
export type Station="brief"|"systems"|"operations"|"science";
export type StoryTask={id:string;station:Station;heading:string;action:string;procedure:string;complete:string};
export type StoryScenario={missionId:string;title:string;craft:string;family:CraftFamily;destination:string;setting:"moon"|"mars"|"orbit"|"deep";role:"astronaut"|"mission operator";tasks:StoryTask[];historicalNote:string;profile:HistoricProfile;};
const build=(id:string,station:Station,heading:string,action:string,procedure:string,complete:string):StoryTask=>({id,station,heading,action,procedure,complete});
export function historicalCraft(m:HistoryMission):{craft:string;family:CraftFamily}{
 const t=m.title;
 if(/Sputnik/.test(t))return {craft:missionProfile(t).vehicle,family:"sphere"};
 if(t==="Luna 2")return {craft:missionProfile(t).vehicle,family:"sphere"};
 if(/Explorer 1/.test(t))return {craft:"Explorer 1 cylindrical radiation satellite",family:"probe"};
 if(/Vostok|Voskhod/.test(t))return {craft:t+" spherical descent capsule",family:"sphere"};
 if(/Freedom 7|Friendship 7/.test(t))return {craft:"Mercury single-crew capsule",family:"capsule"};
 if(/Gemini/.test(t))return {craft:"Gemini two-crew spacecraft",family:"gemini"};
 if(/Apollo 11|Apollo 12|Apollo 13|Apollo 15|Apollo 17/.test(t))return {craft:missionProfile(t).vehicle,family:"lunar"};
 if(/Apollo /.test(t))return {craft:"Apollo Command and Service Module",family:"apollo"};
 if(/STS-|Hubble servicing|Hubble deployment/.test(t))return {craft:"Space Shuttle Orbiter and payload",family:"shuttle"};
 if(/Salyut|Skylab|Mir|ISS |Apollo–Soyuz/.test(t))return {craft:"Modular orbital station",family:"station"};
 if(/James Webb/.test(t))return {craft:"James Webb segmented infrared telescope",family:"observatory"};
 if(/Hubble|Kepler/.test(t))return {craft:t+" orbital observatory",family:"telescope"};
 if(t==="Ingenuity")return {craft:missionProfile(t).vehicle,family:"helicopter"};
 if(/Mars Pathfinder|Curiosity|Perseverance/.test(t))return {craft:missionProfile(t).vehicle,family:"rover"};
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
 if(t==="Apollo 8")return [
 build("translunar","brief","Review first crewed lunar-orbit flight","Approve translunar itinerary","Borman, Lovell and Anders traveled to lunar orbit without a lander.","Lunar-orbit itinerary recorded."),
 build("systems","systems","Inspect Apollo command-service systems","Check propulsion and electrical buses","Verify service-module power and life support for the lunar transit.","Command module status recorded."),
 build("orbit","operations","Perform lunar orbit insertion","Review propulsion maneuver","A service propulsion system maneuver placed Apollo 8 into orbit around the Moon.","Lunar orbit procedure completed."),
 build("earthrise","science","Document Earthrise observations","Photograph Earth over the lunar horizon","Anders photographed Earth rising above the lunar horizon during Apollo 8.","Earthrise observations archived."),
 build("home","operations","Prepare trans-Earth injection","Confirm return maneuver","The crew performed a maneuver to leave lunar orbit for Earth.","Return maneuver reviewed.")];
 if(t==="Apollo 15"||t==="Apollo 17")return [
 build("plan","brief","Plan lunar field expedition","Review traverse route","Review geology priorities and EVA consumables for the landing site.","Lunar field itinerary logged."),
 build("descent","systems","Check lunar module systems","Check descent reserves","Read simulated guidance, oxygen and descent fuel instruments.","Descent reserves verified."),
 build("rover","operations","Prepare lunar rover traverse","Inspect rover readiness","Both Apollo 15 and Apollo 17 used a lunar rover for extended surface exploration.","Rover operations checked."),
 build("samples","science","Collect geology measurements","Log labelled samples","Record photographs, rock context and sampling areas.","Geological sample record complete."),
 build("experiments","operations","Deploy surface instruments","Verify science experiment setup","Review the mission's deployed scientific instruments and crew-work procedures.","Experiment deployment recorded.")];
 if(t==="Apollo 12")return [
 build("target","brief","Review precision landing target","Identify Surveyor 3","Apollo 12 intended to land near the Surveyor 3 robotic spacecraft.","Landing target documented."),
 build("guidance","systems","Check lunar landing navigation","Verify guidance status","Study the lunar module's approach and electrical systems.","Navigation readiness confirmed."),
 build("descent","operations","Complete precision lunar descent","Confirm descent sequence","Apollo 12 landed within walking distance of Surveyor 3.","Precision descent procedure complete."),
 build("surveyor","science","Inspect Surveyor 3 hardware","Document collected parts","Apollo 12 astronauts examined Surveyor 3 and retrieved hardware.","Surveyor inspection logged.")];
 if(t==="Apollo 9"||t==="Apollo 10")return [
 build("flight","brief","Review lunar module rehearsal","Confirm module test profile","Study spacecraft separation, descent rehearsal and crew roles.","Module test briefing accepted."),
 build("life","systems","Verify command and lunar module systems","Check propulsion and cabin","Review electrical systems and rendezvous readiness.","Spacecraft systems verified."),
 build("separate","operations","Separate spacecraft modules","Arm separation sequence","The mission rehearsed independent flight of the lunar module.","Module separation logged."),
 build("rendezvous","operations","Prepare spacecraft rendezvous","Complete docking approach","Review how crews reunited their spacecraft after module testing.","Rendezvous sequence recorded."),
 build("record","science","Document test results","Log flight test findings","Return the flight-test evidence to engineers and mission control.","Engineering results secured.")];
 if(t==="Gemini 8"||t==="Gemini 6A and 7")return [
 build("plan","brief","Prepare orbital rendezvous","Approve rendezvous plan","Compare orbital timing and relative motion for the two vehicles.","Rendezvous plan verified."),
 build("control","systems","Check Gemini attitude control","Verify thruster indications","Review the thruster system and spacecraft stabilization.","Attitude control status logged."),
 build("dock","operations","Perform close orbital approach","Arm docking or station-keeping","Gemini 8 docked with an Agena; Gemini 6A and 7 practiced close rendezvous.","Relative approach completed."),
 build("anomaly","systems","Check flight-control indications","Perform anomaly review","Gemini 8 ended early after an uncontrolled rotation caused by a stuck thruster; review the crew's response.","Flight control anomaly understood."),
 build("records","science","Record rendezvous observations","Transmit flight records","Document crew findings on orbital proximity operations.","Orbital flight record filed.")];
 if(t==="Skylab 2")return [
 build("damage","brief","Review Skylab launch damage","Document thermal and power problems","Skylab lost a micrometeoroid shield and sustained solar array damage during launch.","Damage assessment recorded."),
 build("life","systems","Assess overheated orbital workshop","Check temperature and electrical power","Crew had to restore acceptable temperatures and usable power.","Workshop status measured."),
 build("repair","operations","Prepare protective sunshade deployment","Arm repair checklist","The Skylab 2 astronauts deployed a sunshade to reduce heating.","Temperature-control repair reviewed."),
 build("solar","operations","Recover solar array capability","Inspect array operations","Spacewalk maintenance was needed to restore additional power.","Electrical recovery simulated."),
 build("science","science","Begin orbital laboratory experiments","Record instrument readings","After repairs the station supported meaningful science activities.","Station research logged.")];
 if(t==="Artemis I")return [
 build("uncrewed","brief","Confirm uncrewed Orion flight","Review mission itinerary","Artemis I tested the Space Launch System rocket and Orion without astronauts.","Uncrewed flight brief confirmed."),
 build("systems","systems","Check Orion service-module power","Verify spacecraft status","Monitor solar-array performance, guidance and thermal systems.","Orion system check recorded."),
 build("moon","operations","Prepare lunar flyby trajectory","Arm lunar coast sequence","Orion traveled beyond the Moon and entered distant retrograde orbit.","Lunar trajectory exercise completed."),
 build("reentry","science","Review capsule reentry and splashdown","Record recovery data","Orion returned to Earth and tested its heat shield and recovery procedures.","Reentry data recorded.")];
 if(t==="Chandrayaan-3"||t==="SLIM"||t==="Blue Ghost Mission 1")return [
 build("site","brief","Review lunar landing region","Confirm planned landing location","Study the vehicle's actual lunar landing objectives.","Lunar destination brief logged."),
 build("power","systems","Check lander power and thermal state","Verify landing energy","Prepare the lander's propulsion, sensors and electrical system.","Lander readiness confirmed."),
 build("descent","operations","Execute precision lunar descent","Arm landing sequence","A robotic lunar lander must reduce its speed before contact with the surface.","Lunar landing simulation completed."),
 build("science","science","Record lunar surface measurements","Capture surface science","Review instruments and observations after landing.","Surface science stored.")];
 if(t==="Ingenuity")return [
 build("flight","brief","Review Mars helicopter technology test","Confirm experimental flight window","Ingenuity demonstrated powered flight in the thin Martian atmosphere.","Flight objective recorded."),
 build("battery","systems","Check rotor and battery readiness","Verify energy and flight computer","Verify the helicopter's state before a short robotic test flight.","Helicopter engineering ready."),
 build("rotor","operations","Perform powered Mars flight","Arm rotor lift test","Thin Martian air required a fast rotor speed and autonomous flight control.","Powered flight exercise logged."),
 build("image","science","Review navigation camera observations","Archive flight images","Ingenuity returned engineering and aerial images.","Mars flight evidence filed.")];
 if(t==="James Webb Telescope")return [
 build("l2","brief","Review Webb deployment sequence","Confirm commissioning route","Webb was launched folded for a mission near Sun-Earth L2.","L2 mission flight plan logged."),
 build("shield","systems","Monitor deployed sunshield","Check telescope temperatures","The multi-layer sunshield provides the cold conditions needed for infrared observations.","Thermal state checked."),
 build("mirror","operations","Align segmented primary mirror","Arm optics alignment","Webb's 18 primary-mirror segments require precise optical alignment.","Optical commissioning logged."),
 build("calibration","science","Collect calibration observations","Verify infrared instruments","Review test images and instrument readiness.","Infrared observation verified.")];
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
/** Preserve actual mission locations: Apollo 8/10/13 never landed on the Moon.
 * Earth-based first person mission control represents uncrewed missions. */
export function historicalSetting(m:HistoryMission):StoryScenario["setting"]{
 const surfaceMoon=/^(Apollo 11|Apollo 12|Apollo 15|Apollo 17|Luna 9|Luna 16|Chandrayaan-3|SLIM|Blue Ghost Mission 1)$/.test(m.title);
 if(surfaceMoon)return "moon";
 if(/Mars Pathfinder|Viking 1|Curiosity|Perseverance|Ingenuity/.test(m.title))return "mars";
 if(/Earth orbit|Suborbital/i.test(m.destination))return "orbit";
 return "deep";
}
export function createStoryScenario(m:HistoryMission):StoryScenario{
 const profile=missionProfile(m.title);
 const family=historicalCraft(m).family;
 const setting=historicalSetting(m);
 const role:StoryScenario["role"]=m.category==="Crewed"||m.category==="Space station"?"astronaut":"mission operator";
 const bespoke=tailored(m);
 const tasks=(bespoke||[
  build("brief","brief","Review "+m.title+" flight plan","Confirm real mission context",
    m.background+" This experience represents the historical mission without changing its actual outcome.","Historical briefing completed."),
  build("systems","systems","Inspect "+profile.hardware,"Verify vehicle configuration",
    "The actual mission used: "+profile.hardware+". "+m.challenge+" Confirm this system in the reconstruction.","Mission hardware checkout completed."),
  build("operations","operations",profile.operation,"Execute historical procedure",
    "Historically inspired operations: "+profile.operation+". "+m.mission,"Mission operation completed."),
  build("science","science",profile.observation,"Record actual mission findings",
    profile.observation+". Historical result: "+m.outcome,"Scientific and engineering record filed.")
 ]).map(task=>{
  if(!bespoke)return task;
  if(task.station==="systems")return {...task,procedure:task.procedure+" Historical equipment: "+profile.hardware+"."};
  if(task.station==="operations")return {...task,procedure:task.procedure+" Specific mission operation: "+profile.operation+"."};
  if(task.station==="science")return {...task,procedure:task.procedure+" Historical record: "+profile.observation+"."};
  return task;
 });
 return {
  missionId:m.id,title:m.title,craft:profile.vehicle,family,destination:m.destination,setting,role,tasks,profile,
  historicalNote:m.title+" ("+m.year+") really flew. Equipment and tasks follow recorded mission goals. This is a simplified 3D educational reconstruction, not an exact reconstruction of the spacecraft interior or historical procedures."
 };
}
