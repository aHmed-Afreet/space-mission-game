import test from "node:test";
import assert from "node:assert/strict";
import {createElement} from "react";
import {renderToStaticMarkup} from "react-dom/server";
import {readFileSync} from "node:fs";
import ModeSelect from "./ModeSelect";

const css=readFileSync("src/home.css","utf8");
const source=readFileSync("src/ModeSelect.tsx","utf8");

test("landing page organizes all game modes into playable missions, history and guide",()=>{
 const html=renderToStaticMarkup(createElement(ModeSelect));
 assert.match(html,/class="orbital-landing"/);
 assert.match(html,/aria-label="Quick start"/);
 assert.match(html,/PLAY &amp; BUILD/);
 assert.match(html,/Spaceflight history/);
 assert.match(html,/First mission\? Start with the guide/);
 assert.equal((html.match(/class="orbital-mode-tile orbital-mode-/g)||[]).length,5,
   "Five actual game experiences must appear as primary/history cards");
 assert.equal((html.match(/class="orbital-launchpad-item"/g)||[]).length,3,
   "Quick launch must contain exactly three playable experiences");
 for(const label of ["Space Outpost","Be the Astronaut","Build &amp; Launch","Featured Space Stories","Full Story Archive","HOW TO PLAY"]){
   assert.ok(html.includes(label),label+" must remain available from home");
 }
 assert.match(html,/Independent educational simulation · Not affiliated with NASA/);
});

test("navigation retains all previous lazy-loaded routes and local saved-game structure",()=>{
 for(const name of ['"outpost"','"strategy"','"commander"','"history"','"history_all"','"guide"']){
   assert.ok(source.includes(name),"Missing mode "+name);
 }
 assert.match(source,/setMode\(next\)/);
 assert.match(source,/JuniorOutpost onExit=\{\(\) => setMode\(null\)\}/);
 assert.match(source,/Commander onExit=\{\(\) => setMode\(null\)\}/);
 assert.match(source,/HistoryHub startIn="archive"/);
 assert.match(source,/Strategy/);
});

test("layout explicitly adapts to iPad landscape and narrow touch screens",()=>{
 assert.match(css,/\.orbital-mode-grid-primary\{grid-template-columns:repeat\(3,minmax\(0,1fr\)\)\}/);
 assert.match(css,/\.orbital-mode-grid-history\{grid-template-columns:repeat\(2,minmax\(0,1fr\)\)\}/);
 assert.match(css,/@media\(max-width:880px\)/);
 assert.match(css,/@media\(max-width:640px\)/);
 assert.match(css,/@media\(min-width:881px\) and \(max-height:750px\)/);
 assert.match(css,/min-height:44px/);
 assert.match(css,/touch-action:manipulation/);
 assert.match(css,/:focus-visible/);
 assert.match(css, /prefers-reduced-motion:reduce/);
});

test("landing screen preserves global graphics control, credits and privacy links",()=>{
 const html=renderToStaticMarkup(createElement(ModeSelect));
 assert.match(html,/class="global-graphics"/);
 assert.match(html,/3D asset credits/);
 assert.match(html,/Background photo credit/);
 assert.match(html,/Privacy &amp; local saves/);
});
