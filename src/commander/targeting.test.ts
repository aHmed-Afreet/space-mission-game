import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { pickAimTarget } from "./targeting";
import { newShip } from "./campaign/ship";

const state = () => ({ world: newShip([]), airlock: { inner: false, outer: false,
  pressure: 101.3, cycling: null } });
function view(x: number, z: number, heading = Math.PI, aspect = 4 / 3) {
  const camera = new THREE.PerspectiveCamera(65, aspect, .08, 60);
  camera.rotation.order = "YXZ";
  camera.position.set(x, 1.63, z);
  camera.rotation.y = heading;
  return camera;
}

test("a level view at the closed flight hatch targets its surface on every device", () => {
  // The nearby panel is below the projection cone here. The old point score
  // selected Engineering behind the closed Flight-deck hatch instead.
  for (const aspect of [4 / 3, 390 / 844, 844 / 390]) {
    const camera = view(0, -4.95, Math.PI, aspect);
    const s = state();
    assert.deepEqual(pickAimTarget(camera, s, false), { kind: "door", id: "flight" });
    camera.position.z = -3.75;
    camera.rotation.y = 0;
    assert.deepEqual(pickAimTarget(camera, s, false), { kind: "door", id: "flight" });
  }
});

test("closed hatches occlude point targets and farther hatch surfaces", () => {
  const s = state();
  s.world.doors.service.open = false;
  for (const x of [-.7, 0, .7]) {
    const camera = view(x, -4.95);
    // Look toward a visible-looking far control while the near leaf blocks it.
    camera.lookAt(.54, 1.35, -1.54);
    assert.deepEqual(pickAimTarget(camera, s, false), { kind: "door", id: "flight" });
  }
  s.world.doors.flight.open = true;
  s.world.doors.flight.readyAt = 650;
  assert.deepEqual(pickAimTarget(view(0, -4.95), s, false, 300), { kind: "door", id: "flight" });
  // A different hatch cannot be activated from across the cabin.
  assert.equal(pickAimTarget(view(0, -4.95), s, false, 700), null);
  // Approach the service hatch and the normal control becomes reachable.
  assert.deepEqual(pickAimTarget(view(0, -2.5), s, false, 700), { kind: "door", id: "service" });
});

test("opening a hatch preserves its fixed frame and moving leaf controls", () => {
  const s = state();
  s.world.doors.flight.open = true;
  for (const [z, face] of [[-4.95, -1], [-3.75, 1]]) {
    for (const x of [-.98, .98, 1.59]) {
      const camera = view(0, z);
      camera.lookAt(x, 1.35, -4.35 + face * .19);
      assert.deepEqual(pickAimTarget(camera, s, false), { kind: "door", id: "flight" });
    }
  }
});

test("projection uses current camera transforms and rejects targets behind the player", () => {
  const s = state();
  const camera = view(0, -4.95, 0);
  camera.lookAt(0, 1.3, -5.62);
  assert.deepEqual(pickAimTarget(camera, s, false), { kind: "station", id: "cockpit" });
  // No renderer updates matrices between these calls.
  camera.rotation.set(0, Math.PI, 0);
  assert.deepEqual(pickAimTarget(camera, s, false), { kind: "door", id: "flight" });
  camera.position.set(0, 1.63, .8);
  s.world.doors.habitation.open = false;
  assert.deepEqual(pickAimTarget(camera, s, false), { kind: "door", id: "habitation" });
});

test("airlock hatches occlude one another while both sides retain their controls", () => {
  const s = state();
  assert.deepEqual(pickAimTarget(view(0, 7.1), s, true), { kind: "airlock", id: "inner" });
  s.airlock.inner = true;
  assert.deepEqual(pickAimTarget(view(0, 7.1), s, true), { kind: "airlock", id: "outer" });
  assert.deepEqual(pickAimTarget(view(0, 10.95, 0), s, true), { kind: "airlock", id: "outer" });
  s.airlock.outer = true;
  for (const [z, face] of [[9.55, -1], [10.95, 1]]) {
    const camera = view(0, z);
    camera.lookAt(.67, 1.35, 10.25 + face * .24);
    assert.deepEqual(pickAimTarget(camera, s, true), { kind: "airlock", id: "outer" });
  }
});

test("side bulkheads block remote targets even after the hatch opens", () => {
  const s = state();
  s.world.doors.flight.open = true;
  const camera = view(1.5, -4.8);
  const remoteControl = new THREE.Vector3(.98, 1.35, -1.54);
  camera.lookAt(remoteControl);
  camera.updateMatrixWorld();
  assert.ok(remoteControl.distanceTo(camera.position) < 3.5);
  assert.ok(Math.hypot(...remoteControl.clone().project(camera).toArray().slice(0, 2)) < .001);
  // The sight line crosses the solid side of the Flight bulkhead.
  assert.equal(pickAimTarget(camera, s, false), null);
});

test("unreachable hatch does not steal INTERACT from the nearby science bay", () => {
  const s=state();
  const camera=view(-1.7,-3.1);
  camera.lookAt(0,1.35,-4.35);
  assert.notDeepEqual(pickAimTarget(camera,s,false),{kind:"door",id:"flight"});
  const lab=view(-1.7,-3.1);
  lab.lookAt(-2.2,1.3,-2.62);
  assert.deepEqual(pickAimTarget(lab,s,false),{kind:"station",id:"science"});
});
test("door candidates match actual 1.6m reach and 1.5m aisle width",()=>{
  const s=state();
  const camera=view(0,-4.95);
  assert.deepEqual(pickAimTarget(camera,s,false),{kind:"door",id:"flight"});
  camera.position.x=1.7;
  assert.notDeepEqual(pickAimTarget(camera,s,false),{kind:"door",id:"flight"});
  camera.position.x=0;camera.position.z=-2.65;
  assert.notDeepEqual(pickAimTarget(camera,s,false),{kind:"door",id:"flight"});
});
