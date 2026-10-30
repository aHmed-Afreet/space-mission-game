/**
 * Real Chromium Strategy playthrough and isolated storage fault regressions.
 * Start the built preview, then run:
 *   BASE_URL=http://127.0.0.1:4173 node --import tsx scripts/strategy-browser-regressions.ts
 * No mission progress, event deck, RNG, timers or React state is injected.
 * Browser contexts are disposable; existing browser saves are untouched.
 */
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {addDelta,components,events,rockets,trajectories,zero,type Design,type Delta,type MissionEvent} from '../src/game';
import {STRATEGY_SAVE_KEY,strategyChallenges,strategyGoalMet,strategyStarter,type StrategyChallenge} from '../src/strategyChallenges';
import {strategyResources as resources,strategyOutcome as outcome,strategyReport as report,strategyChoiceEnabled,launchStrategyEnergy,advanceStrategyEnergy,strategyEnergyAssumptions,type StrategyEnergy} from '../src/strategyEnergy';
import {STRATEGY_ATTEMPT_KEY} from '../src/strategyAttempt';

const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'/opt/codex/runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const base=process.env.BASE_URL||'http://127.0.0.1:4173';
const artifacts=process.env.BROWSER_ARTIFACTS||join(tmpdir(),'strategy-browser-regressions');
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:process.env.HEADED!=='1',args:['--no-sandbox','--disable-dev-shm-usage']});
await mkdir(artifacts,{recursive:true});
const context=await browser.newContext({viewport:{width:1280,height:900},deviceScaleFactor:1,reducedMotion:'reduce'});
const page=await context.newPage();
page.setDefaultTimeout(15_000);
const pageErrors:string[]=[];
page.on('pageerror',(error:Error)=>pageErrors.push(error.message));
const results:{level:number;title:string;score:number;events:string[];choices:string[];saved:boolean;nextUnlocked:boolean}[]=[];

const loadouts:[number[],number?,number?][]=[
 [[1,1,0,1,1,1,1,0],0,1],
 [[1,1,0,1,0,1,1,0]],
 [[0,1,1,1,0,1,1,0]],
 [[1,1,0,0,2,1,1,0]],
 [[1,1,0,1,0,1,1,1]],
 [[1,1,0,1,0,1,2,0]],
 [[1,1,0,1,0,1,1,0]],
 [[0,1,0,0,2,2,1,0],0,0],
 [[0,1,0,1,0,1,1,0]],
 [[1,1,1,1,0,1,1,0]],
 [[0,1,0,1,0,1,2,0]],
 [[1,1,0,0,2,1,1,1]],
 [[0,1,0,0,2,1,1,0]],
 [[1,1,0,1,0,1,1,0]],
 [[0,2,0,1,0,1,1,0]],
 [[0,1,1,2,0,1,1,0]],
 [[1,1,0,0,2,1,1,1]],
 [[1,1,1,1,1,1,2,0],1],
 [[1,1,1,1,1,1,2,0],1],
 [[1,1,1,1,1,1,2,0],1],
];
const designs=loadouts.map(([counts,rocket=0,trajectory=2]):Design=>({counts:Object.fromEntries(components.map((c,i)=>[c.id,counts[i]])),rocket,trajectory}));
assert.deepEqual(designs[0],{...strategyStarter,counts:Object.fromEntries(components.map(c=>[c.id,strategyStarter.counts[c.id]||0]))});

function available(design:Design,delta:Delta,event:MissionEvent,energy:StrategyEnergy){
 return event.choices.filter(choice=>strategyChoiceEnabled(choice,design,delta,energy));
}
// This is an online policy: unknown future events are universally quantified.
// It never reads the browser's deck or predicts the next actual event.
function canWinEveryFuture(design:Design,challenge:StrategyChallenge,delta:Delta,seen:string[],remaining:number,energy=launchStrategyEnergy(design)):boolean{
 if(remaining===0)return strategyGoalMet(design,challenge,delta,report(design,delta,energy).score,energy);
 return events.filter(event=>!seen.includes(event.id)).every(event=>available(design,delta,event,energy).some(choice=>{
  const next=addDelta(delta,outcome(choice,event,design,energy));
  return canWinEveryFuture(design,challenge,next,[...seen,event.id],remaining-1,advanceStrategyEnergy(design,next,energy,strategyEnergyAssumptions.eventHours));
 }));
}

// Independent arithmetic for rendered telemetry. Do not use the implementation's
// energy integration or resource function to establish conservation here.
type ElectricalLedger={hours:number;charge:number;generated:number;demand:number;discarded:number;unmet:number};
const count=(d:Design,id:string)=>d.counts[id]||0;
function electricalRates(design:Design,delta:Delta){
 return {generation:40+85*count(design,'solar'),load:Math.max(20,20+12*count(design,'camera')+25*count(design,'spectrometer')+30*count(design,'radar')+15*count(design,'antenna')-delta.power)};
}
function integrateElectrical(design:Design,delta:Delta,previous:ElectricalLedger,hours:number):ElectricalLedger{
 const {generation,load}=electricalRates(design,delta),capacity=140*count(design,'battery'),rate=35*count(design,'battery');
 const surplus=Math.max(0,(generation-load)*hours),deficit=Math.max(0,(load-generation)*hours);
 const charge=Math.min(surplus,capacity-previous.charge,rate*hours),draw=Math.min(deficit,previous.charge,rate*hours);
 return {hours:previous.hours+hours,charge:previous.charge+charge-draw,generated:previous.generated+generation*hours,
  demand:previous.demand+load*hours,discarded:previous.discarded+surplus-charge,unmet:previous.unmet+deficit-draw};
}
async function assertElectricalUI(design:Design,delta:Delta,ledger:ElectricalLedger){
 const readings=await page.locator('.strategy-energy dl>div').evaluateAll((rows:Element[])=>Object.fromEntries(rows.map(row=>[row.querySelector('dt')?.textContent,row.querySelector('dd')?.textContent])));
 const {generation,load}=electricalRates(design,delta),net=generation-load;
 assert.deepEqual(readings,{
  'Generation / load':`${generation} W / ${load} W`,
  'Net generation':`${net>=0?'+':''}${net} W`,
  'Battery energy':`${ledger.charge.toFixed(1)} / ${140*count(design,'battery')} Wh`,
  'Operating time':`${ledger.hours.toFixed(2)} / 2 h`,
  'Integrated generation / load':`${ledger.generated.toFixed(1)} / ${ledger.demand.toFixed(1)} Wh`,
  'Discarded / unmet energy':`${ledger.discarded.toFixed(1)} / ${ledger.unmet.toFixed(1)} Wh`,
 });
 assert.ok(Math.abs(140*count(design,'battery')+ledger.generated+ledger.unmet-ledger.demand-ledger.charge-ledger.discarded)<1e-8,'independent conservation: initial storage + generation + unmet = demand + final storage + discard');
}

async function attemptSnapshot(stage:number,choices:number){
 await page.waitForFunction(({key,stage,choices}:{key:string;stage:number;choices:number})=>{try{const a=JSON.parse(localStorage.getItem(key)||'null');return a?.stage===stage&&a?.choices?.length===choices;}catch{return false;}},{key:STRATEGY_ATTEMPT_KEY,stage,choices});
 return page.evaluate((key:string)=>JSON.parse(localStorage.getItem(key)!),STRATEGY_ATTEMPT_KEY);
}
// Reading an already-earned checkpoint establishes restoration only. Its future
// deck never enters the online policy, which receives visible event IDs alone.
async function reloadAndResume(stage:number,choices:number){
 const before=await attemptSnapshot(stage,choices);
 const eventTitle=stage===5?await page.locator('.event>h2').innerText():null;
 await page.reload({waitUntil:'domcontentloaded'});await enterStrategy();
 await page.getByRole('button',{name:/^Resume saved attempt/}).click();
 if(eventTitle)await page.locator('.event>h2').filter({hasText:eventTitle}).waitFor();
 else await page.getByRole('heading',{name:'✓ All astronaut preflight checks passed',exact:true}).waitFor();
 assert.deepEqual(await attemptSnapshot(stage,choices),before,'reload restores the exact design, drawn deck, choices, resources, energy and log');
}

async function enterStrategy(target=page){
 await target.getByRole('button',{name:/Build & Launch Missions/}).click();
 await target.locator('.strategy-level').first().waitFor();
}
async function savedProgress(){return page.evaluate((key:string)=>JSON.parse(localStorage.getItem(key)||'{}'),STRATEGY_SAVE_KEY);}
async function prepare(index:number,design:Design){
 const challenge=strategyChallenges[index];
 assert.equal(await page.locator('.strategy-level').nth(index).isEnabled(),true,`Level ${challenge.level} is earned through the preceding mission`);
 await page.locator('.strategy-level').nth(index).click();
 await page.getByRole('button',{name:'Acknowledge astronaut briefing ✓',exact:true}).click();
 await page.getByRole('button',{name:'Begin spacecraft preparation →',exact:true}).click();
 for(const component of components){
  const card=page.locator('.component').filter({has:page.getByRole('heading',{name:component.name,exact:true})});
  const current=Number(await card.locator('.quantity strong').innerText());
  const wanted=design.counts[component.id]||0;
  for(let n=current;n<wanted;n++)await card.getByRole('button',{name:`Add ${component.name}`,exact:true}).click();
  for(let n=current;n>wanted;n--)await card.getByRole('button',{name:`Remove ${component.name}`,exact:true}).click();
  assert.equal(Number(await card.locator('.quantity strong').innerText()),wanted);
 }
 await page.getByRole('button',{name:'Select launch vehicle →',exact:true}).click();
 await page.locator('.selection').filter({has:page.getByRole('heading',{name:rockets[design.rocket].name,exact:true})}).click();
 await page.getByRole('button',{name:'Plan trajectory →',exact:true}).click();
 await page.locator('.route-card').filter({has:page.getByRole('heading',{name:trajectories[design.trajectory].name,exact:true})}).click();
 const r=resources(design);
 const budget=page.locator('.resource').filter({has:page.locator('label').filter({hasText:/^Budget$/})});
 assert.equal(await budget.locator('strong').innerText(),`$${challenge.budgetCap-r.cost}M`);
 assert.equal(await budget.locator('small').innerText(),`$${r.cost}M allocated / $${challenge.budgetCap}M`);
 const evidence=page.locator('.mission-science-metrics>div').filter({hasText:'Budget headroom'});
 assert.equal(await evidence.locator('strong').innerText(),`${challenge.budgetCap-r.cost} M credits`);
 return challenge;
}
async function injectWriteFailure(){
 await page.evaluate((saveKey:string)=>{
  const original=Storage.prototype.setItem;
  (window as any).__restoreStrategyWrites=()=>{Storage.prototype.setItem=original;};
  Storage.prototype.setItem=function(key:string,value:string){
   if(key===saveKey)throw new DOMException('Regression quota fixture','QuotaExceededError');
   return original.call(this,key,value);
  };
 },STRATEGY_SAVE_KEY);
}
async function fly(index:number,design:Design,{failSave=false,deliberateFailure=false}={}){
 const challenge=await prepare(index,design);
 let ledger:ElectricalLedger={hours:0,charge:140*count(design,'battery'),generated:0,demand:0,discarded:0,unmet:0};
 await assertElectricalUI(design,zero,ledger);
 if(index===0&&!deliberateFailure)await reloadAndResume(3,0);
 await page.getByRole('heading',{name:'✓ All astronaut preflight checks passed',exact:true}).waitFor();
 const launch=page.getByRole('button',{name:`AUTHORIZE PILOT LAUNCH · LEVEL ${challenge.level} ↗`,exact:true});
 assert.equal(await launch.isEnabled(),true);
 await launch.click();
 const seen:string[]=[],choices:string[]=[];
 let delta={...zero},energy=launchStrategyEnergy(design);
 ledger=integrateElectrical(design,delta,ledger,1);
 await assertElectricalUI(design,delta,ledger);
 for(let n=0;n<3;n++){
  await page.locator('.event').waitFor({state:'visible'});
  const title=await page.locator('.event>h2').innerText();
  const event=events.find(event=>event.title===title);
  assert.ok(event,`Recognize the currently visible event: ${title}`);
  assert.equal(seen.includes(event.id),false,'Mission events do not repeat');
  seen.push(event.id);
  const enabled=available(design,delta,event,energy);
  const choice=deliberateFailure?enabled.at(-1):enabled.find(choice=>{
   const next=addDelta(delta,outcome(choice,event,design,energy));
   return canWinEveryFuture(design,challenge,next,seen,2-n,advanceStrategyEnergy(design,next,energy,strategyEnergyAssumptions.eventHours));
  });
  assert.ok(choice,`Level ${challenge.level}: an online winning decision exists for the visible ${event.id} event`);
  const button=page.locator('.event-choice').filter({has:page.getByRole('heading',{name:choice.name,exact:true})});
  assert.equal(await button.isEnabled(),true);
  if(failSave&&n===2)await injectWriteFailure();
  choices.push(choice.name);
  delta=addDelta(delta,outcome(choice,event,design,energy));
  energy=advanceStrategyEnergy(design,delta,energy,strategyEnergyAssumptions.eventHours);
  ledger=integrateElectrical(design,delta,ledger,1/3);
  await button.click();
  if(n<2)await page.waitForFunction((previous:string)=>document.querySelector('.event>h2')?.textContent!==previous,title);
  else await page.locator('.report-hero').waitFor();
  await assertElectricalUI(design,delta,ledger);
  if(index===0&&n===0&&!deliberateFailure){await reloadAndResume(5,1);await assertElectricalUI(design,delta,ledger);}
 }
 await page.locator('.report-hero').waitFor();
 const modeled=report(design,delta,energy),score=Number((await page.locator('.score>strong').innerText()).replace('%',''));
 assert.equal(score,modeled.score,'Rendered score matches decisions actually submitted');
 assert.equal(await page.locator('.score>span').innerText(),'PERFORMANCE SCORE');
 const budgetMetric=page.locator('.report-metric').filter({hasText:'Budget management'});
 assert.match(await budgetMetric.locator('p').innerText(),new RegExp(`Spent \\$${modeled.r.cost}M of \\$${challenge.budgetCap}M`));
 assert.equal(await page.locator('.log p').count(),3,'All three visible decisions appear in the report');
 if(deliberateFailure){
  assert.equal(strategyGoalMet(design,challenge,delta,score,energy),false);
  assert.ok(score>=50,'This specifically covers a high-score failed mission');
  assert.equal(await page.locator('.strategy-result>strong').innerText(),'MISSION REQUIREMENTS NOT MET');
  assert.equal(await page.locator('.report-hero h2').innerText(),'Mission needs refinement.');
  await page.screenshot({path:join(artifacts,'high-score-failed-debrief.png')});
  return {score,events:seen,choices};
 }
 assert.equal(await page.locator('.strategy-result>strong').innerText(),'✓ MISSION OBJECTIVES MET');
 if(failSave){
  await page.getByRole('alert').filter({hasText:'Progress has not been saved.'}).waitFor();
  const old=await savedProgress();
  assert.equal(old['strategy-1'],results[0].score,'Earlier completion survives failed writes');
  assert.equal(old[challenge.id],undefined,'The failed compatibility-summary write does not claim a committed summary; immutable receipts remain available to retry');
  await page.screenshot({path:join(artifacts,'storage-write-failure.png')});
  await page.evaluate(()=>(window as any).__restoreStrategyWrites());
  await page.getByRole('button',{name:'Retry save',exact:true}).click();
 }
 await page.getByRole('status').filter({hasText:'Progress saved in this browser.'}).waitFor();
 const saved=await savedProgress();
 assert.equal(saved[challenge.id],score);
 await page.getByRole('button',{name:'Return to level board ↻',exact:true}).click();
 assert.match(await page.locator('.strategy-level').nth(index).innerText(),new RegExp(`BEST ${score}%`));
 const nextUnlocked=index===19||await page.locator('.strategy-level').nth(index+1).isEnabled();
 assert.equal(nextUnlocked,true);
 return {score,events:seen,choices,saved:true,nextUnlocked};
}

try{
 for(const [i,design] of designs.entries())assert.ok(canWinEveryFuture(design,strategyChallenges[i],zero,[],3),`Level ${i+1} has an online policy for every possible unseen deck`);
 await page.goto(base,{waitUntil:'domcontentloaded'});
 await enterStrategy();
 assert.equal(Object.keys(await savedProgress()).length,0,'The campaign begins with a fresh browser profile');
 assert.equal(await page.locator('.strategy-level:disabled').count(),19);
 for(let i=0;i<20;i++){
  const completed=await fly(i,designs[i],{failSave:i===1});
  assert.ok('saved' in completed);
  results.push({level:i+1,title:strategyChallenges[i].title,...completed} as typeof results[number]);
  console.log('STRATEGY_COMPLETED '+JSON.stringify(results.at(-1)));
 }
 const earned=await savedProgress();
 assert.equal(Object.keys(earned).length,20);
 await page.reload({waitUntil:'domcontentloaded'});
 await enterStrategy();
 assert.match(await page.locator('.strategy-mission-board>header').innerText(),/20 \/ 20 LEVELS COMPLETE/);
 assert.equal(await page.locator('.strategy-level:disabled').count(),0);
 for(const [i,result] of results.entries())assert.match(await page.locator('.strategy-level').nth(i).innerText(),new RegExp(`BEST ${result.score}%`));
 await page.screenshot({path:join(artifacts,'all-20-earned-after-reload.png'),fullPage:true});
 console.log('PASS all20 earned scores and unlocks survive reload');

 // Real controls select a legal physical design that exceeds only the economy
 // mission's money allocation. Its global $220M allowance must not leak in.
 await prepare(8,designs[19]);
 const launch=page.getByRole('button',{name:'AUTHORIZE PILOT LAUNCH · LEVEL 9 ↗',exact:true});
 assert.equal(await launch.isDisabled(),true);
 assert.match(await page.locator('.preflight').innerText(),/\$180M/);
 assert.equal(await page.locator('.resource.warning').filter({hasText:'Budget'}).count(),1);
 await page.screenshot({path:join(artifacts,'economy-actual-budget-warning.png')});
 await page.reload({waitUntil:'domcontentloaded'});await enterStrategy();
 console.log('PASS $180M allocation controls resource warning, decision-lab headroom and preflight');

 const failed=await fly(19,designs[19],{deliberateFailure:true});
 assert.deepEqual(await savedProgress(),earned,'A failed replay cannot replace or reset any earned score');
 console.log('PASS high-score failed debrief '+JSON.stringify(failed));

 // This separate context changes storage availability only and supplies no save.
 const blockedContext=await browser.newContext({viewport:{width:1024,height:768}});
 await blockedContext.addInitScript(()=>Object.defineProperty(window,'localStorage',{configurable:true,get(){throw new DOMException('Regression denied fixture','SecurityError');}}));
 const blocked=await blockedContext.newPage();
 blocked.on('pageerror',(error:Error)=>pageErrors.push(`getter fixture: ${error.message}`));
 await blocked.goto(base,{waitUntil:'domcontentloaded'});await enterStrategy(blocked);
 assert.equal(await blocked.locator('.strategy-level:disabled').count(),19);
 await blocked.locator('.strategy-level').first().click();
 await blocked.getByRole('button',{name:'Acknowledge astronaut briefing ✓',exact:true}).waitFor();
 await blockedContext.close();
 console.log('PASS denied localStorage getter still opens a fresh Strategy campaign');

 assert.deepEqual(pageErrors,[]);
 const summary={completed:results.length,decisions:results.length*3,scores:results.map(r=>r.score),modelVersion:2,independentElectricalUIVerified:true,planningAndDecisionResumeVerified:true,reloadVerified:true,writeFailureRetryVerified:true,actualBudgetVerified:true,highScoreFailureVerified:true,storageGetterVerified:true,pageErrors,results};
 await writeFile(join(artifacts,'results.json'),JSON.stringify(summary,null,2));
 console.log('STRATEGY_BROWSER_SUMMARY '+JSON.stringify(summary));
}catch(error){
 console.error('STRATEGY_BROWSER_FAILED',error,await page.locator('body').innerText());
 await page.screenshot({path:join(artifacts,'failure.png'),fullPage:true}).catch(()=>{});
 await writeFile(join(artifacts,'partial-results.json'),JSON.stringify({results,pageErrors},null,2));
 process.exitCode=1;
}finally{await browser.close();}
