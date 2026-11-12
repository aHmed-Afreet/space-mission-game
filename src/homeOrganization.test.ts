import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

// Vite components import CSS, which the Node test runner does not load.
// These checks therefore validate the source, routing and responsive rules
// without pretending to render a browser or importing a CSS asset.
const css=readFileSync("src/home.css","utf8");
const source=readFileSync("src/ModeSelect.tsx","utf8");

test("home visibly groups all five games and keeps the help guide separate",()=>{
 assert.match(source,/aria-label="Quick start"/);
 assert.match(source,/PLAY & BUILD/);
 assert.match(source,/Spaceflight history/);
 assert.match(source,/First mission\? Start with the guide/);
 assert.match(source,/experiences\.slice\(0,3\)\.map\(tile\)/);
 assert.match(source,/experiences\.slice\(3,5\)\.map\(tile\)/);
 assert.match(source,/experiences\.slice\(0,3\)\.map\(item =>/);
 assert.match(source,/className=\{"orbital-mode-tile orbital-mode-"\+item\.id\}/);
 for(const label of ["Junior Astronaut — Space Outpost","Commander — Be the Astronaut",
   "Mission Planner — Build & Launch","Featured Space Stories","Full Story Archive","How to Play"]){
   assert.ok(source.includes(label),"Main menu entry missing: "+label);
 }
});

test("home navigation keeps all lazy loaded routes and existing game save behavior",()=>{
 for(const id of ['"outpost"','"strategy"','"commander"','"history"','"history_all"','"guide"']){
   assert.ok(source.includes(id),"Missing mode "+id);
 }
 assert.match(source,/setMode\(next\)/);
 assert.match(source,/JuniorOutpost onExit=\{\(\) => setMode\(null\)\}/);
 assert.match(source,/Commander onExit=\{\(\) => setMode\(null\)\}/);
 assert.match(source,/HistoryHub startIn="archive"/);
 assert.match(source,/const Strategy = lazy/);
});

test("responsive landing keeps touch, focus and compact iPad landscape variants",()=>{
 assert.match(css,/\.orbital-mode-grid-primary\{grid-template-columns:repeat\(3,minmax\(0,1fr\)\)\}/);
 assert.match(css,/\.orbital-mode-grid-history\{grid-template-columns:repeat\(2,minmax\(0,1fr\)\)\}/);
 assert.match(css,/@media\(max-width:880px\)/);
 assert.match(css,/@media\(max-width:640px\)/);
 assert.match(css,/@media\(min-width:881px\) and \(max-height:750px\)/);
 assert.match(css,/min-height:44px/);
 assert.match(css,/touch-action:manipulation/);
 assert.match(css,/:focus-visible/);
 assert.match(css,/prefers-reduced-motion:reduce/);
});

test("home maintains graphics settings, NASA disclaimer, assets and privacy credits",()=>{
 assert.match(source,/<GlobalGraphics\/>/);
 assert.match(source,/Independent educational simulation · Not affiliated with NASA/);
 assert.match(source,/3D asset credits/);
 assert.match(source,/Background photo credit/);
 assert.match(source,/Privacy & local saves/);
});
