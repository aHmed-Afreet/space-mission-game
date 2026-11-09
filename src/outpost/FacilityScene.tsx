import { ACTIONS,CROPS,availableAction,type Action,type CropType,type Outpost } from "./engine";
import "./facility.css";

export const FACILITIES = [
  {id:"habitat",title:"Crew Habitat",x:50,y:51,icon:"⌂",description:"Inspect cabin pressure reserves, crew readiness and mechanical integrity.",operations:["repair","rest","supplies"]},
  {id:"solar",title:"Solar Arrays",x:22,y:46,icon:"☀",description:"Sunlight drives life-support machinery. Increase capacity before darkness or storms.",operations:["solar"]},
  {id:"shield",title:"Storm Shelter",x:78,y:38,icon:"⬡",description:"Reinforcing shielding reduces exposure during particle events.",operations:["shield"]},
  {id:"recycle",title:"Air & Water",x:22,y:77,icon:"↻",description:"Electrically powered recycling supports oxygen and drinking water.",operations:["recycler"]},
  {id:"greenhouse",title:"Greenhouse",x:77,y:76,icon:"✿",description:"Plant crops, adjust food priorities, and harvest when ready.",operations:["plant","greenhouse","harvest"]},
  {id:"battery",title:"Battery Bank",x:49,y:85,icon:"▰",description:"Store electrical energy for night and dust storms.",operations:["battery"]},
] as const;
export type FacilityId = (typeof FACILITIES)[number]["id"];

function metric(s:Outpost,id:FacilityId){
  switch(id){
    case "habitat":return "HABITAT CONDITION "+Math.round(s.integrity)+"% · CREW "+Math.round(s.safety)+"%";
    case "solar":return "SOLAR CAPACITY / LEVEL "+s.solar;
    case "shield":return "RADIATION SHIELD / LEVEL "+s.shielding;
    case "recycle":return "RECYCLING / LEVEL "+s.recycling;
    case "greenhouse":return "GROWING "+CROPS[s.cropType].label.toUpperCase()+" · "+Math.round(s.crop)+"% READY";
    case "battery":return "ENERGY RESERVE "+Math.round(s.battery)+"%";
  }
}
function FacilityIllustration({id,s}:{id:FacilityId;s:Outpost}){
  if(id==="greenhouse")return <div className="op-interior op-greenhouse-interior" aria-hidden="true">
    <div className="op-interior-top">HYDROPONICS / {CROPS[s.cropType].label.toUpperCase()}</div>
    <div className="op-crop-tank"><span>{Array.from({length:6},(_,i)=><b key={i} style={{height:(16+Math.min(s.crop,90)*.4)+(i%2)*4+"px"}}>✿</b>)}</span></div>
    <div className="op-interior-bottom">GROWTH {Math.round(s.crop)}% · HARVEST AT 10+ · PRODUCED {s.foodProduced} UNITS</div>
  </div>;
  if(id==="solar")return <div className="op-interior op-solar-interior" aria-hidden="true"><div className="op-interior-top">SOLAR CONTROL / ARRAY {s.solar}</div><div className="op-solar-cells">{Array.from({length:12},(_,i)=><span key={i}/>)}</div><div className="op-interior-bottom">SUNLIGHT-DEPENDENT ELECTRICAL OUTPUT</div></div>;
  if(id==="shield")return <div className="op-interior op-shelter-interior" aria-hidden="true"><div className="op-interior-top">RADIATION PROTECTION</div><div className="op-shield-rings"><span>⬡</span><b>LEVEL {s.shielding}</b></div><div className="op-interior-bottom">RADIATION INDEX {Math.round(s.radiation)} · SAFETY {Math.round(s.safety)}%</div></div>;
  if(id==="recycle")return <div className="op-interior op-recycle-interior" aria-hidden="true"><div className="op-interior-top">CLOSED LOOP LIFE SUPPORT</div><div className="op-cycle">O₂ <b>⇄</b> H₂O</div><div className="op-interior-bottom">OXYGEN {Math.round(s.oxygen)}% · WATER {Math.round(s.water)}%</div></div>;
  if(id==="battery")return <div className="op-interior op-battery-interior" aria-hidden="true"><div className="op-interior-top">ENERGY STORAGE</div><div className="op-charge"><span style={{width:Math.max(0,Math.min(100,s.battery))+"%"}}/></div><div className="op-interior-bottom">{Math.round(s.battery)}% CHARGE · NIGHT RESERVE</div></div>;
  return <div className="op-interior op-habitat-interior" aria-hidden="true"><div className="op-interior-top">PRESSURIZED CREW HABITAT</div><div className="op-habitat-status"><span>O₂ <b>{Math.round(s.oxygen)}%</b></span><span>H₂O <b>{Math.round(s.water)}%</b></span><span>CREW <b>{Math.round(s.safety)}%</b></span></div><div className="op-interior-bottom">CABIN INTEGRITY {Math.round(s.integrity)}%</div></div>;
}
export function FacilityScene({s,selected,onSelect,onAction,onCropPlan}:{s:Outpost;selected:FacilityId;onSelect:(id:FacilityId)=>void;onAction:(a:Action)=>void;onCropPlan:(crop:CropType)=>void}){
  const facility=FACILITIES.find(x=>x.id===selected)!;
  return <div className="op-facility">
    <div className={"op-landscape "+(s.destination==="mars"?"op-mars":"op-moon")+(s.destination==="moon"&&(s.sol===5||s.sol===6)?" op-night":"")+(s.destination==="mars"&&[4,5,8].includes(s.sol)?" op-dust":"")} aria-label="Interactive view of the outpost facility layout">
      <svg className="op-illustration" viewBox="0 0 1000 460" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
        <defs>
          <radialGradient id="op-sky" cx="70%" cy="15%" r="75%"><stop stopColor={s.destination==="mars"?"#74525c":"#426277"}/><stop offset="1" stopColor={s.destination==="mars"?"#281d31":"#081827"}/></radialGradient>
          <linearGradient id="op-floor" x1="0" y1="0" x2="1" y2="1"><stop stopColor={s.destination==="mars"?"#a0634b":"#68727c"}/><stop offset="1" stopColor={s.destination==="mars"?"#583834":"#333e4e"}/></linearGradient>
          <linearGradient id="op-dome" x1="0" x2="1" y1="0" y2="1"><stop stopColor="#d7f3e4" stopOpacity=".75"/><stop offset=".4" stopColor="#47848b" stopOpacity=".7"/><stop offset="1" stopColor="#102a39"/></linearGradient>
          <linearGradient id="op-panel" x1="0" x2="1"><stop stopColor="#22536a"/><stop offset=".5" stopColor="#467e91"/><stop offset="1" stopColor="#173548"/></linearGradient>
        </defs>
        <rect width="1000" height="460" fill="url(#op-sky)"/>
        <g opacity=".8"><circle cx="98" cy="43" r="2" fill="#d4e9fb"/><circle cx="275" cy="70" r="1.4" fill="#d4e9fb"/><circle cx="690" cy="33" r="2" fill="#d4e9fb"/><circle cx="865" cy="112" r="1.5" fill="#d4e9fb"/><circle cx="980" cy="55" r="1.4" fill="#d4e9fb"/></g>
        <circle cx="794" cy="79" r="46" fill={s.destination==="mars"?"#f3b78e":"#d8e4f2"} opacity=".6"/>
        <path d="M0 280 L95 230 L174 263 L291 211 L375 249 L479 212 L590 258 L695 210 L773 252 L879 202 L1000 273 V460 H0 Z" fill={s.destination==="mars"?"#63403c":"#455666"}/>
        <path d="M0 303 Q230 256 447 311 Q681 252 1000 296 V460 H0Z" fill="url(#op-floor)"/>
        <g stroke="#b6a7a7" strokeOpacity=".15" strokeWidth="1.4"><path d="M-50 460 L475 292 M120 460 L508 292 M320 460 L535 290 M640 460 L565 293 M860 460 L594 293 M1070 460 L637 299"/><path d="M0 358 Q500 313 1000 356 M0 420 Q500 370 1000 414"/></g>
        <g opacity=".85"><path d="M364 292L390 266L651 266L680 292" stroke="#98c9cb" strokeWidth="6" fill="none"/><path d="M512 292V368M327 325L431 325M632 329L740 330" stroke="#7ab7bf" strokeWidth="9" fill="none"/></g>
        <g transform="translate(175,195)"><path d="M0 115L20 79L210 57L223 95L194 142L12 142Z" fill="#243f4d" stroke="#8dc4c8" strokeWidth="3"/><path d="M14 105L41 75L184 60L202 96L182 124L29 125Z" fill="url(#op-panel)" stroke="#b8dae0" strokeWidth="2"/>{[1,2,3,4,5].map(i=><path key={i} d={"M"+(17+i*30)+" "+(75-i*2)+"l12 53"} stroke="#b1d7dc" strokeWidth="2" opacity=".5"/>)}<path d="M20 101L199 82" stroke="#95b7c2" strokeWidth="2"/><path d="M64 140v28M177 138v28" stroke="#bdcbcf" strokeWidth="6"/></g>
        <g transform="translate(440,171)"><ellipse cx="84" cy="180" rx="174" ry="20" fill="#08131e" opacity=".5"/><path d="M-38 137 A122 122 0 0 1 206 137 L206 173L-38 173Z" fill="url(#op-dome)" stroke="#a8e4da" strokeWidth="4"/><path d="M-38 136H206M84 14V173M24 31L24 173M144 32L144 173" stroke="#add9d7" strokeOpacity=".5" strokeWidth="3"/><path d="M-38 141H206V174H-38Z" fill="#1a3e4e" stroke="#c4e0e2" strokeWidth="3"/><rect x="44" y="121" width="80" height="53" rx="7" fill="#163643" stroke="#9cced3" strokeWidth="4"/><circle cx="108" cy="148" r="3" fill="#d1edaa"/><path d="M-25 160H196" stroke="#a4d0cf" strokeWidth="2"/></g>
        <g transform="translate(743,202)"><path d="M0 103L42 44L138 44L174 103V150H0Z" fill="#374b5b" stroke="#b7ced4" strokeWidth="4"/><path d="M41 44L87 0L140 44" fill="#526578" stroke="#b7ced4" strokeWidth="4"/><rect x="61" y="98" width="55" height="53" rx="5" fill="#162937" stroke="#8cafb8" strokeWidth="3"/><path d="M72 92H103" stroke="#d4ebc0" strokeWidth="6"/></g>
        <g transform="translate(170,343)"><rect width="132" height="67" rx="11" fill="#1c4652" stroke="#b4dbd5" strokeWidth="3"/><path d="M25 30Q64 -2 103 30Q64 67 25 30Z" fill="#357986" stroke="#95dad1" strokeWidth="3"/><path d="M63 8V52" stroke="#c5e7d6" strokeWidth="3"/></g>
        <g transform="translate(735,333)"><path d="M0 78Q3-5 103-10Q203-5 206 78Z" fill="#4b9090" fillOpacity=".65" stroke="#b8e1d5" strokeWidth="4"/><path d="M17 77H186M59 9V76M145 9V76" stroke="#c6e6d1" strokeWidth="2"/>{[39,72,106,140,171].map((x,i)=><g key={i}><path d={"M"+x+" 71v-29"} stroke="#98d7ad" strokeWidth="4"/><path d={"M"+x+" 54l-10-9M"+x+" 54l10-9"} stroke="#89e2aa" strokeWidth="5"/></g>)}</g>
        <g transform="translate(428,385)"><rect width="183" height="56" rx="7" fill="#20333f" stroke="#a3c3cb" strokeWidth="3"/>{[0,1,2,3].map(i=><rect key={i} x={13+i*40} y="10" width="31" height="35" rx="2" fill="#4aa391" fillOpacity={Math.max(.15,s.battery/100)} stroke="#c5e3d3" strokeWidth="2"/>)}</g>
        <path d="M0 454Q160 431 290 451Q562 416 770 451Q908 433 1000 453V460H0Z" fill="#273139" opacity=".55"/>
      </svg>
      <div className="op-scene-hud">LIVE OUTPOST / SOL {s.sol} <span>{s.destination==="mars"?"MARS":"MOON"}</span></div>
      {FACILITIES.map(f=><button key={f.id} type="button" onClick={()=>onSelect(f.id)} className={"op-hotspot"+(selected===f.id?" active":"")} style={{left:f.x+"%",top:f.y+"%"}} aria-pressed={selected===f.id} aria-label={"Operate "+f.title}><b aria-hidden="true">{f.icon}</b><span>{f.title}</span></button>)}
      <div className="op-scene-caption">TAP ANY FACILITY TO ENTER ITS CONTROL PANEL</div>
    </div>
    <div className="op-console" aria-live="polite">
      <div className="op-console-heading"><div><span className="outpost-eyebrow">FACILITY CONTROL / {selected.toUpperCase()}</span><h3>{facility.title}</h3><p>{facility.description}</p></div><strong>{metric(s,selected)}</strong></div>
      <div className="op-console-body"><FacilityIllustration id={selected} s={s}/><div className="op-console-actions">
        {selected==="greenhouse" && <div className="op-crop-picker"><strong>SELECT NEXT CROP TO PLANT</strong><div>{(Object.keys(CROPS) as CropType[]).map(crop=><button key={crop} type="button" disabled={s.phase!=="active" || Boolean(s.selected)} aria-pressed={s.plannedCrop===crop} className={s.plannedCrop===crop?"active":""} onClick={()=>onCropPlan(crop)}><b>{CROPS[crop].label}</b><small>+{CROPS[crop].growth} growth · {CROPS[crop].water} water · {CROPS[crop].harvest} harvest food</small></button>)}</div><p>{CROPS[s.plannedCrop].description} Planting costs 9 credits, takes your one daily operation, and resets current growth.</p></div>}
        <strong>AVAILABLE FACILITY OPERATIONS</strong>
        {facility.operations.map(id=>{const action=id as Action,info=ACTIONS.find(a=>a.id===action)!,ok=availableAction(s,action);return <button key={action} type="button" className="op-console-button" onClick={()=>onAction(action)} disabled={!ok.ok} title={ok.reason??info.description}><span>{info.title} <b>{info.cost?"−"+info.cost+" credits":"FREE"}</b></span><small>{ok.ok?info.note:ok.reason}</small></button>})}
        <small>One engineering operation per sol. Emergency responses are separate safety decisions.</small>
      </div></div>
    </div>
  </div>;
}
