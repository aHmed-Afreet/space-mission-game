import test from "node:test";
import assert from "node:assert/strict";
import { createStoryThrust } from "./storyThrust";
import { createForegroundClock } from "../commander/foregroundTime";

test("Story orbital contacts cancel and release independently, including lost-capture duplicates", () => {
  let lift = 0, active = true, flushes = 0;
  const input = createStoryThrust({flush: () => { flushes++; }, active: () => active, publish: n => { lift = n; }});
  input.press(7, 1); assert.equal(lift, 1);
  input.press(8, -1); assert.equal(lift, 0);
  input.release(8); assert.equal(lift, 1, "remaining ascending contact stays active");
  const before = flushes; input.release(8); input.release(99);
  assert.equal(flushes, before); assert.equal(lift, 1);
  input.press(9, 1); input.release(7); assert.equal(lift, 1);
  active = false; input.clear(); assert.equal(lift, 0);
  input.press(10, -1); assert.equal(lift, 0, "paused controls cannot acquire thrust");
  active = true; input.press(11, -1); input.release(9);
  assert.equal(lift, -1, "stale cancellation cannot stop the new contact");
  input.clear(); assert.equal(lift, 0);
});

test("Story touch edges integrate a 100 ms thrust pulse between one-Hz frames without retroactive input", () => {
  const clock = createForegroundClock(); let now = 0, lift = 0, impulse = 0;
  const flush = () => clock.advance(now, {active: true, visible: true}, dt => { impulse += lift * dt; });
  const input = createStoryThrust({flush, active: () => true, publish: n => { lift = n; }});
  flush(); now = 500; input.press(1, 1); now = 600; input.release(1); now = 1000; flush();
  assert.ok(Math.abs(impulse - .1) < 1e-9);
  now = 1999; input.press(2, -1); now = 2000; flush();
  assert.ok(Math.abs(impulse - .1) < .01, "new press cannot claim the previous second");
  now = 2100; input.release(2); const released = impulse; now = 3000; flush();
  assert.equal(impulse, released, "released contact is not replayed");
});
