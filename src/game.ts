export const BUDGET = 220;
export type Component = {id:string;name:string;icon:string;description:string;cost:number;mass:number;power:number;fuel:number;science:number;reliability:number;communication:number};
export const components:Component[] = [
{id:'camera',name:'Terrain camera',icon:'◉',description:'Maps the surface and identifies promising landing sites.',cost:12,mass:45,power:-12,fuel:0,science:18,reliability:0,communication:0},
{id:'spectrometer',name:'Water spectrometer',icon:'⌁',description:'Detects water signatures. Essential for this mission.',cost:24,mass:85,power:-25,fuel:0,science:35,reliability:0,communication:0},
{id:'radar',name:'Subsurface radar',icon:'◎',description:'Searches for buried ice beneath the Martian surface.',cost:22,mass:95,power:-30,fuel:0,science:28,reliability:0,communication:0},
{id:'solar',name:'Solar array',icon:'☼',description:'Produces 85 W, with reduced output during solar events.',cost:14,mass:65,power:85,fuel:0,science:0,reliability:2,communication:0},
{id:'battery',name:'Battery pack',icon:'▥',description:'Adds 35 W reserve and protects against power outages.',cost:10,mass:55,power:35,fuel:0,science:0,reliability:6,communication:0},
{id:'tank',name:'Fuel tank',icon:'◇',description:'Adds 45 fuel units for transfer and course corrections.',cost:12,mass:100,power:0,fuel:45,science:0,reliability:0,communication:0},
{id:'antenna',name:'Deep-space antenna',icon:'◈',description:'Strengthens communication and delivery of science data.',cost:15,mass:40,power:-15,fuel:0,science:0,reliability:2,communication:22},
{id:'shield',name:'Radiation shield',icon:'⬡',description:'Protects electronics from solar activity.',cost:14,mass:90,power:0,fuel:0,science:0,reliability:10,communication:0}
];
export const rockets = [{name:'Kestrel Light',tag:'ECONOMY',cost:30,payload:850,reliability:0,description:'A lean launcher for compact explorers.'},{name:'Atlas Vector',tag:'VERSATILE',cost:48,payload:1250,reliability:4,description:'Extra capacity and a dependable ascent.'},{name:'Titan Horizon',tag:'HEAVY LIFT',cost:70,payload:1800,reliability:8,description:'Maximum payload capacity and launch reliability.'}];
export const trajectories = [{name:'Fast transfer',days:150,fuel:85,cost:18,risk:14,description:'Reach Mars quickly. High fuel demand and greater risk.'},{name:'Balanced transfer',days:240,fuel:60,cost:10,risk:6,description:'A practical compromise between time and fuel.'},{name:'Fuel-saving transfer',days:330,fuel:40,cost:6,risk:10,description:'Conserve propellant. Longer exposure increases risk.'}];
export type Design = {counts:Record<string,number>;rocket:number;trajectory:number};
export type Delta = {cost:number;fuel:number;power:number;science:number;reliability:number;communication:number};
export const zero:Delta={cost:0,fuel:0,power:0,science:0,reliability:0,communication:0};
export const clamp=(n:number)=>Math.max(0,Math.min(100,n));
export function resources(d:Design,delta:Delta=zero){
 let r={cost:35,mass:350,power:20,fuel:30,science:0,reliability:68,communication:45};
 for(const c of components){const n=d.counts[c.id]||0;for(const key of Object.keys(r) as (keyof typeof r)[])r[key]+=c[key]*n;}
 r.cost+=rockets[d.rocket].cost+trajectories[d.trajectory].cost+delta.cost;
 r.fuel-=trajectories[d.trajectory].fuel+delta.fuel;
 r.power+=delta.power;r.science+=delta.science;r.reliability+=rockets[d.rocket].reliability-trajectories[d.trajectory].risk+delta.reliability;r.communication+=delta.communication;
 return {...r,risk:100-clamp(r.reliability)};
}
export function errors(d:Design){const r=resources(d);return [r.cost>BUDGET?'Total cost exceeds the $220M budget.':'',r.mass>rockets[d.rocket].payload?'Spacecraft exceeds the selected rocket’s payload limit.':'',r.power<10?'At least 10 W spare power is required.':'',r.fuel<10?'At least 10 fuel units must remain after transfer.':'',!d.counts.spectrometer?'Add a water spectrometer to search for water.':'',!d.counts.antenna?'Add a deep-space antenna to send results home.':''].filter(Boolean);}
export type Choice={name:string;description:string;delta:Delta;need?:'fuel'|'power';amount?:number};
export type MissionEvent={id:string;title:string;description:string;choices:Choice[]};
const change=(d:Partial<Delta>):Delta=>({...zero,...d});
export const events:MissionEvent[]=[
{id:'solar',title:'Solar activity detected',description:'A burst of charged particles is approaching your spacecraft. Protect the electronics or continue collecting data.',choices:[{name:'Enter safe mode',description:'Science −8 • reliability +8',delta:change({science:-8,reliability:8})},{name:'Keep instruments active',description:'Science +8 • reliability −16 (shield halves damage)',delta:change({science:8,reliability:-16})}]},
{id:'comms',title:'Signal fading',description:'The link to mission control is weakening. A focused diagnostic can restore transmission.',choices:[{name:'Boost and diagnose',description:'Power −8 W • communication +18 • cost +$4M',delta:change({power:-8,communication:18,cost:4}),need:'power',amount:18},{name:'Use the backup channel',description:'Communication −10 • science −5',delta:change({communication:-10,science:-5})}]},
{id:'power',title:'Power reserve dropping',description:'Solar output is lower than expected. Choose how to preserve your mission.',choices:[{name:'Pause science operations',description:'Science −10 • power +12 W • reliability +4',delta:change({science:-10,power:12,reliability:4})},{name:'Draw on reserves',description:'Power −15 W (battery reduces loss) • science +5',delta:change({power:-15,science:5}),need:'power',amount:25}]},
{id:'navigation',title:'Course correction required',description:'Tracking shows a small drift from the arrival corridor. A correction improves the Mars approach.',choices:[{name:'Fire correction thrusters',description:'Fuel −12 • reliability +10',delta:change({fuel:12,reliability:10}),need:'fuel',amount:12},{name:'Accept a wider approach',description:'Reliability −12 • science −6',delta:change({reliability:-12,science:-6})}]}
];
export function eventDeck(random=Math.random){const deck=[...events];for(let i=deck.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[deck[i],deck[j]]=[deck[j],deck[i]];}return deck.slice(0,3);}
export function outcome(choice:Choice,event:MissionEvent,d:Design){const delta={...choice.delta};if(event.id==='solar'&&d.counts.shield&&delta.reliability<0)delta.reliability/=2;if(event.id==='power'&&d.counts.battery&&delta.power<0)delta.power=-5;return delta;}
export function addDelta(a:Delta,b:Delta):Delta{return Object.fromEntries(Object.keys(a).map(k=>[k,a[k as keyof Delta]+b[k as keyof Delta]])) as Delta;}
export function report(d:Design,delta:Delta){const r=resources(d,delta);const science=clamp(r.science);const budget=clamp(100-Math.max(0,r.cost-160)*1.4);const reliability=clamp(r.reliability-(r.power<0?25:0)-(r.fuel<0?25:0));const fuel=clamp(60+r.fuel*.8);const communication=clamp(r.communication);const score=Math.round(science*.3+budget*.15+reliability*.3+fuel*.1+communication*.15);return {score,science,budget,reliability,fuel,communication,r};}
