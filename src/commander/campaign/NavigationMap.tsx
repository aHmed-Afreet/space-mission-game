import { useEffect, useRef, useState } from "react";
import Icon from "../Icons";
import { deck, nearby } from "../layout";
import { currentObjective, fieldSites, outside, sitePosition, type Session } from "./engine";
import { missionById, type Site } from "./definitions";
import type { Destination } from "./environments";

const shipKeys: Site[] = [...(Object.keys(deck) as Site[]), "innerHatch", "airlock", "outerHatch"];
const fieldKeys = (destination: Destination): Site[] =>
  destination === "earth" ? ["survey"] : ["survey", "crater", "camp", "relay"];
const signNames: Partial<Record<Site,string>> = {
  cockpit:"FC-01 / FLIGHT CONTROL",science:"SCIENCE LAB",
  communications:"COMMUNICATIONS",power:"ECLSS / POWER DISTRIBUTION",
  galley:"GALLEY / FOOD & WATER",sleep:"CREW BERTH / 06",
  equipment:"EQUIPMENT STORAGE",innerHatch:"AIRLOCK / EVA",
  airlock:"AIRLOCK / EVA",outerHatch:"AIRLOCK / EVA",
};
const splitNames: Record<string,string[]> = {
  cockpit:["Flight deck"],science:["Science laboratory"],
  communications:["Communications"],power:["Power &","life support"],
  galley:["Galley & water"],sleep:["Crew quarters"],equipment:["Equipment bay"]
};

export function NavigationContent({s}:{s:Session}) {
  const mission=missionById(s.missionId);
  const objective=currentObjective(s);
  const [kind,setKind]=useState<"ship"|"surface">(outside(s)&&mission.eva?"surface":"ship");
  const [selected,setSelected]=useState<Site|null>(null);
  const surface=kind==="surface"&&mission.eva;
  const sites=surface?fieldKeys(mission.destination):shipKeys;
  const goal=objective?.site?sitePosition(objective.site,mission.destination).name:null;
  const here=outside(s)?"Outside spacecraft":
    nearby(s.position.x,s.position.z) ? deck[nearby(s.position.x,s.position.z)!].name : "Central passage";
  const px=(x:number)=>320+x*(surface?22:90);
  const py=(z:number)=>surface?96+(z-8)*15:64+(z+6.1)*35.5;
  const drawPlayer=surface||!outside(s);
  const userX=surface&&!outside(s)?320:px(s.position.x);
  const userY=surface&&!outside(s)?76:py(s.position.z);

  return <div className="nav-map-content">
    <div className="nav-map-subhead">
      <div><small>SPACECRAFT / LOCATION REFERENCE</small>
      <h2>{surface?"Exterior operations map":"Spacecraft deck map"}</h2></div>
      <span>NO DIRECTION ARROWS</span>
    </div>
    {mission.eva&&<div className="nav-map-switch" role="group" aria-label="Choose map">
      <button type="button" aria-pressed={!surface} onClick={()=>{setKind("ship");setSelected(null)}}>Spacecraft</button>
      <button type="button" aria-pressed={surface} onClick={()=>{setKind("surface");setSelected(null)}}>Outside / EVA</button>
    </div>}
    <div className="nav-map-columns">
      <div className="nav-map-diagram">
        <svg className="nav-map-svg" viewBox="0 0 640 690" role="img"
          aria-label={surface?"Surface map with named sites and player location":"Spacecraft map with named rooms, hatches and player location"}>
          <defs><pattern id="nav-grid" patternUnits="userSpaceOnUse" width="24" height="24">
            <path d="M24 0H0V24" fill="none" stroke="#7898a0" strokeOpacity=".12"/>
          </pattern></defs>
          <rect width="640" height="690" rx="14" fill="#0b1b25"/>
          <rect width="640" height="690" fill="url(#nav-grid)"/>
          {surface?<>
            <path d="M35 445Q110 395 185 438T360 432T602 432M38 570Q115 525 213 548T400 534T598 541"
              fill="none" stroke="#78918b" strokeOpacity=".4" strokeWidth="2"/>
            <rect x="270" y="35" width="100" height="85" rx="12" fill="#27404a" stroke="#819fa8"/>
            <text x="320" y="75" textAnchor="middle" className="nav-map-label">Spacecraft</text>
            <text x="320" y="93" textAnchor="middle" className="nav-map-caption">AIRLOCK EXIT</text>
            {sites.map(id=>{
              const site=sitePosition(id,mission.destination);
              const x=px(site.x), y=py(site.z);
              return <g key={id} className={selected===id?"selected":""}>
                <circle cx={x} cy={y} r="13" fill="#244554" stroke="#97cbb8" strokeWidth="2"/>
                <circle cx={x} cy={y} r="3" fill="#e4f8e9"/>
                <rect x={x-105} y={y+20} width="210" height="30" rx="6" fill="#16303a" stroke="#689591"/>
                <text x={x} y={y+39} textAnchor="middle" className="nav-map-label">{site.name}</text>
              </g>
            })}
          </>:<>
            <path d="M220 25H420L565 78V650L509 675H131L75 650V78Z" fill="#1e3541"
              stroke="#8bada7" strokeWidth="3"/>
            <rect x="274" y="36" width="92" height="627" rx="14" fill="#09232e" stroke="#637f84"/>
            <text x="320" y="480" className="nav-map-caption" textAnchor="middle"
              transform="rotate(-90 320 480)">CENTRAL PASSAGE</text>
            {[-4.35,-1.35,2.35].map(z=><g key={z}>
              <path d={"M76 "+py(z)+"H270M370 "+py(z)+"H564"} stroke="#789a9b" strokeWidth="4" strokeOpacity=".66"/>
              <rect x="308" y={py(z)-6} width="24" height="12" rx="3" fill="#a6cbb9"/>
            </g>)}
            {(Object.keys(deck) as (keyof typeof deck)[]).map(id=>{
              const r=deck[id], x=px(r.x), y=py(r.z), parts=splitNames[id];
              return <g key={id} className={selected===id?"selected":""}>
                <rect className="nav-map-room" x={x-(id==="cockpit"?115:88)}
                  y={y-28} width={id==="cockpit"?230:176} height="56" rx="8"/>
                <text x={x} y={y-(parts.length>1?7:1)} textAnchor="middle" className="nav-map-label">
                  {parts.map((word,i)=><tspan key={word} x={x} dy={i?15:0}>{word}</tspan>)}
                </text>
                <text x={x} y={y+20} textAnchor="middle" className="nav-map-caption">STATION {r.code}</text>
              </g>;
            })}
            {(["innerHatch","airlock","outerHatch"] as const).map(id=>{
              const r=fieldSites[id], y=py(r.z);
              return <g key={id} className={selected===id?"selected":""}>
                <circle cx="320" cy={y} r="9" fill="#163a42" stroke="#b5d4c3" strokeWidth="2"/>
                <path d={"M335 "+y+"H388"} stroke="#769899"/>
                <text x="397" y={y+4} className="nav-map-label">{r.name}</text>
              </g>;
            })}
          </>}
          {drawPlayer&&<g transform={"translate("+userX+" "+userY+") rotate("+(-s.position.heading*180/Math.PI)+")"}>
            <circle r="17" fill="#b0f4e1" fillOpacity=".25" stroke="#b9f4e4" strokeWidth="2"/>
            <path d="M0-12L7 8 0 3-7 8Z" fill="#d4ffe9" stroke="#16323b"/>
          </g>}
          <text x="25" y="672" className="nav-map-caption">ORBITAL / NAVIGATION</text>
        </svg>
        <p className="nav-map-footnote">● Your position · Navigation is manual. No arrows or automatic route.</p>
      </div>
      <aside className="nav-map-directory-side">
        <div className="nav-map-current">
          <small>YOU ARE HERE</small><strong>{here}</strong>
          <small>CURRENT OBJECTIVE LOCATION</small>
          <strong>{goal||"No specific room required"}</strong>
          {objective?.site&&!sites.includes(objective.site)&&
            <p>Choose the other map above to see this location.</p>}
        </div>
        <h3>{surface?"Outside locations":"Ship compartments and airlock"}</h3>
        <p>These are the same names shown in mission instructions. Look for the name on the map and signs in the spacecraft.</p>
        <div className="nav-map-places">{sites.map((id,i)=><button key={id} type="button"
          aria-pressed={selected===id} className={selected===id?"selected":""}
          onClick={()=>setSelected(selected===id?null:id)}>
            <em>{String(i+1).padStart(2,"0")}</em>
            <span><strong>{sitePosition(id,mission.destination).name}</strong>
              <small>{signNames[id]||"Surface science site"}</small></span>
          </button>)}</div>
        <p className="nav-map-footnote">You can inspect the map at any time. It does not restrict spacecraft interaction.</p>
      </aside>
    </div>
  </div>;
}

export default function NavigationMap({s,onClose}:{s:Session;onClose:()=>void}) {
  const closer=useRef<HTMLButtonElement>(null);
  useEffect(()=>{
    const prior=document.activeElement as HTMLElement|null;
    closer.current?.focus();
    const key=(e:KeyboardEvent)=>{if(e.key==="Escape"){e.preventDefault();onClose();}};
    window.addEventListener("keydown",key);
    return ()=>{window.removeEventListener("keydown",key);prior?.focus();};
  },[onClose]);
  return <div className="nav-map-layer">
    <button type="button" className="nav-map-backdrop" aria-label="Close navigation map" onClick={onClose}/>
    <section className="nav-map-dialog" role="dialog" aria-modal="true" aria-label="Navigation map">
      <header className="nav-map-top"><div><small>ORBITAL / NAVIGATION</small><h1>Navigation Map</h1></div>
        <button type="button" ref={closer} className="nav-map-close" onClick={onClose}>
          <Icon name="close" size={17}/> Close
        </button>
      </header>
      <NavigationContent s={s}/>
    </section>
  </div>;
}
