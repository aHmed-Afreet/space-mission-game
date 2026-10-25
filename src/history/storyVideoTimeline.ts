import type {HistoryMission} from "./missionHistory";
/** Pure historical video data. Kept separate from the React video player for testing. */
export type StoryVideoChapter={label:string;title:string;description:string;scene:"launch"|"orbit"|"science"|"warning"|"return"|"legacy"};
export const STORY_VIDEO_CHAPTER_SECONDS=6;
export function storyVideoChapters(m:HistoryMission):StoryVideoChapter[]{
  return [
    {label:"01 / INTRODUCTION",title:m.title,description:`${m.year} · ${m.agency} · ${m.destination}`,scene:"launch"},
    {label:"02 / THE BACKGROUND",title:"Why the mission began",description:m.background,scene:"orbit"},
    {label:"03 / THE JOURNEY",title:"What the mission did",description:m.mission,scene:"science"},
    {label:"04 / THE CHALLENGE",title:"The hard part",description:m.challenge,scene:"warning"},
    {label:"05 / THE OUTCOME",title:"What really happened",description:m.outcome,scene:"return"},
    {label:"06 / ITS LEGACY",title:"What we learned",description:m.skill,scene:"legacy"},
  ];
}
export function storyVideoWorld(m:HistoryMission):"moon"|"mars"|"earth"|"outer"{
  const dest=m.destination.toLowerCase();
  if(/moon|lunar/.test(dest))return "moon";
  if(/mars/.test(dest))return "mars";
  if(/jupiter|saturn|pluto|asteroid|comet|sun|venus|mercury|outer|deep/.test(dest))return "outer";
  return "earth";
}
