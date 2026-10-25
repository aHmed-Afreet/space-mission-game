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
};
export function officialFilmFor(title:string):OfficialFilm|undefined {
 return officialFilms[title];
}
