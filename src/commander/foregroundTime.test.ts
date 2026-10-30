import test from "node:test";
import assert from "node:assert/strict";
import { createCommanderTimeBudget, createForegroundClock } from "./foregroundTime";
import { stepLocomotion, type LocomotionState } from "./locomotion";
import { campaignWalkable, createSession, emptyProgress, tickSession } from "./campaign/engine";
import { missionById } from "./campaign/definitions";
import { defaultDesign, defaultLife } from "./simulation";

const rates = [1, 10, 30, 60, 120];
const initialMotion = (z = -4.95): LocomotionState => ({
  position:{x:0,y:1.63,z}, movement:{forward:0,sideways:0}, jump:{height:0,velocity:0},
});

function run(hz:number, simRate:number, wall:boolean, seconds=12) {
  const mission = missionById("mission-1");
  let session = createSession(mission, defaultDesign, defaultLife, [...mission.requiredEquipment], emptyProgress());
  const clock = createForegroundClock(), budget = createCommanderTimeBudget();
  const motion = initialMotion();
  let elapsed = 0, accepted = 0;
  for (let frame = 0; frame <= seconds * hz; frame++) {
    const result = clock.advance(frame * 1000 / hz, {active:true,visible:true}, dt => {
      elapsed += dt;
      stepLocomotion(motion, {forward:-1,sideways:0,yaw:0,sprint:true,lift:0}, null, dt,
        wall ? (x,z)=>campaignWalkable(x,z,session) : ()=>true, elapsed, true);
    });
    accepted += result.acceptedSeconds;
    budget.add(result.acceptedSeconds,simRate);
    for (const minutes of budget.takeSteps()) session = tickSession(session,minutes);
  }
  for (const minutes of budget.takeSteps(true)) session = tickSession(session,minutes);
  return {motion,session,accepted};
}

test("1/10/30/60/120 Hz produce identical fixed-step travel and compressed resource consumption at every warp", () => {
  for (const simRate of [1, 5, 20, 100]) {
    const seconds=simRate===100?2:12;
    const expected = run(120,simRate,false,seconds);
    assert.ok(Math.abs(expected.accepted - seconds) < 1e-8);
    assert.ok(Math.abs(expected.session.state.minutes - .5 * seconds * simRate) < 1e-8);
    for (const hz of rates) {
      const actual = run(hz,simRate,false,seconds);
      assert.deepEqual(actual.motion,expected.motion,`${hz} Hz movement, warp ${simRate}`);
      for (const key of ["minutes","oxygen","battery","hydration","nutrition","temperature","energy"] as const)
        assert.ok(Math.abs(actual.session.state[key] - expected.session.state[key]) < 1e-8,`${hz} Hz ${key}, warp ${simRate}`);
    }
  }
});

test("one-Hz sprint callbacks cannot tunnel through closed hatches or furniture", () => {
  const baseline = run(120,1,true);
  assert.ok(baseline.motion.position.z < -4.54);
  for (const hz of rates) assert.deepEqual(run(hz,1,true).motion,baseline.motion);
  const motion = initialMotion(-2);
  motion.position.x = -.8;
  const clock = createForegroundClock();
  for (let frame=0; frame<=4;frame++) clock.advance(frame*1000,{active:true,visible:true},dt =>
    stepLocomotion(motion,{forward:1,sideways:0,yaw:0,sprint:true,lift:0},null,dt,
      (x,z)=> !(Math.abs(x+.8)<.4 && Math.abs(z+5.15)<.53),frame,true));
  assert.ok(motion.position.z > -4.63,"cockpit seat remains solid");
});

test("long stalls suspend both clocks; hidden and paused intervals never catch up on resume", () => {
  const clock=createForegroundClock(), budget=createCommanderTimeBudget();
  let moved=0;
  const advance=(now:number,active=true,visible=true)=>{
    const frame=clock.advance(now,{active,visible},dt=>moved+=dt);
    budget.add(frame.acceptedSeconds,4);
    return frame;
  };
  advance(0); advance(1000);
  assert.equal(advance(4001).suspended,true);
  advance(5001); advance(6001,false); advance(7001,false);
  advance(8001,false,false); advance(9001,true,false);
  clock.reset(10000);
  advance(11000);
  assert.ok(Math.abs(moved-3)<1e-9);
  assert.equal(budget.takeSteps(true).reduce((a,b)=>a+b,0),6);
});

test("fractional resource time survives batching and is valued at the rate when accepted",()=>{
  const budget=createCommanderTimeBudget();
  budget.add(.1,1);
  assert.deepEqual(budget.takeSteps(),[]);
  budget.add(.1,4);
  assert.deepEqual(budget.takeSteps(),[]);
  assert.deepEqual(budget.takeSteps(true),[.25]);
  assert.equal(budget.seconds,0);
  assert.deepEqual(budget.takeSteps(true),[]);
});

test("input-edge flush preserves short native pulses entirely between slow draws and never replays released keys",()=>{
  const runPulse=(hz:number,down:number,up:number)=>{
    const clock=createForegroundClock(), resourceClock=createForegroundClock(),budget=createCommanderTimeBudget();
    const motion=initialMotion(0);
    let held=false,elapsed=0;
    const advance=(now:number)=>{
      const resources=resourceClock.advance(now,{active:true,visible:true},()=>{});
      budget.add(resources.acceptedSeconds,1);
      clock.advance(now,{active:true,visible:true},dt=>{
        elapsed+=dt;
        stepLocomotion(motion,{forward:held?1:0,sideways:0,yaw:0,sprint:false,lift:0},null,dt,()=>true,elapsed,true);
      });
    };
    const events=[...Array.from({length:4*hz+1},(_,index)=>({now:index*1000/hz,kind:"draw"})),
      {now:down,kind:"down"},{now:up,kind:"up"}].sort((a,b)=>a.now-b.now);
    for(const event of events) {
      // This is the contract used by every Cabin input mutation: advance under
      // the old snapshot first, then install the new key/contact/look state.
      advance(event.now);
      if(event.kind==="down")held=true;
      if(event.kind==="up")held=false;
    }
    return {distance:-motion.position.z,velocity:motion.movement.forward,
      minutes:budget.takeSteps(true).reduce((sum,value)=>sum+value,0)};
  };
  for(const [down,up] of [[400,500],[990,1090],[1,101]]) {
    const slow=runPulse(1,down,up),fast=runPulse(120,down,up);
    assert.ok(Math.abs(slow.distance-.18)<1e-5,"100 ms pulse moves about 18 cm, not zero or 1.8 m");
    assert.ok(Math.abs(slow.distance-fast.distance)<1e-8);
    assert.ok(slow.velocity<1e-10,"the released key is not replayed on a later draw");
    assert.ok(Math.abs(slow.minutes-2)<1e-8);
  }
});

test("input edges keep resources and movement coherent even when no draw arrives for over two seconds",()=>{
  const motion=createForegroundClock(),resource=createForegroundClock();
  let moved=0,charged=0;
  // Input processing remains active during this slow-renderer fixture. Each
  // accepted input interval reaches both clocks at the same monotonic time.
  for(const now of [0,1000,1500,2500,3000,4000]) {
    const resources=resource.advance(now,{active:true,visible:true},()=>{});
    charged+=resources.acceptedSeconds;
    motion.advance(now,{active:true,visible:true},seconds=>moved+=seconds);
  }
  assert.ok(Math.abs(moved-4)<1e-8);
  assert.ok(Math.abs(moved-charged)<1e-8);
});

test("surface hop, orbital thrust/damping, braking and reduced motion survive fixed substeps",()=>{
  const surface=initialMotion(13), orbit=initialMotion(13);
  surface.jump.velocity=2.1;
  let maxHop=0, elapsed=0;
  for(let i=0;i<480;i++) {
    elapsed+=1/120;
    stepLocomotion(surface,{forward:0,sideways:0,yaw:0,sprint:false,lift:0},{movement:1.35,gravity:1.62},1/120,()=>true,elapsed,true);
    maxHop=Math.max(maxHop,surface.jump.height);
    stepLocomotion(orbit,{forward:i<120?1:0,sideways:0,yaw:0,sprint:false,lift:i<120?1:0},{movement:1.7,gravity:0},1/120,()=>true,elapsed,true);
  }
  assert.ok(maxHop>1 && maxHop<1.5);
  assert.equal(surface.jump.height,0);
  assert.equal(surface.jump.velocity,0);
  assert.equal(surface.position.y,1.63);
  assert.ok(orbit.jump.height>0 && orbit.jump.height<=5.4);
  assert.ok(orbit.jump.velocity>=0 && orbit.jump.velocity<.3,"thrust releases into damped drift");
  assert.ok(orbit.movement.forward<1e-10,"release brakes horizontal movement");
  assert.equal(orbit.position.y,1.63+orbit.jump.height,"reduced motion omits camera bob");
});
