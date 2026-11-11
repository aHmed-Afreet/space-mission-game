import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {outpostVisibleHeight} from "./outpost/scrollLock";

// Measured visible iPad viewport height, not 100dvh or document size.
// Mirrors the CSS max(., visibleHeight-offset) anchors.
function dockBounds(visibleHeight:number){
 const dockTop=visibleHeight<=650?Math.max(150,visibleHeight-150):Math.max(220,visibleHeight-157);
 const zoneTop=visibleHeight<=650?Math.max(190,visibleHeight-270):Math.max(230,visibleHeight-306);
 const actionHeight=46+9+60;
 return {dockTop,buttonBottom:dockTop+actionHeight,zoneTop,zoneBottom:visibleHeight};
}
const css=readFileSync("src/outpost/world3d.css","utf8");
const js=readFileSync("src/outpost/Junior3D.tsx","utf8");

test("iPad action buttons are near bottom-right and fully visible",()=>{
 const h=outpostVisibleHeight(697,825);
 const r=dockBounds(h);
 assert.ok(r.dockTop>=h-160,"controls should not float at mid-screen");
 assert.ok(r.buttonBottom<=h-16,"both RUN and INTERACT need bottom clearance");
 for(const n of [500,560,650,697,725,840,1024]){
  const b=dockBounds(n);
  assert.ok(b.buttonBottom<=n-16,"buttons clipped at visible height "+n);
  assert.ok(b.dockTop>=145,"buttons overlap top HUD at height "+n);
 }
});

test("the circled bottom-left zone works at the actual bottom",()=>{
 for(const h of [500,650,697,725,840]){
  const r=dockBounds(h);
  for(const y of [h-135,h-90,h-48,h-15]){
   assert.ok(y>=r.zoneTop&&y<=r.zoneBottom,"touch at y "+y+" missed area "+h);
  }
 }
 assert.match(js,/onPointerDown=\{down\}/);
 assert.match(js,/setPointerCapture\(e\.pointerId\)/);
 assert.match(js,/origin\.current=\{x:e\.clientX,y:e\.clientY\}/);
 assert.match(js,/move\.current\.y=-vy/);
});

test("final rules override old too-high buttons and truncated joystick zone",()=>{
 const tag="2026-11-11 iPad Chrome layout fix";
 assert.ok(css.includes(tag));
 const latest=css.slice(css.indexOf(tag));
 assert.match(latest,/\.j3-buttons\{\s*position:absolute!important;\s*top:max\(220px,calc\(var\(--outpost-visible-height,100dvh\) - 157px\)\)!important;/);
 assert.match(latest,/\.j3-move-zone\{\s*position:absolute!important;\s*top:max\(230px,calc\(var\(--outpost-visible-height,100dvh\) - 306px\)\)!important;\s*bottom:0!important;\s*height:auto!important;/);
 assert.match(latest,/pointer-events:auto!important;/);
 assert.match(latest,/touch-action:none!important;/);
 assert.match(latest,/@media\(max-height:650px\)/);
 assert.match(css,/html\.outpost-viewport-locked #root\{/);
 assert.match(css,/height:var\(--outpost-visible-height,100dvh\)!important;/);
});
