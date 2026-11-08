import { useState } from "react";
import type { HistoryMission } from "./missionHistory";
import StoryBriefingVideo from "./StoryBriefingVideo";

/** Verified agency-published embeds; an in-app animation is always available. */
const inlineFilms: Record<string, {youtubeId:string;title:string;publisher:string;source:string}> = {
  "Apollo 11": {youtubeId:"nOcDftgR5UQ",title:"Apollo 11: Landing on the Moon",publisher:"NASA",source:"https://www.youtube.com/watch?v=nOcDftgR5UQ"},
  "Curiosity": {youtubeId:"N9hXqzkH7YA",title:"Curiosity Has Landed",publisher:"NASA JPL",source:"https://www.youtube.com/watch?v=N9hXqzkH7YA"},
};
export function inlineNasaVideoFor(title:string){return inlineFilms[title];}
export default function InlineNasaVideo({mission,onWatched}:{mission:HistoryMission;onWatched:()=>void}){
  const [showPlayer,setShowPlayer]=useState(false);
  const [animated,setAnimated]=useState(false);
  const clip=inlineNasaVideoFor(mission.title);
  if(!clip||animated) return <section className="history-video-inline">
    {animated&&<p className="history-training-note">Using the in-game animated briefing because video streaming may be unavailable.</p>}
    <StoryBriefingVideo mission={mission} onWatched={onWatched}/>
  </section>;
  return <section className="history-video-inline" aria-label={"Historical NASA video: "+mission.title}>
    <div className="history-film-banner"><strong>OFFICIAL AGENCY FOOTAGE · INSIDE THE GAME</strong><span>{clip.publisher}</span></div>
    <h2>{clip.title}</h2>
    <div className="history-inline-player">
      {showPlayer
        ? <iframe title={clip.title} src={"https://www.youtube-nocookie.com/embed/"+clip.youtubeId+"?rel=0&playsinline=1"}
          loading="lazy" allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture; web-share"
          referrerPolicy="strict-origin-when-cross-origin" allowFullScreen/>
        : <button type="button" className="history-inline-play" onClick={()=>setShowPlayer(true)}>
            <span aria-hidden="true">▶</span> PLAY NASA FOOTAGE HERE
          </button>}
    </div>
    <p className="history-training-note">Agency footage is embedded from YouTube. It may not show every gameplay action; streaming requires internet and can be blocked by the publisher or browser.</p>
    <div className="history-inline-actions">
      <button type="button" className="history-secondary" onClick={()=>setAnimated(true)}>Video blocked? Use the in-game animated briefing</button>
      <button type="button" className="history-film-continue" disabled={!showPlayer} onClick={onWatched}>CONTINUE TO INTERACTIVE MISSION →</button>
    </div>
    <p className="history-training-note">Original source: <a href={clip.source} target="_blank" rel="noopener noreferrer">{clip.publisher} video archive ↗</a></p>
  </section>;
}
