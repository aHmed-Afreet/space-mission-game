import {useEffect,useState} from "react";
import type {HistoryMission} from "./missionHistory";
import "./storyBriefingVideo.css";

import { storyVideoChapters,storyVideoWorld,STORY_VIDEO_CHAPTER_SECONDS } from "./storyVideoTimeline";
export default function StoryBriefingVideo({mission,onWatched}:{
  mission:HistoryMission;onWatched:()=>void;
}){
  const chapters=storyVideoChapters(mission);
  const duration=chapters.length*STORY_VIDEO_CHAPTER_SECONDS;
  const [seconds,setSeconds]=useState(0);
  const [playing,setPlaying]=useState(false);
  const [completed,setCompleted]=useState(false);
  const index=Math.min(chapters.length-1,Math.floor(seconds/STORY_VIDEO_CHAPTER_SECONDS));
  const chapter=chapters[index];
  const ready=completed||seconds>=duration;
  useEffect(()=>{
    if(!playing)return;
    const timer=window.setInterval(()=>setSeconds(value=>{
      const next=Math.min(duration,value+0.1);
      if(next>=duration){setPlaying(false);setCompleted(true);}
      return next;
    }),100);
    return ()=>window.clearInterval(timer);
  },[playing,duration]);
  const seek=(s:number)=>{const next=Math.min(duration,Math.max(0,s));setSeconds(next);if(next>=duration){setCompleted(true);setPlaying(false);}};
  const restart=()=>{setSeconds(0);setCompleted(false);setPlaying(true);};
  return <section className="story-briefing-video" aria-label={mission.title+" animated historical explainer"}>
    <header className="story-video-header">
      <div><small>ORBITAL / HISTORICAL VIDEO BRIEFING</small><strong>{mission.title}</strong></div>
      <span>ANIMATED RECONSTRUCTION · NOT ORIGINAL FILM</span>
    </header>
    <div className={`story-video-screen story-video-world-${storyVideoWorld(mission)} story-video-scene-${chapter.scene} ${playing?"playing":"paused"}`}>
      <div className="story-video-space" aria-hidden="true">
        <i className="story-video-orbit orbit-one"/><i className="story-video-orbit orbit-two"/>
        <i className="story-video-planet"/><i className="story-video-horizon"/>
        <i className="story-video-spacecraft"><b/><span/><em/></i>
      </div>
      <div className="story-video-film-noise" aria-hidden="true"/>
      <div className="story-video-screen-content" aria-live="off">
        <span className="story-video-timecode">{String(Math.floor(seconds/60)).padStart(2,"0")}:{String(Math.floor(seconds%60)).padStart(2,"0")} / 00:{duration}</span>
        <small>{chapter.label} · {mission.year}</small>
        <h2 key={index}>{chapter.title}</h2>
        <p key={index+"subtitle"}>{chapter.description}</p>
      </div>
      {ready&&<div className="story-video-finished">✓ ANIMATED HISTORY VIDEO COMPLETE</div>}
    </div>
    <div className="story-video-controls">
      <button type="button" onClick={ready?restart:()=>setPlaying(v=>!v)} aria-label={ready?"Replay historical briefing":playing?"Pause historical briefing":"Play historical briefing"}>
        {ready?"↻ REPLAY":playing?"Ⅱ PAUSE":"▶ PLAY"}
      </button>
      <input type="range" min="0" max={duration} step="0.1" value={seconds}
        onChange={e=>seek(Number(e.target.value))} aria-label="Video position"/>
      <span>{index+1} / {chapters.length}</span>
    </div>
    <div className="story-video-chapters" aria-label="Video chapters">
      {chapters.map((c,i)=><button key={c.label} type="button"
        aria-current={index===i?"step":undefined} onClick={()=>seek(i*STORY_VIDEO_CHAPTER_SECONDS)}
        className={i===index?"active":""}>{String(i+1).padStart(2,"0")} <span>{c.label.split("/ ")[1]}</span></button>)}
    </div>
    <div className="story-video-source">
      <p>This is an <b>original animated educational summary</b>, not real NASA or crew footage. The facts are drawn from the game's historical record; imagery, timing and spacecraft movements are illustrative.</p>
      <a href={mission.source} target="_blank" rel="noopener noreferrer">Historical source / agency archive ↗</a>
    </div>
    <button className="history-film-continue" type="button" disabled={!ready} onClick={onWatched}>
      {ready?"VIDEO FINISHED · LIVE THE MISSION →":"WATCH ANIMATED HISTORY VIDEO FIRST"}
    </button>
  </section>;
}
