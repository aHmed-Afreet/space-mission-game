import {useState} from "react";
import {ACTIONS,CROPS,forecast,projectPower,type Outpost} from "../engine";
import {CHALLENGE_CHOICES,missionEngineeringLesson,projectEngineeringChoice,type ChallengeChoice} from "./challengeTradeoffs";
import {NASA_RESOURCES} from "./nasaResources";

/** Interactive challenge-alignment activity. No effect on the live player save.
 * NASA sources ground the system relationships; all values are game units. */
export default function ChallengeSystems({session}:{session:Outpost}){
 const [choice,setChoice]=useState<ChallengeChoice>("solar");
 const [showDecision,setShowDecision]=useState(false);
 const projection=projectEngineeringChoice(session,choice);
 const conditions=forecast(session.destination,session.sol);
 const power=projectPower(session);
 const sourceCards=[
  {heading:"LIFE SUPPORT",measure:"O₂ "+session.oxygen+"% · WATER "+session.water+"%",
   detail:"An air/water recycler can recover supplies but requires electricity.",
   label:"NASA Life Support BVAD",url:NASA_RESOURCES.lifeSupport},
  {heading:"RADIATION SHIELDING",measure:"SHELTER LEVEL "+session.shielding+" · EXPOSURE INDEX "+Math.round(session.radiation),
   detail:"Storms in the game are authored training events; NASA's DONKI tracks real solar activity.",
   label:"NASA CCMC DONKI",url:NASA_RESOURCES.donkiDocs},
  {heading:"POWER & STORAGE",measure:"SOLAR "+session.solar+" · BATTERY "+session.battery+"%",
   detail:"Solar generation depends on simulated sunlight; batteries bridge low-generation periods.",
   label:"NASA Lunar Surface Power",url:NASA_RESOURCES.lunarSurfacePower},
  {heading:"FOOD PRODUCTION",measure:CROPS[session.cropType].label.toUpperCase()+" · GROWTH "+Math.round(session.crop)+"/100",
   detail:"Crop production needs water, controlled growing conditions and electrical energy.",
   label:"NASA Growing Plants in Space",url:NASA_RESOURCES.cropResearch},
 ] as const;
 return <div className="j3-challenge-systems">
  <span className="j3-kicker">NASA SPACE APPS 2026 · JUNIOR ASTRONAUT TRAINER</span>
  <h3>WHAT WILL KEEP YOUR CREW ALIVE?</h3>
  <p>The official challenge asks players to balance <strong>life support, radiation shielding, electricity and food</strong>, not maximize a single resource. Use this interactive planner to test a decision before doing it in the real game.</p>
  <a className="j3-nasa-source-link" href={NASA_RESOURCES.challengeResources}
   target="_blank" rel="noopener noreferrer">Open the official challenge Resources tab ↗</a>
  <div className="j3-nasa-disclaimer">The challenge description was verified. Individual entries in the challenge's Resources tab could not be independently inspected. The NASA research links below are verified primary sources, but are <strong>not claimed to be on that tab</strong>.</div>
  <div className="j3-challenge-systems-grid">{sourceCards.map(card=><article key={card.heading}>
    <small>{card.heading}</small><strong>{card.measure}</strong>
    <p>{card.detail}</p><a href={card.url} target="_blank" rel="noopener noreferrer">{card.label} ↗</a>
   </article>)}</div>
  <div className="j3-info">
   <b>DAY {session.sol} — {conditions.title.toUpperCase()}</b>
   <p>Simulated sunlight: {Math.round(conditions.sunlight*100)}% · Calculated solar power: +{power.generation} units · Electricity demand: {power.demand} units · Expected battery: {power.projectedBattery}%.</p>
  </div>
  <section className="j3-challenge-planner" aria-label="Compare engineering choices without changing the real mission">
   <h3>ENGINEERING DECISION SIMULATOR</h3>
   <p>What if you used today's one engineering operation to improve a different system? Select an option to compare the game's actual projected results. This is a practice forecast, not a real NASA engineering calculation.</p>
   <div className="j3-challenge-options" role="group" aria-label="Choose an engineering scenario">
    {CHALLENGE_CHOICES.map(id=><button type="button" key={id} aria-pressed={choice===id}
       onClick={()=>{setChoice(id);setShowDecision(false);}}>
       {ACTIONS.find(a=>a.id===id)!.title}</button>)}
   </div>
   <p><b>Trade-off:</b> {missionEngineeringLesson(choice)}</p>
   {!projection.available&&<div className="j3-info" role="status">
    You cannot perform this operation now: {projection.reason} Choose another, or inspect the current systems without changing the save.
   </div>}
   <div className="j3-challenge-compare">
    <article><small>CURRENT CONFIGURATION</small>
     <strong>Battery forecast: {projection.currentPower.projectedBattery}%</strong>
     <span>Power generated: +{projection.currentPower.generation}</span>
     <span>Power demand: {projection.currentPower.demand}</span>
     <span>Oxygen: {projection.before.oxygen}% · Water: {projection.before.water}%</span>
     <span>Food: {projection.before.food}%</span>
    </article>
    <article><small>IF YOU CHOOSE {choice.toUpperCase()}</small>
     <strong>Battery forecast: {projection.plannedPower.projectedBattery}%</strong>
     <span>Power generated: +{projection.plannedPower.generation}</span>
     <span>Power demand: {projection.plannedPower.demand}</span>
     <span>Solar arrays: {projection.after.solar} · Recyclers: {projection.after.recycling}</span>
     <span>Shield level: {projection.after.shielding} · Greenhouses: {projection.after.greenhouses}</span>
     <span>Cost: {projection.creditsCost} game credits</span>
    </article>
   </div>
   <button type="button" className="j3-challenge-review" onClick={()=>setShowDecision(v=>!v)}>
    {showDecision?"HIDE THE NEXT-DAY MODEL":"SHOW NEXT-DAY CONSEQUENCES"}
   </button>
   {showDecision&&(projection.nextSol?
    <div className="j3-info" role="status">
     <b>SIMULATED NEXT DAY — AFTER THIS OPERATION</b>
     <p>Oxygen {projection.nextSol.oxygen}% · Water {projection.nextSol.water}% · Food {projection.nextSol.food}%
      · Battery {projection.nextSol.battery}% · Crop growth {projection.nextSol.crop}/100
      · Radiation index {projection.nextSol.radiation.toFixed(1)}.</p>
     <p>These are game-engine values for the current conditions, not NASA measurements and not a committed action. The actual mission may change with other decisions.</p>
    </div>:
    <div className="j3-info" role="status">
     {projection.awaitingEmergency?"Resolve today's simulated emergency first to produce a complete daily forecast.":
      "No complete next-day forecast is available while this operation is unavailable. The existing mission remains unchanged."}
    </div>)}
  </section>
 </div>;
}
