/** Verified, official institution-hosted footage, not copied or reuploaded.
 * Only missions with a checked, matching agency film receive a watch-first gate.
 * Archive films may include commentary/montage, not continuous cockpit recordings.
 */
export type OfficialFilm={
  title:string;url:string;publisher:"NASA";kind:"original EVA broadcast"|"historical documentary"|"NASA archive footage";
  duration:string;record:string;scope:string;order:string[];
};
export const officialFilms:Record<string,OfficialFilm>={
 "Apollo 11":{
   title:"Restored Apollo 11 Moonwalk",url:"https://plus.nasa.gov/video/restored-apollo-11-moonwalk/",
   publisher:"NASA",kind:"original EVA broadcast",duration:"3 h 2 min",
   record:"https://www.nasa.gov/wp-content/uploads/static/history/SP-4029/Apollo_11i_Timeline.htm",
   scope:"Neil Armstrong's documented lunar surface EVA actions. The game compresses the recording and reconstructs only the listed actions, not every movement.",
   order:["Exit Eagle's forward hatch and descend to the lunar surface.",
     "Take the first steps and examine lunar soil.",
     "Photograph the landing area.",
     "Collect the contingency soil sample.",
     "Observe Buzz Aldrin joining the surface crew.",
     "Take part in the documented flag deployment.",
     "Return safely to the lunar module."],
 },
 "Apollo 13":{
   title:"Apollo 13: Houston, We've Got a Problem",url:"https://plus.nasa.gov/video/apollo-13-houston-we-ve-got-a-problem/",
   publisher:"NASA",kind:"historical documentary",duration:"28 min",
   record:"https://www.nasa.gov/mission/apollo-13/",
   scope:"A historical film containing crew footage, interviews and mission-control scenes; the playable scene uses documented events and simplified controls.",
   order:["Review the crew's intended lunar flight.","Identify the in-flight spacecraft emergency.",
    "Conserve available electrical and life-support resources.","Prepare an Earth-return trajectory.",
    "Review the crew's safe recovery."],
 },
 "Apollo 15":{
   title:"Apollo 15: In the Mountains of the Moon",url:"https://plus.nasa.gov/video/apollo-15-in-the-mountains-of-the-moon-2/",
   publisher:"NASA",kind:"historical documentary",duration:"27 min",
   record:"https://www.nasa.gov/mission/apollo-15/",
   scope:"Mission highlights rather than uncut EVA video. The playable scene follows the documentary's major documented operations.",
   order:["Plan the Hadley-Apennine surface expedition.","Inspect the lunar module and field supplies.",
     "Prepare the lunar rover traverse.","Document geology and collect rock samples.",
     "Review deployed surface science experiments."],
 },
 "Apollo 17":{
   title:"Apollo 17: On the Shoulders of Giants",url:"https://plus.nasa.gov/video/apollo-17-on-the-shoulders-of-giants-2/",
   publisher:"NASA",kind:"historical documentary",duration:"28 min",
   record:"https://www.nasa.gov/mission/apollo-17/",
   scope:"Official mission documentary with highlights and retrospective material, not continuous first-person EVA footage.",
   order:["Plan the Taurus-Littrow expedition.","Verify crew and lunar-module systems.",
     "Prepare the rover exploration.","Record geological samples and findings.",
     "Review the surface experiments."],
 },
 "STS-1":{
   title:"STS-1 Launch and Landing Archive Footage",url:"https://images.nasa.gov/details-KSC-20210325-MH-JRS01_0001-STS-1_File_Footage_for_40th_Anniversary",
   publisher:"NASA",kind:"NASA archive footage",duration:"NASA archive selection",
   record:"https://www.nasa.gov/mission/sts-1/",
   scope:"NASA archival footage of the first Shuttle launch and landing, with gaps filled only by clearly marked simplified training procedures.",
   order:["Prepare the first Shuttle flight-test assignment.","Review Columbia's pre-launch systems.",
     "Follow Columbia's launch and ascent.","Monitor orbital system checks.",
     "Review the Shuttle's Earth landing."],
 },

 // The following official NASA+ films were matched to their subjects in the
 // NASA streaming catalogue. They are documentaries (not uncut crew footage).
 "Explorer 1":{
   title:"JPL and the Space Age: Explorer One",url:"https://plus.nasa.gov/video/jpl-and-the-space-age-explorer-1/",
   publisher:"NASA",kind:"historical documentary",duration:"53 min",
   record:"https://www.nasa.gov/history/explorer-1/",
   scope:"JPL/NASA documentary about Explorer 1 and early US satellite development, including archival footage and interviews.",
   order:["Review the early satellite program.","Prepare instruments to measure space radiation.","Launch Explorer 1 into orbit.","Track satellite telemetry and unusual radiation readings.","Review the scientific legacy of Explorer 1."],
 },
 "Voyager 1":{
   title:"JPL and the Space Age: The Footsteps of Voyager",url:"https://plus.nasa.gov/video/jpl-and-the-space-age-the-footsteps-of-voyager/",
   publisher:"NASA",kind:"historical documentary",duration:"56 min",
   record:"https://www.nasa.gov/mission/voyager/",
   scope:"NASA history documentary covering the wider Voyager program; not a continuous Voyager 1 recording.",
   order:["Review the Voyager planetary tour.","Check long-lived spacecraft systems.","Perform the gravity-assist flyby itinerary.","Record observations of outer planets.","Downlink deep-space discoveries."],
 },
 "Voyager 2":{
   title:"JPL and the Space Age: The Footsteps of Voyager",url:"https://plus.nasa.gov/video/jpl-and-the-space-age-the-footsteps-of-voyager/",
   publisher:"NASA",kind:"historical documentary",duration:"56 min",
   record:"https://www.nasa.gov/mission/voyager/",
   scope:"Official documentary about both Voyager spacecraft, not dedicated footage of every Voyager 2 maneuver.",
   order:["Review the outer-planet mission plan.","Verify radioisotope power.","Conduct the planetary flybys.","Collect images and measurements.","Send observations back toward Earth."],
 },
 "Mars Pathfinder":{
   title:"JPL and the Space Age: The Pathfinders",url:"https://plus.nasa.gov/video/jpl-and-the-space-age-the-pathfinders/",
   publisher:"NASA",kind:"historical documentary",duration:"60 min",
   record:"https://www.nasa.gov/mission/mars-pathfinder/",
   scope:"Historical documentary about Mars Pathfinder's landing and Sojourner's surface exploration, including archival material.",
   order:["Plan Pathfinder's Mars landing.","Monitor entry and descent.","Land the robotic spacecraft.","Deploy Sojourner and test surface travel.","Return Mars geology images and data."],
 },
 "Viking 1":{
   title:"JPL and the Space Age: The Changing Face of Mars",url:"https://plus.nasa.gov/video/jpl-and-the-space-age-the-changing-face-of-mars/",
   publisher:"NASA",kind:"historical documentary",duration:"79 min",
   record:"https://www.nasa.gov/mission/viking/",
   scope:"NASA documentary covering Mars probes through the Viking era; Viking 1 is one segment of the wider history.",
   order:["Plan the Mars orbital and landing campaign.","Study spacecraft readiness.","Prepare descent observations.","Operate the Viking surface laboratory.","Transmit Mars science results."],
 },
 "Galileo Jupiter arrival":{
   title:"JPL and the Space Age: Saving Galileo",url:"https://plus.nasa.gov/video/jpl-and-the-space-age-saving-galileo/",
   publisher:"NASA",kind:"historical documentary",duration:"60 min",
   record:"https://www.nasa.gov/mission/galileo/",
   scope:"NASA documentary about Galileo's technical setbacks and successes; wider than Jupiter arrival alone.",
   order:["Prepare for the Jupiter exploration campaign.","Monitor spacecraft communications.","Plan Jupiter arrival maneuvers.","Study the planet and moons.","Return scientific data despite challenges."],
 },
 "Cassini–Huygens":{
   title:"JPL and the Space Age: Triumph at Saturn (Part I)",url:"https://plus.nasa.gov/video/jpl-and-the-space-age-triumph-at-saturn-part-i/",
   publisher:"NASA",kind:"historical documentary",duration:"57 min",
   record:"https://www.nasa.gov/mission/cassini/",
   scope:"Documentary on Cassini mission planning and science; also covers broader Saturn-system exploration.",
   order:["Prepare Cassini's cruise to Saturn.","Track long-distance spacecraft systems.","Enter Saturn's orbital environment.","Conduct Titan observations and Huygens studies.","Review Saturn-system discoveries."],
 },
 "OSIRIS-REx sampling":{
   title:"NASA Explorers: Challenges of Bennu",url:"https://plus.nasa.gov/video/nasa-explorers-challenges-of-bennu/",
   publisher:"NASA",kind:"historical documentary",duration:"23 min",
   record:"https://www.nasa.gov/mission/osiris-rex/",
   scope:"Official NASA Explorers episode focused on unexpected conditions at asteroid Bennu during OSIRIS-REx preparations.",
   order:["Plan the Bennu sampling campaign.","Evaluate Bennu's surface.","Prepare sampling operations.","Collect the sample through the TAG maneuver.","Review and return the sample data."],
 },
 "Artemis I":{
   title:"Artemis I: The Documentary",url:"https://plus.nasa.gov/video/artemis-i-the-documentary/",
   publisher:"NASA",kind:"historical documentary",duration:"34 min",
   record:"https://www.nasa.gov/mission/artemis-i/",
   scope:"Documentary about preparing and launching the uncrewed SLS/Orion lunar flight; not an astronaut POV.",
   order:["Prepare the uncrewed SLS and Orion.","Launch from Earth.","Navigate beyond the Moon.","Review distant retrograde orbit operations.","Return and recover Orion."],
 },
 "James Webb Telescope":{
   title:"Cosmic Dawn: The Untold Story of the James Webb Space Telescope",url:"https://plus.nasa.gov/video/cosmic-dawn-the-untold-story-of-the-james-webb-space-telescope/",
   publisher:"NASA",kind:"historical documentary",duration:"NASA feature documentary",
   record:"https://www.nasa.gov/mission/webb/",
   scope:"NASA documentary about the space telescope's decades of development, deployment and early science.",
   order:["Design a large infrared observatory.","Prepare and launch Webb.","Deploy the sunshield and mirrors.","Align and calibrate instruments.","Begin infrared astronomy."],
 },
};
export function officialFilmFor(title:string):OfficialFilm|undefined {
 return officialFilms[title];
}
