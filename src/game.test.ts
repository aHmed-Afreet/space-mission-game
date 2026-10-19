import { strategyChallenges, strategyIssues, strategyUnlocked, readStrategyProgress } from "./strategyChallenges";
import { historyMissions } from "./history/missionHistory";
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {resources,errors,report,events,outcome,zero,addDelta,type Design} from './game';
const starter:Design={counts:{spectrometer:1,solar:1,battery:1,tank:1,antenna:1},rocket:0,trajectory:1};
test('starter is launchable and resources reflect all components',()=>{assert.deepEqual(errors(starter),[]);assert.equal(resources(starter).mass,695);assert.equal(resources(starter).fuel,15);assert.equal(resources(starter).power,100);});
test('instruments increase mass, cost, power demand and science',()=>{const a=resources(starter);const b=resources({...starter,counts:{...starter.counts,radar:1}});assert.equal(b.mass-a.mass,95);assert.equal(b.cost-a.cost,22);assert.equal(b.power-a.power,-30);assert.equal(b.science-a.science,28);});
test('payload, missing equipment, fuel and budget block launch',()=>{assert.ok(errors({...starter,counts:{...starter.counts,shield:2,radar:2,tank:2}}).some(s=>s.includes('payload')));assert.ok(errors({...starter,counts:{}}).some(s=>s.includes('spectrometer')));assert.ok(errors({...starter,trajectory:0}).some(s=>s.includes('fuel')));assert.ok(errors({...starter,rocket:2,counts:{...starter.counts,radar:2,shield:2}}).some(s=>s.includes('budget')));});
test('shield and battery mitigate event losses',()=>{assert.equal(outcome(events[0].choices[1],events[0],{...starter,counts:{...starter.counts,shield:1}}).reliability,-8);assert.equal(outcome(events[2].choices[1],events[2],starter).power,-5);});
test('event impacts accumulate and scoring stays bounded',()=>{const delta=addDelta(zero,events[3].choices[0].delta);assert.equal(resources(starter,delta).fuel,3);const r=report(starter,delta);for(const key of ['score','science','budget','reliability','fuel','communication'] as const)assert.ok(r[key]>=0&&r[key]<=100);});

test("historical archive covers 55 uniquely identified real milestones",()=>{
  assert.equal(historyMissions.length,55);
  assert.equal(new Set(historyMissions.map(x=>x.id)).size,historyMissions.length);
  assert.ok(historyMissions.some(x=>x.title==="Sputnik 1"));
  assert.ok(historyMissions.some(x=>x.title==="Apollo 11"));
  assert.ok(historyMissions.some(x=>x.title==="Chandrayaan-3"));
  assert.ok(historyMissions.some(x=>x.title==="Artemis I"));
  for(const m of historyMissions){
    assert.ok(m.background&&m.mission&&m.outcome&&m.challenge);
    assert.match(m.source,/^https:\/\//);
  }
});
test("Strategy campaign has twenty sequential playable engineering challenges",()=>{
  assert.equal(strategyChallenges.length,20);
  assert.equal(new Set(strategyChallenges.map(x=>x.id)).size,20);
  const empty=readStrategyProgress({getItem:()=>null});
  assert.deepEqual(empty,{});
  assert.ok(strategyUnlocked(0,empty));
  assert.ok(!strategyUnlocked(1,empty));
  assert.ok(strategyUnlocked(1,{[strategyChallenges[0].id]:65}));
  assert.equal(strategyChallenges[19].level,20);
  assert.ok(strategyIssues(starter,strategyChallenges[1]).some(x=>x.includes("camera")));
});
