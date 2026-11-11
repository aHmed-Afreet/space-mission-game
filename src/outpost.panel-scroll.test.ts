import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const ui=readFileSync("src/outpost/Junior3D.tsx","utf8");
const css=readFileSync("src/outpost/world3d.css","utf8");
const lock=readFileSync("src/outpost/scrollLock.ts","utf8");

test("console options scroll separately from a permanently visible return button",()=>{
 assert.match(ui,/className="j3-panel j3-panel-console"/);
 assert.match(ui,/className="j3-panel-content" tabIndex=\{0\}/);
 assert.match(ui,/className="j3-panel-footer"/);
 const contentStart=ui.indexOf('<div className="j3-panel-content"');
 const footerStart=ui.indexOf('<div className="j3-panel-footer"');
 assert.ok(contentStart>=0&&footerStart>contentStart);
 assert.match(ui.slice(footerStart,footerStart+800),/RETURN TO 3D ROOM/);
 assert.match(css,/\.j3-panel-console\.j3-panel-content[^{]*\{|\.j3-panel-console \.j3-panel-content\{/);
 assert.match(css,/overflow-y:auto/);
 assert.match(css,/\.j3-panel-console \.j3-panel-footer\{/);
 assert.match(css,/flex:0 0 auto/);
});

test("iPad console fits the measured visual viewport instead of overflowing under browser bars",()=>{
 assert.match(css,/2026-11-11 iPad Chrome Outpost console usability fix/);
 assert.match(css,/height:min\(800px,calc\(var\(--outpost-visible-height,100dvh\) - 24px\)\)/);
 assert.match(css,/max-height:calc\(100% - 4px\)/);
 assert.match(css,/touch-action:pan-y/);
 assert.match(css,/-webkit-overflow-scrolling:touch/);
 assert.match(lock,/visualViewport\?\.height/);
});

test("touch scrolling works in all scrollable menus and objective, not in the moving 3D world",()=>{
 assert.match(lock,/\.j3-panel-content,\.j3-panel,\.j3-select,\.j3-objective/);
 assert.match(lock,/region\.scrollHeight>region\.clientHeight\+1/);
 assert.match(lock,/if\(event\.cancelable\)event\.preventDefault\(\)/);
 assert.match(lock,/document\.addEventListener\("touchmove",blockPanning,\{capture:true,passive:false\}\)/);
 assert.match(ui,/onPointerDown=\{down\}/);
 assert.match(ui,/onPointerDown=\{e=>actionDown\("interact",e\)\}/);
});

test("one-operation-per-day gameplay remains enforced with an explicit explanation",()=>{
 assert.match(ui,/another engineering operation unlocks on the next day/);
 assert.match(ui,/availableAction\(session,id\)/);
 assert.match(ui,/disabled=\{!avail\.ok\}/);
 assert.match(ui,/onClick=\{\(\)=>operate\(id\)\}/);
 assert.match(ui,/consoleOpenedAt\.current<450/);
 assert.match(ui,/setPanel\(null\);setNotice\(""\);/);
 assert.match(ui,/RETURN TO 3D ROOM/);
});
