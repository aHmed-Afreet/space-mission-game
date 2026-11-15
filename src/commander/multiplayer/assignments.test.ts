import test from "node:test";
import assert from "node:assert/strict";
import {assignedObjectives,objectiveOwner} from "./assignments";

const crew=[
 {id:"host",role:"Commander" as const},
 {id:"second",role:"Engineer" as const},
 {id:"third",role:"Scientist" as const},
 {id:"fourth",role:"Communications" as const},
];

test("two astronauts get alternating exclusive objectives",()=>{
 assert.deepEqual(assignedObjectives(10,"host",crew.slice(0,2)),[0,2,4,6,8]);
 assert.deepEqual(assignedObjectives(10,"second",crew.slice(0,2)),[1,3,5,7,9]);
});

test("every unfinished objective has exactly one owner for 1–4 players",()=>{
 for(let size=1;size<=4;size++){
  const active=crew.slice(0,size);
  for(let objective=0;objective<24;objective++){
   const owner=objectiveOwner(objective,active);
   assert.equal(active.filter(player=>player.id===owner).length,1);
  }
 }
});

test("disconnected players lose assignments, unfinished work is reassigned",()=>{
 const active=[crew[0],crew[2]];
 assert.deepEqual(assignedObjectives(10,"third",active),[1,3,5,7,9]);
 assert.equal(assignedObjectives(10,"second",active).length,0);
});
