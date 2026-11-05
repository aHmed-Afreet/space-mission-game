import test from "node:test";
import assert from "node:assert/strict";
import {SECTION_DOOR_DURATION_MS,sectionDoorLeafX,sectionDoorOpenFraction} from "./doorMotion";

test("all three section hatch leaves clear the centre aisle when fully open",()=>{
  for(const side of [-1,1] as const){
    assert.equal(sectionDoorLeafX(false,side), side*0.53);
    assert.equal(sectionDoorLeafX(true,side), side*1.58);
    assert.ok(Math.abs(sectionDoorLeafX(true,side))-.51 >= 1.04);
  }
});

test("visual door position is synchronized to the collision-clearance timestamp",()=>{
  const t=10_000, ready=t+SECTION_DOOR_DURATION_MS;
  assert.equal(sectionDoorOpenFraction(true,ready,t),0);
  assert.equal(sectionDoorOpenFraction(true,ready,ready),1);
  assert.equal(sectionDoorOpenFraction(false,ready,t),1);
  assert.equal(sectionDoorOpenFraction(false,ready,ready),0);
  const midpoint=t+SECTION_DOOR_DURATION_MS/2;
  assert.ok(Math.abs(sectionDoorOpenFraction(true,ready,midpoint)-.5)<1e-8);
  assert.ok(Math.abs(sectionDoorLeafX(true,1,ready,midpoint)-1.055)<1e-8);
  assert.equal(sectionDoorLeafX(true,1,ready,ready+10000),1.58);
  assert.equal(sectionDoorLeafX(false,-1,ready,ready+10000),-.53);
});

test("skipped frames do not delay hatch completion or reverse its direction",()=>{
  const t=100_000,ready=t+SECTION_DOOR_DURATION_MS;
  const samples=[0,100,260,500,650,1500].map(ms=>sectionDoorLeafX(true,1,ready,t+ms));
  assert.ok(samples.every((v,i)=>i===0||v>=samples[i-1]));
  assert.equal(samples.at(-1),1.58);
  assert.equal(sectionDoorLeafX(true,1,ready,ready),1.58);
});
