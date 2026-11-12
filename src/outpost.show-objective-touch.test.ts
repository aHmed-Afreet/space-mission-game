import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const ui=readFileSync("src/outpost/Junior3D.tsx","utf8");
const css=readFileSync("src/outpost/world3d.css","utf8");

test("SHOW OBJECTIVE is a sibling of joystick controls, not nested in a lower HUD layer",()=>{
 const hud=ui.indexOf('<div className="j3-hud">');
 const controls=ui.indexOf('{!panel&&<div className={"j3-controls"');
 const action=ui.indexOf('{!panel&&!showObjective&&<button type="button" className="j3-objective-reopen"');
 const notice=ui.indexOf('{notice&&!panel&&<div className="j3-status"');
 assert.ok(hud>=0&&controls>hud&&action>controls&&notice>action,
  "the control must render outside the HUD and after the joystick controls");
 assert.ok(ui.slice(hud,controls).includes('showObjective?<div className="j3-objective"'));
 assert.ok(!ui.slice(hud,controls).includes('className="j3-objective-reopen"'),
  "the old HUD button would remain below the joystick's stacking context");
 assert.match(ui,/onPointerDown=\{e=>e\.stopPropagation\(\)\}/);
 assert.match(ui,/onClick=\{e=>\{e\.stopPropagation\(\);setShowObjective\(true\);\}\}/);
 assert.match(ui,/!panel&&!showObjective&&<button/);
 assert.match(ui,/onClick=\{\(\)=>setShowObjective\(false\)\}/,
  "HIDE must continue to work");
});

test("the SHOW OBJECTIVE hit target is visibly above joystick touch capture on iPad",()=>{
 assert.match(css,/\.j3-hud\{[^\n]*z-index:2/);
 assert.match(css,/\.j3-controls\{[^\n]*z-index:4/);
 assert.match(css,/\.j3-root \.j3-controls \.j3-move-zone\{[\s\S]*?z-index:7;/);
 const fix=css.slice(css.lastIndexOf("Regression fix: the mission reopen action"));
 assert.match(fix,/\.j3-root > \.j3-objective-reopen\{/);
 assert.match(fix,/z-index:9/);
 assert.match(fix,/pointer-events:auto/);
 assert.match(fix,/touch-action:manipulation/);
 assert.match(fix,/min-height:48px/);
 assert.match(fix,/@media\(max-width:900px\)/);
 assert.match(fix,/@media\(max-width:600px\)/);
});
