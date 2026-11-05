import test from "node:test";
import assert from "node:assert/strict";
import { sectionDoorLeafX, doorMotionBlend } from "./doorMotion";

test("section hatch leaves travel clear of the central 2.04m opening", () => {
  for(const side of [-1,1] as const) {
    assert.equal(sectionDoorLeafX(false,side),side * 0.53);
    assert.equal(sectionDoorLeafX(true,side),side * 1.58);
    // Each leaf is 1.02 m wide. The inner edge ends beyond |x| = 1.02 m.
    assert.ok(Math.abs(sectionDoorLeafX(true,side)) - .51 >= 1.04);
  }
});

test("hatch animation is independent of frame rate and snaps to saved state",()=>{
  const target=sectionDoorLeafX(true,1);
  function run(fps:number){
    let x=sectionDoorLeafX(false,1);
    for(let i=0;i<fps;i++) x+=(target-x)*doorMotionBlend(1/fps);
    return x;
  }
  assert.equal(doorMotionBlend(null),1);
  assert.ok(Math.abs(run(15)-run(60)) < .0001);
  assert.ok(Math.abs(run(30)-run(60)) < .0001);
  assert.ok(Math.abs(run(60)-target) < .001);
});
