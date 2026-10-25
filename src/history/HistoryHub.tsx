import { useEffect, useMemo, useState } from "react";
import { historyMissions, type HistoryMission } from "./missionHistory";
import StoryFlight from "./StoryFlight";
import StoryBriefingVideo from "./StoryBriefingVideo";
import { officialFilmFor } from "./officialFilms";
import "./history.css";

const progressKey="orbital-history-progress-v1";
type HistoryProgress=Record<string,number>;
const readHistory=():HistoryProgress=>{
  try {
    const stored=JSON.parse(localStorage.getItem(progressKey)||"{}");
    if(!stored||Array.isArray(stored)||typeof stored!=="object")return {};
    return Object.fromEntries(Object.entries(stored).filter(([,v])=>v===1||v===2)) as HistoryProgress;
  } catch {return {};}
};
const preferences:{
  [key in HistoryMission["category"]]:{safe:string;risky:string;why:string}
}={
  Crewed:{safe:"Check crew consumables, confirm telemetry and follow the approved checklist.",risky:"Continue immediately without checking the warning.",why:"Human spaceflight depends on verified life support, vehicle status and disciplined procedures."},
  Robotic:{safe:"Verify navigation, instrument status and the communications window before sending commands.",risky:"Ignore the instrument status and transmit immediately.",why:"Robotic mission operations depend on precise navigation, limited power and long-distance communications."},
  "Space station":{safe:"Confirm the station's power, environmental control and team assignments first.",risky:"Activate all experiments without checking station systems.",why:"Station operations require continuous monitoring of power, life support and coordinated crew work."},
  Telescope:{safe:"Check pointing, thermal stability and calibration before gathering science.",risky:"Begin science collection before the observatory is ready.",why:"Stable pointing and careful instrument commissioning are essential for accurate space observations."},
};
const eras=["All periods","Early Space","Moon Race","Stations & Shuttles","Robotic Exploration","Modern Exploration"];
type EntryView="archive"|"live";
type Stage="context"|"operations"|"decision"|"result";
const stageOrder:Stage[]=["context","operations","decision","result"];

export default function HistoryHub({onExit,startIn="archive"}:{
  onExit:()=>void;startIn?:EntryView;
}) {
  const [view,setView]=useState<EntryView>(startIn);
  const [query,setQuery]=useState("");
  const [era,setEra]=useState("All periods");
  const [category,setCategory]=useState("All types");
  const [chosen,setChosen]=useState<HistoryMission|null>(null);
  const [stage,setStage]=useState<Stage>("context");
  const [filmOpened,setFilmOpened]=useState(false);
  const [filmConfirmed,setFilmConfirmed]=useState(false);
  const [answer,setAnswer]=useState<number|null>(null);
  const [results,setResults]=useState<HistoryProgress>(readHistory);
  const [page,setPage]=useState(1);
  const chosenCount=Object.keys(results).length;
  const list=useMemo(()=>historyMissions.filter(m=>{
    const hay=[m.title,m.destination,m.agency,m.background,m.skill].join(" ").toLowerCase();
    return hay.includes(query.toLowerCase().trim())&&(era==="All periods"||m.era===era)
      &&(category==="All types"||m.category===category);
  }),[query,era,category]);
  const shown=list.slice(0,page*12);
  const step=stageOrder.indexOf(stage);
  useEffect(()=>{setPage(1)},[query,era,category]);
  const open=(m:HistoryMission,mode:EntryView)=>{
    setChosen(m);setView(mode);setStage("context");setAnswer(null);
    setFilmOpened(false);setFilmConfirmed(false);
    window.scrollTo({top:0,behavior:"smooth"});
  };
  const close=()=>{setChosen(null);setAnswer(null);setStage("context");setFilmOpened(false);setFilmConfirmed(false)};
  const next=()=>{
    if(!chosen)return;
    if(stage==="result"){
      const newResults={...results,[chosen.id]:answer===0?2:1};
      setResults(newResults);
      try{localStorage.setItem(progressKey,JSON.stringify(newResults));}catch{/* private browsers can block storage */}
      setChosen(null);setStage("context");setAnswer(null);
      return;
    }
    setStage(stageOrder[step+1]);
  };
  const choice=chosen?preferences[chosen.category]:null;
  const officialFilm=chosen?officialFilmFor(chosen.title):undefined;
  // Watch verified video on the publisher's own site; never rehost agency footage.
  if(chosen&&view==="live"&&!filmConfirmed)return <main className="history-hub history-film-screen">
    <header className="history-header">
      <button type="button" className="history-back" onClick={close}>← All missions</button>
      <div className="history-brand"><span>✦</span> ORBITAL <small>WATCH → LIVE</small></div>
      <span className="history-completions">01 / 02 · WATCH FIRST</span>
    </header>
    <section className="history-film-card">
      <small>HISTORICAL MISSION · {chosen.year} · VIDEO FIRST</small>
      <h1>{chosen.title}: <em>watch the mission, then live it.</em></h1>
      {officialFilm ? <>
        <div className="history-film-banner"><strong>✓ VERIFIED OFFICIAL {officialFilm.publisher} VIDEO</strong>
          <span>{officialFilm.kind} · {officialFilm.duration}</span></div>
        <h2>{officialFilm.title}</h2>
        <p>{officialFilm.scope}</p>
        <a className="history-film-watch" href={officialFilm.url} target="_blank"
           rel="noopener noreferrer" onClick={()=>setFilmOpened(true)}>▶ WATCH VIDEO AT {officialFilm.publisher} ↗</a>
        <p className="history-film-instruction">The official video opens on NASA's website. Watch it there, then return to this tab to begin the interactive recreation.</p>
        <h3>Recreate these documented actions in order</h3>
        <ol className="history-film-steps">{officialFilm.order.map(item=><li key={item}>{item}</li>)}</ol>
        <a className="history-film-record" href={officialFilm.record} target="_blank" rel="noopener noreferrer">Read the official historical timeline / mission record ↗</a>
        <button className="history-film-continue" disabled={!filmOpened}
          onClick={()=>setFilmConfirmed(true)}>I WATCHED THE VIDEO · START LIVING THE MISSION →</button>
        {!filmOpened&&<p className="history-training-note">Open the verified NASA video first to unlock this mission's replay.</p>}
      </> : <>
        <div className="history-film-banner history-film-pending"><strong>▶ ANIMATED HISTORICAL VIDEO · MADE FROM DOCUMENTED MISSION FACTS</strong>
          <span>No verified original film for this mission</span></div>
        <p>Watch this original animated mission briefing. It is not archival footage; every chapter is based on this story's historical record, and the source is linked below.</p>
        <StoryBriefingVideo key={chosen.id} mission={chosen} onWatched={()=>setFilmConfirmed(true)}/>
      </>}
      <p className="history-training-note">Only documented sequences are presented as history. Unrecorded movements, controls, distances and settings are educational reconstructions.</p>
    </section>
  </main>;
  if(chosen&&view==="live")return <StoryFlight key={chosen.id} mission={chosen}
    onExit={close}
    onReadHistory={()=>{setView("archive");setStage("context");setAnswer(null)}}
    onComplete={()=>{
      const next={...results,[chosen.id]:2};
      setResults(next);
      try{localStorage.setItem(progressKey,JSON.stringify(next));}catch{/* storage may be disabled */}
      close();
    }}
  />;
  return <main className="history-hub">
    <header className="history-header">
      <button type="button" className="history-back" onClick={chosen?close:onExit}>{chosen?"← All missions":"← Main menu"}</button>
      <div className="history-brand"><span>✦</span> ORBITAL <small>SPACE HISTORY</small></div>
      <span className="history-completions">{chosenCount} / {historyMissions.length} STORIES EXPLORED</span>
    </header>
    {!chosen ? <>
      <section className="history-hero">
        <small>HUMANITY'S JOURNEY BEYOND EARTH</small>
        <h1>Real missions. <em>Remarkable stories.</em></h1>
        <p>Every one of the 55 missions starts with a video: official agency footage where verified, otherwise a clearly labeled animated historical explainer. Then enter the 3D mission.</p>
        <div className="history-tabs" role="group" aria-label="Space history experience">
          <button type="button" aria-pressed={view==="archive"} onClick={()=>setView("archive")}>READ HISTORY</button>
          <button type="button" aria-pressed={view==="live"} onClick={()=>setView("live")}>LIVE THE STORY</button>
        </div>
      </section>
      {view==="live"&&<section className="history-callout">
        <strong>Become the mission specialist</strong>
        <p>All 55 missions now have a video-first experience. Official films are identified separately from original educational animation; both lead to interactive 3D.</p>
      </section>}
      <div className="history-filters">
        <label>SEARCH MISSIONS<input type="search" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Apollo, Mars, telescope, ISS…"/></label>
        <label>PERIOD<select value={era} onChange={e=>setEra(e.target.value)}>{eras.map(x=><option key={x}>{x}</option>)}</select></label>
        <label>TYPE<select value={category} onChange={e=>setCategory(e.target.value)}>{["All types","Crewed","Robotic","Space station","Telescope"].map(x=><option key={x}>{x}</option>)}</select></label>
      </div>
      <p className="history-result-count">{list.length} missions found · Historical dates and outcomes reflect actual events. Some linked sources open broader archive pages.</p>
      <div className="history-grid">
        {shown.map(m=><article key={m.id} className="history-card">
          <div className="history-card-date"><span>{m.year}</span><small>{m.category.toUpperCase()}</small></div>
          <h2>{m.title}</h2>
          <p className="history-card-destination">{m.agency} · {m.destination}</p>
          <p>{m.background}</p>
          <div className="history-card-footer">
            {results[m.id]&&<span className="history-done">✓ Explored</span>}
            <button type="button" onClick={()=>open(m,view)}>
              {view==="live"?(officialFilmFor(m.title)?"Watch official video → Live":"Watch animated video → Live"):"Read story →"}
            </button>
          </div>
        </article>)}
      </div>
      {!list.length&&<p className="history-none">No missions match your search. Try another era or keyword.</p>}
      {shown.length<list.length&&<div className="history-more"><button type="button" onClick={()=>setPage(p=>p+1)}>Show more missions ({list.length-shown.length} remaining)</button></div>}
    </> : <>
      <section className="history-story">
        <div className="history-story-lead">
          <small>REAL SPACE MISSION · {chosen.year} · {chosen.category.toUpperCase()}</small>
          <h1>{chosen.title}</h1>
          <p>{chosen.agency} · {chosen.destination}</p>
          <div className="history-story-actions">
            <button type="button" onClick={()=>{setView("archive");setStage("context");setAnswer(null)}} aria-pressed={view==="archive"}>Read real history</button>
            <button type="button" onClick={()=>{setView("live");setStage("context");setAnswer(null)}} aria-pressed={view==="live"}>Live the story</button>
          </div>
        </div>
        {view==="archive"?<div className="history-story-panels">
          <article><small>01 / BACKGROUND</small><h2>Why this mission began</h2><p>{chosen.background}</p></article>
          <article><small>02 / THE MISSION</small><h2>What the team did</h2><p>{chosen.mission}</p></article>
          <article><small>03 / A REAL CHALLENGE</small><h2>The difficult part</h2><p>{chosen.challenge}</p></article>
          <article><small>04 / HISTORICAL OUTCOME</small><h2>What actually happened</h2><p>{chosen.outcome}</p></article>
          <article><small>05 / SKILLS & LEGACY</small><h2>What we can learn</h2><p>{chosen.skill}. This mission contributed to the techniques, scientific understanding or experience that informed later exploration.</p></article>
          <article><small>06 / PRIMARY SOURCE</small><h2>Explore the records</h2><p>Official histories and mission archives can provide technical background and mission details beyond this introduction.</p>
            <a href={chosen.source} rel="noopener noreferrer" target="_blank">Open historical source ↗</a></article>
          <div className="history-story-cta"><button type="button" onClick={()=>{setView("live");setStage("context");setAnswer(null)}}>Live the story →</button></div>
        </div>:
        <div className="history-live">
          <div className="history-progress" aria-label={`Story step ${step+1} of 4`}>
            {stageOrder.map((x,i)=><span key={x} className={i<=step?"active":""}/>)}
          </div>
          <small>CHAPTER {step+1} / 04 · INTERACTIVE HISTORY</small>
          <h2>{stage==="context"?"Mission briefing":stage==="operations"?"Your assignment":stage==="decision"?"Mission-control decision":"Historical outcome"}</h2>
          {stage==="context"&&<><p>{chosen.background}</p><p><strong>Destination:</strong> {chosen.destination}. <strong>Agency:</strong> {chosen.agency}.</p></>}
          {stage==="operations"&&<><p>Your team is preparing the following mission procedure:</p><blockquote>{chosen.mission}</blockquote>
            <p>The real team faced this challenge: {chosen.challenge}</p></>}
          {stage==="decision"&&choice&&<>
            <p><strong>Training scenario:</strong> How would you prioritize safe, disciplined operations while working toward the mission's objective?</p>
            {[choice.safe,choice.risky].map((x,i)=><button type="button" className={`history-choice ${answer===i?"chosen":""}`}
              key={x} aria-pressed={answer===i} onClick={()=>setAnswer(i)}>
                <span>{String(i+1).padStart(2,"0")}</span>{x}
              </button>)}
            {answer!==null&&<p className="history-feedback">{answer===0?"✓ Good priority.":"This choice adds avoidable risk."} {choice.why}</p>}
          </>}
          {stage==="result"&&<>
            <p><strong>What really happened:</strong> {chosen.outcome}</p>
            <p><strong>What you learned:</strong> {chosen.skill}.</p>
            <p className="history-training-note">Your training choice does not change the real historical result.</p>
          </>}
          <div className="history-live-actions">
            <button type="button" className="history-secondary" disabled={step===0} onClick={()=>setStage(stageOrder[step-1])}>← Previous</button>
            <button type="button" className="history-primary" disabled={stage==="decision"&&answer===null} onClick={next}>
              {stage==="result"?"Finish story ✓":"Continue →"}
            </button>
          </div>
          <p className="history-training-note">This is a historically inspired, simplified educational decision exercise — not an exact account of every procedure or a flight simulator.</p>
          <a href={chosen.source} target="_blank" rel="noopener noreferrer">Explore the official archive ↗</a>
        </div>}
      </section>
    </>}
    <footer className="history-footer">ORBITAL / SPACE HISTORY · Independent educational stories · Historical outcomes are never rewritten.</footer>
  </main>;
}
