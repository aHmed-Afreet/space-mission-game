import {useEffect,useState} from "react";
import type {Outpost} from "../engine";
import ChallengeSystems from "./ChallengeSystems";
import {getCachedSolar,getNasaImages,getNasaSolarEvents,setCachedSolar,solarScienceQuestion,
 type NasaPhoto,type NasaSolarResult} from "./nasaData";
import {NASA_RESOURCES,NASA_SCIENCE_DISCLAIMER} from "./nasaResources";
import "./nasaScience.css";

type Tab="systems"|"weather"|"photos"|"research";
/** An independent science screen. Does not change the survival save, resources,
 * credits, radiation, challenge score, rover, or physics. */
export default function NasaScience({session,onClose}:{
 session:Outpost;onClose:()=>void;
}){
 const destination=session.destination;
 const [tab,setTab]=useState<Tab>("systems");
 const [solar,setSolar]=useState<NasaSolarResult|null>(()=>{
  try{return getCachedSolar(localStorage);}catch{return null;}
 });
 const [loading,setLoading]=useState(!solar);
 const [photos,setPhotos]=useState<NasaPhoto[]>([]);
 const [photoError,setPhotoError]=useState("");
 const [answer,setAnswer]=useState<"shield"|"solar"|"greenhouse"|null>(null);
 useEffect(()=>{
  if(solar)return;
  const controller=new AbortController();
  const timeout=window.setTimeout(()=>controller.abort(),12000);
  let active=true;
  getNasaSolarEvents({signal:controller.signal}).then(data=>{
   if(!active)return;
   setSolar(data);
   try{setCachedSolar(localStorage,data);}catch{/* Private mode. */}
  }).catch(()=>{
   if(active)setSolar({status:"unavailable",from:"",through:"",events:[],
     fetchedAt:new Date().toISOString(),message:"NASA is unreachable. Game simulation continues normally."});
  }).finally(()=>{window.clearTimeout(timeout);if(active)setLoading(false);});
  return ()=>{active=false;window.clearTimeout(timeout);controller.abort();};
 },[solar]);
 useEffect(()=>{
  if(tab!=="photos"||photos.length||photoError)return;
  const controller=new AbortController(),timeout=window.setTimeout(()=>controller.abort(),12000);
  let active=true;
  getNasaImages(destination==="moon"?"Apollo Moon astronaut NASA":"Mars rover NASA",
   {signal:controller.signal}).then(data=>{
    if(active){setPhotos(data);if(!data.length)setPhotoError("NASA returned no matching images.");}
   }).catch(()=>{if(active)setPhotoError("NASA Images cannot be reached. You can still use the other resources.");})
   .finally(()=>window.clearTimeout(timeout));
  return ()=>{active=false;window.clearTimeout(timeout);controller.abort();};
 },[tab,photos.length,photoError,destination]);
 return <section className="j3-panel j3-panel-console j3-nasa-panel"
  role="dialog" aria-modal="true" aria-label="Real NASA Space Science Resources">
  <div className="j3-panel-content" tabIndex={0}>
   <span className="j3-kicker">NASA SOURCES · REAL SPACE SCIENCE</span>
   <h2>NASA SCIENCE LAB</h2>
   <p>Learn from real NASA observations and research while exploring {destination==="moon"?"the Moon":"Mars"}.
     The planet base remains a simulated training game.</p>
   <div className="j3-nasa-tabs" role="group" aria-label="NASA science categories">
    <button type="button" aria-pressed={tab==="systems"} onClick={()=>setTab("systems")}>MISSION SYSTEMS</button>
    <button type="button" aria-pressed={tab==="weather"} onClick={()=>setTab("weather")}>SPACE WEATHER</button>
    <button type="button" aria-pressed={tab==="photos"} onClick={()=>setTab("photos")}>NASA PHOTOS</button>
    <button type="button" aria-pressed={tab==="research"} onClick={()=>setTab("research")}>RESEARCH</button>
   </div>
   {tab==="systems"&&<ChallengeSystems session={session}/>}
   {tab==="weather"&&<>
    <span className="j3-kicker">OBSERVED SOLAR ACTIVITY · NASA CCMC DONKI</span>
    {loading&&<div className="j3-info" role="status">Contacting NASA's live space-weather database…</div>}
    {solar?.status==="unavailable"&&<div className="j3-info" role="status">
      NASA space-weather data is unavailable. No made-up events are shown; your Outpost gameplay is unaffected.
    </div>}
    {solar?.status==="nasa"&&<>
     <div className="j3-info">NASA DATA · {solar.from} to {solar.through} · {solar.events.length} verified-format records.
       These are solar events, not measurements of radiation at your base.</div>
     {!solar.events.length&&<p>No solar-event records were returned during this period.</p>}
     <div className="j3-nasa-events">{solar.events.slice(0,12).map(event=><article key={event.id}>
       <b>{event.kind}{event.classType?" · "+event.classType:""}</b>
       <small>{new Date(event.eventDate).toLocaleString()}</small>
       <a target="_blank" rel="noopener noreferrer" href={event.sourceUrl}>View NASA record ↗</a>
      </article>)}</div>
    </>}
    <div className="j3-nasa-practice">
     <b>CREW SAFETY CHALLENGE</b>
     <p>{solarScienceQuestion(solar?.events??[])}</p>
     <div className="j3-nasa-answers">
      <button type="button" onClick={()=>setAnswer("shield")}>Go to the storm shelter</button>
      <button type="button" onClick={()=>setAnswer("solar")}>Turn on more solar panels</button>
      <button type="button" onClick={()=>setAnswer("greenhouse")}>Grow extra crops</button>
     </div>
     {answer&&<p role="status">{answer==="shield"?
      "✓ Correct. The storm shelter provides the simulated base's radiation shielding.":
      "Not quite. The storm shelter is the intended protective location in this training scenario."}</p>}
    </div>
    <a className="j3-nasa-source-link" href={NASA_RESOURCES.donkiDocs}
     target="_blank" rel="noopener noreferrer">Source: NASA CCMC DONKI ↗</a>
   </>}
   {tab==="photos"&&<>
    <p>Actual NASA mission imagery, not screenshots or claimed photorealistic game models.
      Credit and image details are linked to the NASA Image and Video Library.</p>
    {photoError?<div className="j3-info" role="status">{photoError}</div>:
     !photos.length?<div className="j3-info" role="status">Loading NASA mission photographs…</div>:null}
    <div className="j3-nasa-photos">{photos.slice(0,8).map(photo=><a key={photo.id}
      href={photo.page} target="_blank" rel="noopener noreferrer">
      <img src={photo.thumbnail} alt={photo.title} loading="lazy" referrerPolicy="no-referrer"/>
      <b>{photo.title}</b><small>NASA ID {photo.id} · {photo.center||"NASA Archive"}</small>
     </a>)}</div>
    <a className="j3-nasa-source-link" href={NASA_RESOURCES.nasaImagesDocs}
     target="_blank" rel="noopener noreferrer">NASA Images API documentation ↗</a>
   </>}
   {tab==="research"&&<>
    <article className="j3-nasa-study"><h3>Life Support: NASA BVAD</h3>
     <p>NASA's Life Support Baseline Values and Assumptions Document gives engineering
       context for oxygen, drinking water, food needs and recycling. Outpost's
       resource percentages and daily losses are simplified for educational gameplay.</p>
     <a href={NASA_RESOURCES.lifeSupport} target="_blank" rel="noopener noreferrer">Read NASA life-support research ↗</a></article>
    <article className="j3-nasa-study"><h3>Radiation: NASA DONKI</h3>
     <p>DONKI records solar flares and particle events. A solar-event listing does not
       tell us the absorbed dose for a particular astronaut or a particular shelter.</p>
     <a href={NASA_RESOURCES.donkiMigration} target="_blank" rel="noopener noreferrer">NASA 2026 API migration announcement ↗</a></article>
    <article className="j3-nasa-study"><h3>Planetary Exploration: NASA Trek</h3>
     <p>Explore official lunar and planetary imagery. The Outpost 3D landscape is a
       gameplay environment and is not generated from these live map layers.</p>
     <a href={NASA_RESOURCES.nasaTrek} target="_blank" rel="noopener noreferrer">Open NASA Trek ↗</a></article>
    <article className="j3-nasa-study"><h3>NASA Space Apps challenge</h3>
     <p>Independent game inspired by the Junior Astronaut Mission Trainer challenge.
       Exact entries in the event's Resources tab should be cross-checked separately.</p>
     <a href={NASA_RESOURCES.challenge} target="_blank" rel="noopener noreferrer">Official 2026 challenge brief ↗</a></article>
   </>}
   <div className="j3-nasa-disclaimer"><strong>SCIENCE LABEL:</strong> {NASA_SCIENCE_DISCLAIMER}</div>
  </div>
  <div className="j3-panel-footer"><button type="button" className="j3-primary"
   onClick={onClose}>RETURN TO 3D WORLD</button></div>
 </section>;
}
