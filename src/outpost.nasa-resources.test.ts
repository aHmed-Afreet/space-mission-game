import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {dayTimerRuns,DAY_TIME_LIMIT_MS} from "./outpost/dayChallenge";
import {NASA_RESOURCES,NASA_SCIENCE_DISCLAIMER} from "./outpost/nasa/nasaResources";
import {NASA_CACHE_KEY,donkiUrl,getCachedSolar,getNasaImages,getNasaSolarEvents,
 nasaWindow,parseDonki,setCachedSolar,solarScienceQuestion} from "./outpost/nasa/nasaData";

test("official NASA endpoints: migrated DONKI and library image search",()=>{
 const window=nasaWindow(new Date("2026-11-13T06:00:00Z"));
 assert.deepEqual(window,{startDate:"2026-10-15",endDate:"2026-11-13"});
 assert.equal(donkiUrl("SEP",window.startDate,window.endDate),
  "https://ccmc.gsfc.nasa.gov/DONKI-API/get/SEP?startDate=2026-10-15&endDate=2026-11-13");
 assert.equal(NASA_RESOURCES.nasaImagesApi,"https://images-api.nasa.gov/search");
 assert.match(NASA_RESOURCES.lifeSupport,/nasa.gov/);
 assert.match(NASA_SCIENCE_DISCLAIMER,/educational simulations/);
});
test("NASA records are validated, timestamps parsed, external links restricted to NASA",()=>{
 const [flare]=parseDonki([
  {flrID:"flare-1",beginTime:"2026-11-11T14:00:00Z",classType:"M2.1",link:"https://ccmc.gsfc.nasa.gov/DONKI/"},
  {beginTime:"not-a-date"}],"FLR");
 assert.equal(flare.kind,"Solar flare");
 assert.equal(flare.classType,"M2.1");
 assert.equal(parseDonki(null,"SEP").length,0);
 const [particle]=parseDonki([
  {sepID:"sep-1",eventTime:"2026-11-10T12:00:00Z",link:"https://not-nasa.example/"}],"SEP");
 assert.equal(particle.sourceUrl,NASA_RESOURCES.donkiDocs);
 assert.ok(!("radiationDose" in particle));
});
test("NASA solar event API uses live fetch response; no fabricated outages",async()=>{
 const urls:string[]=[];
 const api=(async(input:RequestInfo|URL)=>{
  const url=String(input);urls.push(url);
  return {ok:true,json:async()=>url.includes("/SEP?")?
   [{sepID:"nasa-sep-1",eventTime:"2026-11-12T08:00:00Z"}]:
   [{flrID:"nasa-flare",beginTime:"2026-11-11T07:00:00Z",classType:"M1.0"}]};
 }) as unknown as typeof fetch;
 const data=await getNasaSolarEvents({now:new Date("2026-11-13T06:00:00Z"),fetchImpl:api});
 assert.equal(data.status,"nasa");
 assert.equal(data.events.length,2);
 assert.equal(urls.length,2);
 assert.equal(data.events[0].kind,"Solar energetic particle event");
 assert.match(solarScienceQuestion(data.events),/storm shelter|shelter|shielding|radiation alert/i);
 const failed=await getNasaSolarEvents({fetchImpl:(async()=>{throw Error("Network error")}) as unknown as typeof fetch});
 assert.equal(failed.status,"unavailable");
 assert.deepEqual(failed.events,[]);
});
test("NASA observations cache is separate, expires after an hour and does not alter mission save",async()=>{
 const store=new Map<string,string>();
 const storage={getItem:(k:string)=>store.get(k)??null,setItem:(k:string,v:string)=>{store.set(k,v);}};
 const data=await getNasaSolarEvents({now:new Date("2026-11-13T06:00:00Z"),
  fetchImpl:(async()=>({ok:true,json:async()=>[]})) as unknown as typeof fetch});
 setCachedSolar(storage,data);
 assert.equal(getCachedSolar(storage,Date.parse("2026-11-13T06:45:00Z"))?.status,"nasa");
 assert.equal(getCachedSolar(storage,Date.parse("2026-11-13T07:30:00Z")),null);
 assert.equal(store.size,1);
 assert.ok(store.has(NASA_CACHE_KEY));
});
test("NASA photo library fetch parses NASA credits, does not expose unsafe thumbnail links",async()=>{
 const api=(async()=>({ok:true,json:async()=>({collection:{items:[
  {data:[{nasa_id:"NASA_001",title:"Lunar Rover",date_created:"1972-01-01",center:"JSC"}],
   links:[{href:"https://images-assets.nasa.gov/image/NASA_001/thumb.jpg"}]},
  {data:[{nasa_id:"WRONG"}],links:[{href:"https://fake-site.example/no.jpg"}]}
 ]}})})) as unknown as typeof fetch;
 const pics=await getNasaImages("Apollo lunar rover",{fetchImpl:api});
 assert.equal(pics.length,1);
 assert.equal(pics[0].center,"JSC");
 assert.match(pics[0].page,/nasa.gov/);
});
test("NASA screen available from map-adjacent HUD and mission screen, pauses daily clock",()=>{
 const ui=readFileSync("src/outpost/Junior3D.tsx","utf8");
 const science=readFileSync("src/outpost/nasa/NasaScience.tsx","utf8");
 const css=readFileSync("src/outpost/nasa/nasaScience.css","utf8");
 assert.match(ui,/setPanel\("nasa"\)/);
 assert.match(ui,/panel==="nasa"&&<NasaScience/);
 assert.match(ui,/panel==="board"\|\|panel==="nasa"/);
 assert.match(science,/getNasaSolarEvents/);
 assert.match(science,/getNasaImages/);
 assert.match(science,/NASA_SCIENCE_DISCLAIMER/);
 assert.match(css,/touch-action:pan-y/);
 assert.equal(DAY_TIME_LIMIT_MS,240000);
 assert.equal(dayTimerRuns("active","nasa",true),false);
 assert.equal(dayTimerRuns("active",null,true),true);
});
