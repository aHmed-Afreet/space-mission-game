import { test } from "node:test";
import assert from "node:assert/strict";
import { createTouchActivation } from "./touchActivation";

test("a secondary touch commits once on release independently of other held contacts", () => {
  const button = createTouchActivation();
  assert.equal(button.begin("touch", 14), true);
  assert.equal(button.release(11, true, 100), false, "Movement contact cannot activate this button");
  assert.equal(button.release(14, true, 120), true);
  assert.equal(button.release(14, true, 121), false);
  assert.equal(button.click(1, "touch", 122), false, "No duplicate if a browser also generates click");
  assert.equal(button.click(1, undefined, 122), false, "Older compatibility MouseEvent also suppressed");
});

test("dragging outside, disabled release and cancellation cannot activate a touch action", () => {
  for (const reason of ["outside", "disabled", "cancel", "capture-lost"]) {
    const button = createTouchActivation();
    assert.equal(button.begin("touch", 2), true);
    if (reason === "cancel" || reason === "capture-lost") button.cancel(2);
    assert.equal(button.release(2, reason === "cancel" || reason === "capture-lost", 100), false, reason);
    assert.equal(button.click(1, "touch", 101), false);
    assert.equal(button.begin("touch", 3), true, "A new touch remains usable");
    assert.equal(button.release(3, true, 200), true);
  }
});

test("mouse, keyboard and assistive clicks remain normal even immediately after touch", () => {
  const button = createTouchActivation();
  assert.equal(button.begin("mouse", 1), false);
  assert.equal(button.begin("pen", 1), false);
  assert.equal(button.click(1, "mouse", 10), true);
  assert.equal(button.click(1, "pen", 10), true);
  assert.equal(button.begin("touch", 2), true);
  assert.equal(button.release(2, true, 100), true);
  assert.equal(button.click(0, undefined, 101), true);
  assert.equal(button.click(0, "touch", 101), true);
  assert.equal(button.click(1, "mouse", 101), true);
  assert.equal(button.click(1, undefined, 901), true);
});

test("contacts on the same button cannot steal or cancel another finger's pending action", () => {
  const button = createTouchActivation();
  assert.equal(button.begin("touch", 2), true);
  assert.equal(button.begin("touch", 3), false);
  button.cancel(3);
  assert.equal(button.release(3, true, 99), false);
  assert.equal(button.release(2, true, 100), true);
});
