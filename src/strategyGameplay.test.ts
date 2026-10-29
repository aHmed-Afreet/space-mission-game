import {test} from 'node:test';
import assert from 'node:assert/strict';
import {addDelta,errors,events,outcome,report,resources,zero,type Design,type Delta,type MissionEvent} from './game';
import {readStrategyProgress,recordStrategyScore,saveStrategyProgress,STRATEGY_SAVE_KEY,strategyBudget,strategyChallenges,strategyDebrief,strategyGoalMet,strategyIssues,strategyStarter,strategyStorage,strategyUnlocked,type StrategyChallenge} from './strategyChallenges';

const decks=events.flatMap(a=>events.filter(b=>a!==b).flatMap(b=>events.filter(c=>c!==a&&c!==b).map(c=>[a,b,c])));

function completedFlights(design:Design,deck:MissionEvent[],index=0,delta:Delta=zero):Delta[]{
 if(index===deck.length)return [delta];
 const current=resources(design,delta),event=deck[index];
 return event.choices.flatMap(choice=>{
  if(choice.need&&current[choice.need]<(choice.amount||0))return [];
  return completedFlights(design,deck,index+1,addDelta(delta,outcome(choice,event,design)));
 });
}
function winningFlights(design:Design,challenge:StrategyChallenge,deck:MissionEvent[]):Delta[]{
 return completedFlights(design,deck).filter(delta=>strategyGoalMet(design,challenge,delta,report(design,delta).score));
}
function canWinWithoutKnowingFuture(design:Design,challenge:StrategyChallenge,delta:Delta=zero,seen:string[]=[],remaining=3):boolean{
 if(remaining===0)return strategyGoalMet(design,challenge,delta,report(design,delta).score);
 const current=resources(design,delta);
 return events.filter(event=>!seen.includes(event.id)).every(event=>event.choices.some(choice=>{
  if(choice.need&&current[choice.need]<(choice.amount||0))return false;
  return canWinWithoutKnowingFuture(design,challenge,addDelta(delta,outcome(choice,event,design)),[...seen,event.id],remaining-1);
 }));
}

// One independently checked loadout per level. Counts follow the builder's
// component order; all 24 ordered three-event decks and every enabled choice
// path are evaluated below, including changing power/fuel availability.
const loadouts:[number[],number?,number?][]=[
 [[0,1,0,1,0,1,1,0]],
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
const ids=['camera','spectrometer','radar','solar','battery','tank','antenna','shield'];
const designs=loadouts.map(([counts,rocket=0,trajectory=2]):Design=>({counts:Object.fromEntries(ids.map((id,i)=>[id,counts[i]])),rocket,trajectory}));

test('all twenty Strategy levels have a legal loadout that can beat every ordered event deck',()=>{
 assert.equal(strategyChallenges.length,20);
 assert.deepEqual(strategyChallenges.map(c=>c.id),Array.from({length:20},(_,i)=>`strategy-${i+1}`));
 assert.equal(decks.length,24);
 assert.equal(new Set(decks.map(deck=>deck.map(e=>e.id).join(','))).size,24);
 for(const [i,challenge] of strategyChallenges.entries()){
  const design=designs[i];
  assert.deepEqual(errors(design,challenge.budgetCap),[],`Level ${challenge.level}: general preflight`);
  assert.deepEqual(strategyIssues(design,challenge),[],`Level ${challenge.level}: level preflight`);
  for(const deck of decks)assert.ok(winningFlights(design,challenge,deck).length,`Level ${challenge.level}: ${deck.map(e=>e.id).join(' → ')}`);
 }
});

test('the actual starter can complete Level 1 for all 24 decks, including solar plus navigation',()=>{
 assert.deepEqual(errors(strategyStarter),[]);
 assert.deepEqual(strategyIssues(strategyStarter,strategyChallenges[0]),[]);
 for(const deck of decks)assert.ok(winningFlights(strategyStarter,strategyChallenges[0],deck).length,deck.map(e=>e.id).join(','));
});

test('all twenty levels and the starter can win by responding only to the currently visible event',()=>{
 for(const [i,challenge] of strategyChallenges.entries())assert.ok(canWinWithoutKnowingFuture(designs[i],challenge),`Level ${challenge.level}: a winning policy must not require knowledge of future cards`);
 assert.ok(canWinWithoutKnowingFuture(strategyStarter,strategyChallenges[0]));
});

test('a battery preserves safe-mode observations without removing the final engineering tradeoff',()=>{
 const solar=events.find(e=>e.id==='solar')!,safe=solar.choices[0];
 const flagship=designs[19],challenge=strategyChallenges[19];
 assert.equal(challenge.minScience,80);
 assert.equal(challenge.minReliability,62);
 assert.equal(challenge.minFuel,16);
 assert.equal(challenge.minCommunication,86);
 assert.equal(challenge.budgetCap,220);
 assert.equal(outcome(safe,solar,flagship).science,-1);
 assert.equal(outcome(safe,solar,{...flagship,counts:{...flagship.counts,battery:2}}).science,-1);
 const dualArray={...flagship,counts:{...flagship.counts,battery:0,solar:2}};
 assert.equal(outcome(safe,solar,dualArray).science,-8);
 assert.deepEqual(errors(dualArray),[]);
 assert.deepEqual(strategyIssues(dualArray,challenge),[]);
 const deck=['solar','comms','power'].map(id=>events.find(e=>e.id===id)!);
 assert.equal(winningFlights(dualArray,challenge,deck).length,0);
 const wins=winningFlights(flagship,challenge,deck);
 assert.equal(wins.length,1);
 const r=resources(flagship,wins[0]);
 assert.equal(r.science,85);
 assert.equal(r.reliability,82);
 assert.equal(r.cost,217);
 assert.equal(r.power,30);
});

test('budget display, preflight and feedback use each mission allocation',()=>{
 for(const level of [4,9,13]){
  const challenge=strategyChallenges[level-1],cost=challenge.budgetCap+1;
  const budget=strategyBudget(cost,challenge.budgetCap);
  assert.equal(budget.remaining,-1);
  assert.ok(budget.exceeded);
  assert.ok(budget.percent<0);
  assert.equal(budget.allocation,`$${cost}M allocated / $${challenge.budgetCap}M`);
  assert.equal(budget.detail,`Spent $${cost}M of $${challenge.budgetCap}M. Event costs exceeded your allocation.`);
  const atCap=strategyBudget(challenge.budgetCap,challenge.budgetCap);
  assert.equal(atCap.remaining,0);
  assert.equal(atCap.exceeded,false);
  assert.match(atCap.detail,/Budget maintained/);
 }
 const economy=strategyChallenges[8];
 assert.ok(resources(designs[19]).cost<220);
 assert.ok(errors(designs[19],economy.budgetCap).some(issue=>issue.includes('$180M budget')));
});

test('a high performance score cannot announce completion when mission requirements fail',()=>{
 for(const score of [45,50,74,75,100]){
  assert.equal(strategyDebrief(false,score).headline,'Mission needs refinement.');
  assert.equal(strategyDebrief(false,score).scoreLabel,'PERFORMANCE SCORE');
 }
 assert.equal(strategyDebrief(true,50).headline,'Mission completed.');
 assert.equal(strategyDebrief(true,75).headline,'Discovery delivered.');
});

test('storage getter and read errors are safe, and failed reads cannot erase progress',()=>{
 const blocked={get localStorage():Storage{throw Error('Access denied');}};
 assert.equal(strategyStorage(blocked),undefined);
 assert.deepEqual(readStrategyProgress({getItem(){throw Error('Access denied');}}),{});
 let writes=0;
 assert.deepEqual(saveStrategyProgress({'strategy-1':70},{getItem(){throw Error('Access denied');},setItem(){writes++;}}),{saved:false});
 assert.equal(writes,0);
});

test('failed score writes report unsaved progress, then retry preserves completed levels and best scores',()=>{
 const old={'strategy-1':90,'strategy-2':84,'strategy-3':77};
 let value=JSON.stringify(old),blocked=true;
 const storage={getItem:(key:string)=>key===STRATEGY_SAVE_KEY?value:null,setItem:(key:string,next:string)=>{assert.equal(key,STRATEGY_SAVE_KEY);if(blocked)throw Error('Quota exceeded');value=next;}};
 const session=recordStrategyScore(readStrategyProgress(storage),'strategy-4',80);
 assert.deepEqual(saveStrategyProgress(session,storage),{saved:false});
 assert.equal(strategyUnlocked(4,session),true,'a failed write must retain this session’s new unlock');
 assert.deepEqual(JSON.parse(value),old,'failed writes must preserve stored completed levels');
 blocked=false;
 const saved=saveStrategyProgress({...session,'strategy-1':50},storage);
 assert.equal(saved.saved,true);
 assert.deepEqual(readStrategyProgress(storage),{...old,'strategy-4':80});
 if(saved.saved)assert.deepEqual(saved.progress,{...old,'strategy-4':80});
 assert.deepEqual(recordStrategyScore(session,'strategy-4',50),session);
});

test('all previously completed levels remain completed after saving another score',()=>{
 const old=Object.fromEntries(strategyChallenges.map(c=>[c.id,70+c.level]));
 let value=JSON.stringify(old);
 const storage={getItem:()=>value,setItem:(_key:string,next:string)=>{value=next;}};
 const saved=saveStrategyProgress(recordStrategyScore(readStrategyProgress(storage),'strategy-1',100),storage);
 assert.equal(saved.saved,true);
 const restored=readStrategyProgress(storage);
 assert.equal(Object.keys(restored).length,20);
 assert.equal(restored['strategy-20'],90);
 for(const [i] of strategyChallenges.entries())assert.equal(strategyUnlocked(i,restored),true);
});
