import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {advanceSol,initialOutpost,perform,projectPower} from "./outpost/engine";
import {CHALLENGE_CHOICES,missionEngineeringLesson,projectEngineeringChoice} from "./outpost/nasa/challengeTradeoffs";
import {NASA_RESOURCES} from "./outpost/nasa/nasaResources";

test("2026 challenge-aligned NASA systems cover life support, radiation, power and crops",()=>{
 assert.equal(NASA_RESOURCES.challengeResources,
  "https://www.spaceappschallenge.org/2026/challenges/junior-astronaut-mission-trainer/?tab=resources");
 assert.match(NASA_RESOURCES.lifeSupport,/ntrs\.nasa\.gov/);
 assert.match(NASA_RESOURCES.donkiDocs,/nasa\.gov/);
 assert.match(NASA_RESOURCES.cropResearch,/www\.nasa\.gov/);
 assert.match(NASA_RESOURCES.lunarSurfacePower,/www\.nasa\.gov/);
 for(const choice of CHALLENGE_CHOICES)assert.ok(missionEngineeringLesson(choice).length>50);
});

test("the scenario planner uses actual game calculations and never changes progress or credits",()=>{
 const initial=initialOutpost("moon"),saved=structuredClone(initial);
 const predicted=projectEngineeringChoice(initial,"solar");
 const planned=perform(initial,"solar");
 assert.equal(predicted.available,true);
 assert.equal(predicted.creditsCost,20);
 assert.equal(predicted.after.solar,planned.solar);
 assert.equal(predicted.before.solar,initial.solar);
 assert.equal(predicted.plannedPower.generation,projectPower(planned).generation);
 assert.deepEqual(predicted.nextSol&&predicted.nextSol.battery,advanceSol(planned).battery);
 assert.deepEqual(initial,saved);
 assert.equal(initial.selected,null);
 assert.equal(initial.credits,105);
});

test("recycling consumes power while improving the simulated air/water recovery",()=>{
 const initial=initialOutpost("mars");
 const baseline=advanceSol(perform(initial,"monitor"));
 const improved=projectEngineeringChoice(initial,"recycler");
 assert.equal(improved.available,true);
 assert.equal(improved.after.recycling,initial.recycling+1);
 assert.ok(improved.plannedPower.demand>improved.currentPower.demand);
 assert.ok(improved.nextSol!==null);
 assert.ok(improved.nextSol!.oxygen>=baseline.oxygen);
 assert.ok(improved.nextSol!.water>=baseline.water);
});

test("solar panel upgrades cannot manufacture energy in simulated lunar night",()=>{
 const initial={...initialOutpost("moon"),sol:5};
 const result=projectEngineeringChoice(initial,"solar");
 assert.equal(result.available,true);
 assert.equal(result.currentPower.generation,0);
 assert.equal(result.plannedPower.generation,0);
 assert.equal(result.awaitingEmergency,true);
 assert.equal(result.nextSol,null);
});

test("unresolved emergency or unavailable action yields no fabricated next-day outcome",()=>{
 const radiation={...initialOutpost("moon"),sol:3};
 assert.equal(projectEngineeringChoice(radiation,"shield").awaitingEmergency,true);
 assert.equal(projectEngineeringChoice(radiation,"shield").nextSol,null);
 const tooYoung=projectEngineeringChoice(initialOutpost("moon"),"harvest");
 assert.equal(tooYoung.available,false);
 assert.match(tooYoung.reason,/crop/i);
 assert.equal(tooYoung.nextSol,null);
 const alreadySelected=perform(initialOutpost("moon"),"monitor");
 assert.equal(projectEngineeringChoice(alreadySelected,"solar").available,false);
 assert.equal(projectEngineeringChoice(alreadySelected,"solar").after.solar,alreadySelected.solar);
});

test("NASA lab has real resource-based decision UI, challenge link, iPad scroll and no save actions",()=>{
 const parent=readFileSync("src/outpost/Junior3D.tsx","utf8");
 const panel=readFileSync("src/outpost/nasa/NasaScience.tsx","utf8");
 const simulator=readFileSync("src/outpost/nasa/ChallengeSystems.tsx","utf8");
 const styles=readFileSync("src/outpost/nasa/nasaScience.css","utf8");
 assert.match(parent,/NasaScience session=\{session\}/);
 assert.match(panel,/tab==="systems"&&<ChallengeSystems session=\{session\}/);
 assert.match(simulator,/projectEngineeringChoice\(session,choice\)/);
 assert.match(simulator,/NASA_RESOURCES\.challengeResources/);
 assert.match(simulator,/NASA_RESOURCES\.cropResearch/);
 assert.match(simulator,/NASA_RESOURCES\.lunarSurfacePower/);
 assert.match(simulator,/not claimed to be on that tab/);
 assert.match(styles,/\.j3-challenge-options button/);
 assert.match(styles,/touch-action:manipulation/);
 assert.doesNotMatch(simulator,/setSession\(|localStorage\.|perform\(|advanceSol\(/);
});
