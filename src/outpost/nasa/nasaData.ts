import {NASA_RESOURCES} from "./nasaResources";

export type NasaSolarEvent={
 id:string;
 kind:"Solar energetic particle event"|"Solar flare";
 eventDate:string;
 classType:string;
 sourceUrl:string;
};
export type NasaSolarResult={
 status:"nasa"|"unavailable";
 fetchedAt:string;
 from:string;
 through:string;
 events:NasaSolarEvent[];
 message:string;
};
export type NasaPhoto={id:string;title:string;date:string;center:string;thumbnail:string;page:string};
export const NASA_CACHE_KEY="orbital-nasa-donki-v1",NASA_CACHE_TTL_MS=60*60*1000;
const record=(v:unknown):v is Record<string,unknown>=>v!==null&&typeof v==="object"&&!Array.isArray(v);
const str=(v:unknown):string=>typeof v==="string"?v:"";
const nasaLink=(value:unknown):string=>{
 const text=str(value);
 try{const u=new URL(text);return u.protocol==="https:"&&(u.hostname==="nasa.gov"||u.hostname.endsWith(".nasa.gov"))?text:"";}
 catch{return "";}
};
const iso=(value:unknown):string=>{
 const text=str(value);return text&&Number.isFinite(Date.parse(text))?text:"";
};
export function nasaWindow(now=new Date()):{startDate:string;endDate:string}{
 if(!Number.isFinite(now.getTime()))throw Error("Invalid date");
 const start=new Date(now);start.setUTCDate(start.getUTCDate()-29);
 return {startDate:start.toISOString().slice(0,10),endDate:now.toISOString().slice(0,10)};
}
export function donkiUrl(kind:"SEP"|"FLR",startDate:string,endDate:string):string{
 if(!/^\d{4}-\d{2}-\d{2}$/.test(startDate)||!/^\d{4}-\d{2}-\d{2}$/.test(endDate))throw Error("Invalid date");
 return NASA_RESOURCES.donkiApi+kind+"?"+new URLSearchParams({startDate,endDate});
}
export function parseDonki(payload:unknown,kind:"SEP"|"FLR"):NasaSolarEvent[]{
 if(!Array.isArray(payload))return [];
 return payload.filter(record).slice(0,80).flatMap((v,index)=>{
  const eventDate=iso(kind==="SEP"?v.eventTime:v.beginTime);
  if(!eventDate)return [];
  const id=str(kind==="SEP"?v.sepID:v.flrID)||kind+"-"+eventDate+"-"+index;
  return [{id,kind:kind==="SEP"?"Solar energetic particle event":"Solar flare",
   eventDate,classType:kind==="FLR"?str(v.classType):"",
   sourceUrl:nasaLink(v.link)||NASA_RESOURCES.donkiDocs}];
 });
}
/** Live NASA records are educational context only, not a radiation dose prediction.
 * If no API can be reached, do not fabricate events or mutate game state. */
export async function getNasaSolarEvents(options:{
 now?:Date;signal?:AbortSignal;fetchImpl?:typeof fetch;
}={}):Promise<NasaSolarResult>{
 const now=options.now??new Date(),window=nasaWindow(now);
 const kinds=["SEP","FLR"] as const,request=options.fetchImpl??fetch;
 const outcomes=await Promise.allSettled(kinds.map(async kind=>{
  const response=await request(donkiUrl(kind,window.startDate,window.endDate),{
   signal:options.signal,headers:{Accept:"application/json"}});
  if(!response.ok)throw Error("NASA DONKI HTTP "+response.status);
  return parseDonki(await response.json(),kind);
 }));
 const available=outcomes.some(v=>v.status==="fulfilled");
 return {status:available?"nasa":"unavailable",fetchedAt:now.toISOString(),
  from:window.startDate,through:window.endDate,
  events:outcomes.flatMap(v=>v.status==="fulfilled"?v.value:[])
   .sort((a,b)=>Date.parse(b.eventDate)-Date.parse(a.eventDate)),
  message:available
   ?"NASA CCMC space-weather observations. These are not radiation-dose measurements at your Moon or Mars Outpost."
   :"NASA space-weather services are unavailable. The game continues with simulated conditions."};
}
export function getCachedSolar(storage:Pick<Storage,"getItem">,now=Date.now()):NasaSolarResult|null{
 try{
  const raw=storage.getItem(NASA_CACHE_KEY);if(!raw)return null;
  const p:unknown=JSON.parse(raw);
  if(!record(p)||p.status!=="nasa"||!Array.isArray(p.events)||typeof p.fetchedAt!=="string")return null;
  const age=now-Date.parse(p.fetchedAt);
  return Number.isFinite(age)&&age>=0&&age<=NASA_CACHE_TTL_MS?p as NasaSolarResult:null;
 }catch{return null;}
}
export function setCachedSolar(storage:Pick<Storage,"setItem">,s:NasaSolarResult):void{
 if(s.status!=="nasa")return;
 try{storage.setItem(NASA_CACHE_KEY,JSON.stringify(s));}catch{/* Browsers can block storage. */}
}
export function solarScienceQuestion(events:readonly NasaSolarEvent[]):string{
 const event=events.find(e=>e.kind==="Solar energetic particle event");
 return event?
  "NASA logged a solar energetic particle event on "+event.eventDate.slice(0,10)+
  ". Training question: which shelter protects the crew during a simulated radiation alert?":
  "Training question: how can an astronaut prepare for a simulated radiation alert if no recent NASA SEP event is shown?";
}
/** NASA Image and Video Library is distinct from stock renders in the game. */
export async function getNasaImages(query:string,options:{
 fetchImpl?:typeof fetch;signal?:AbortSignal;
}={}):Promise<NasaPhoto[]>{
 const q=query.trim().slice(0,90);
 if(q.length<2)return [];
 const url=NASA_RESOURCES.nasaImagesApi+"?"+new URLSearchParams({q,media_type:"image"});
 const response=await (options.fetchImpl??fetch)(url,{signal:options.signal,headers:{Accept:"application/json"}});
 if(!response.ok)throw Error("NASA Images HTTP "+response.status);
 const json:unknown=await response.json();
 if(!record(json)||!record(json.collection)||!Array.isArray(json.collection.items))return [];
 const photos:NasaPhoto[]=[];
 for(const item of json.collection.items.slice(0,16)){
  if(!record(item)||!Array.isArray(item.data)||!record(item.data[0])||
   !Array.isArray(item.links)||!record(item.links[0]))continue;
  const info=item.data[0],id=str(info.nasa_id),thumbnail=nasaLink(item.links[0].href);
  if(!id||!thumbnail)continue;
  photos.push({id,title:str(info.title)||id,date:iso(info.date_created),
   center:str(info.center),thumbnail,
   page:"https://images.nasa.gov/search-results?q="+encodeURIComponent(id)});
 }
 return photos;
}
