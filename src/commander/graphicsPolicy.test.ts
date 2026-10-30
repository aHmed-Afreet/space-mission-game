import test from "node:test";
import assert from "node:assert/strict";
import { adaptiveGraphicsRatio, graphicsRatioBounds, publishGraphicsTrace } from "./graphicsPolicy";

test("slow/healthy callbacks in every preset stay below low/normal device DPR and configured caps",()=>{
  for (const preset of ["battery","balanced","quality"] as const) {
    for (const device of [.35,.5,.75,1,1.5,2,3]) {
      const bounds=graphicsRatioBounds(device,preset);
      let current=bounds.limit;
      for(const fps of [...Array(20).fill(1),...Array(20).fill(120),...Array(20).fill(15)]) {
        const next=adaptiveGraphicsRatio(current,bounds,fps,60);
        assert.ok(next>=bounds.floor && next<=bounds.limit && next<=device);
        if(fps===1) assert.ok(next<=current,"slow callbacks cannot increase DPR");
        current=next;
      }
    }
  }
});

test("a shrinking DPR cap clamps an existing renderer ratio, and invalid DPR has a finite fallback",()=>{
  for(const preset of ["battery","balanced","quality"] as const) {
    const bounds=graphicsRatioBounds(.5,preset);
    assert.equal(adaptiveGraphicsRatio(1.85,bounds,5,60),.5);
    assert.equal(adaptiveGraphicsRatio(-1,bounds,60,60),.5);
    for(const invalid of [0,-1,NaN,Infinity]) assert.ok(Number.isFinite(graphicsRatioBounds(invalid,preset).limit));
  }
});

test("renderer evidence publishes measured bounds without a writable renderer handle",()=>{
  const canvas=new EventTarget() as HTMLCanvasElement;
  Object.defineProperty(canvas,"dataset",{value:{}});
  const samples:unknown[]=[];
  canvas.addEventListener("commander-graphics-sample",event=>samples.push((event as CustomEvent).detail));
  const trace={preset:"balanced" as const,deviceRatio:.5,ratio:.5,floor:.5,limit:.5,measuredFps:5,targetFps:60};
  publishGraphicsTrace(canvas,trace);
  assert.deepEqual(JSON.parse(canvas.dataset.graphicsTrace!),trace);
  assert.deepEqual(samples,[trace]);
  assert.ok(Object.isFrozen(samples[0]));
});
