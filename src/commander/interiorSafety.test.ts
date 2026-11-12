import test from "node:test";
import assert from "node:assert/strict";
import * as T from "three";
import { createInterior } from "./interior";
import { createFixtures } from "./campaign/fixtures";
import { createSession, emptyProgress } from "./campaign/engine";
import { missionById } from "./campaign/definitions";
import { defaultDesign, defaultLife, type Area, type Action } from "./simulation";
import { deck } from "./layout";
import { sectionDoorLeafX } from "./doorMotion";

/** No network or WebGL in these state/ownership regressions. Actual visual
 * acceptance is separately captured through the same runtime renderer. */
function withCanvas(run: () => void) {
  const previous = globalThis.document;
  const context = new Proxy({
    createImageData: (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }),
    createLinearGradient: () => ({ addColorStop() {} }),
    createRadialGradient: () => ({ addColorStop() {} }),
    measureText: () => ({ width: 100 }),
  } as Record<string, unknown>, { get: (target, key) => target[String(key)] ?? (() => {}) });
  globalThis.document = {
    createElement: () => ({ width: 0, height: 0, getContext: () => context }),
    createElementNS: () => ({ addEventListener() {}, removeEventListener() {}, set src(_value: string) {} }),
  } as unknown as Document;
  try { run(); } finally { globalThis.document = previous; }
}
function sessionFixture() {
  const mission = missionById("mission-3");
  return createSession(mission, defaultDesign, defaultLife, [...mission.requiredEquipment], emptyProgress());
}

test("interior updates preserve mission/save state across all stations, effects and graphics tiers", () => withCanvas(() => {
  for (const graphics of ["battery", "balanced", "quality"] as const) {
    const cabin = createInterior({ eva: true, destination: "moon", graphics });
    const session = sessionFixture();
    const fixtures = createFixtures(cabin.scene);
    const positions = Object.entries(deck) as [Area, { x: number; z: number }][];
    for (const [index, [area, position]] of positions.entries()) {
      session.world.switches.busA = index % 2 === 0;
      session.world.switches.busB = index % 3 === 0;
      session.world.lockers.food = index % 2 === 1;
      session.world.lockers.eva = index % 2 === 0;
      session.suit.equipped = index % 2 === 1;
      for (const door of Object.values(session.world.doors)) {
        door.open = index % 2 === 0;
        door.readyAt = index % 2 === 0 ? Date.now() + 800 : 0;
      }
      const before = JSON.stringify(session);
      const effects: Action[] = ["drink", "dispenser", "eat", "takeMeal", "fill", "repair"];
      for (const [effect, action] of effects.entries()) {
        cabin.update(index * 10 + effect, area, index % 2 === 0, { id: index * 10 + effect + 1, action },
          { ...position, heading: 0 }, session.state, area, index % 2 === 0, session.world, session.suit.equipped);
        fixtures.update(session);
      }
      assert.equal(JSON.stringify(session), before, `${graphics}/${area}: presentation cannot grant inventory, alter doors, or overwrite mission state`);
    }
    const legacyBefore = JSON.stringify(session);
    assert.doesNotThrow(() => cabin.update(999, "galley", false, { id: 999, action: "drink" },
      { x: 0, z: .45, heading: 0 }, session.state), "legacy first-person flights keep the same optional-world API");
    assert.equal(JSON.stringify(session), legacyBefore);
    fixtures.dispose(); cabin.dispose();
  }
}));

test("redesigned stowage stays at the original targets and suit visibility follows the actual manifest", () => withCanvas(() => {
  const scene = new T.Scene(), fixtures = createFixtures(scene), session = sessionFixture();
  const locations: Record<string, [number, number, number]> = {
    water: [2.7, 2, .75], science: [-2.45, 2, -2.7], samples: [-2.45, 2, -3.7],
    equipment: [2.4, 1.8, 5.7], eva: [2.45, 2, 3.8], repair: [2.45, 2, 4.8],
    emergency: [1.5, 1.8, 6.1], maintenance: [-2.4, 2, .75],
  };
  scene.updateMatrixWorld(true);
  for (const [id, position] of Object.entries(locations)) {
    const anchor = scene.getObjectByName(`stowage-${id}`);
    assert.ok(anchor, `${id}: a distinct, reachable storage anchor remains`);
    assert.deepEqual(anchor.getWorldPosition(new T.Vector3()).toArray(), position);
    assert.ok(scene.getObjectByName(`stowage-door-${id}`), `${id}: keep animated compartment door`);
  }
  session.world.lockers.eva = true; session.suit.equipped = false;
  fixtures.update(session);
  const suit = scene.getObjectByName("stowage-item-eva-0")!, empty = scene.getObjectByName("stowage-empty-eva")!;
  assert.equal(suit.visible, true); assert.equal(empty.visible, false);
  session.suit.equipped = true; fixtures.update(session);
  assert.equal(suit.visible, false, "equipped suits must disappear from storage");
  assert.equal(empty.visible, true, "an empty compartment never implies spare suit inventory");
  session.world.lockers.eva = false; fixtures.update(session);
  assert.equal(empty.visible, false);
  fixtures.dispose(); assert.equal(scene.children.length, 0, "all new fixture architecture belongs to its scene owner");
}));


test("formed section hatches keep the exact collision-clearance clock after a stalled frame", () => withCanvas(() => {
  const scene = new T.Scene(), fixtures = createFixtures(scene), session = sessionFixture();
  const originalNow = Date.now;
  try {
    for (const id of ["service", "habitation"] as const) {
      session.world.doors[id].open = true; session.world.doors[id].readyAt = 1650;
    }
    for (const now of [1000, 1325, 1650, 5000]) {
      Date.now = () => now;
      fixtures.update(session);
      for (const id of ["service", "habitation"] as const) for (const side of [-1, 1] as const) {
        const leaf = scene.getObjectByName(`section-hatch-${id}-${side}`);
        assert.ok(leaf, `${id}: independently moving formed hatch remains`);
        assert.equal(leaf.position.x, sectionDoorLeafX(true, side, 1650, now));
      }
    }
  } finally { Date.now = originalNow; fixtures.dispose(); }
}));
