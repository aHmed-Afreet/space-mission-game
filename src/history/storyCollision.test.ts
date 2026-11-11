import test from "node:test";
import assert from "node:assert/strict";
import { cabinStep } from "./storyCollision";

test("story consoles block penetration while preserving lateral sliding and the airlock route",()=>{
 const [x,z]=cabinStep(3,3.5,3.1,3.2);
 assert.equal(x,3.1);assert.equal(z,3.36);
 assert.deepEqual(cabinStep(0,6,0,6.6),[0,6.6]);
 assert.deepEqual(cabinStep(-5.5,0,-9,0),[-5.6,0]);
 assert.deepEqual(cabinStep(0,-4.8,0,-5.1,true),[0,-4.87]);
});

test("legacy checkpoint poses inside an old non-solid console can leave the console",()=>{
 const [x,z]=cabinStep(3,2.5,3,2.49);
 assert.ok(x<=1.64001||x>=4.35999||z<=1.64001||z>=3.35999);
 assert.deepEqual(cabinStep(3,2.5,3,1.2),[3,1.2]);
});
