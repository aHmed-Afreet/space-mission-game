import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createTouchActivation } from "./touchActivation";

const flight=readFileSync("src/commander/campaign/Flight.tsx","utf8");
const outpost=readFileSync("src/outpost/Junior3D.tsx","utf8");
const world=readFileSync("src/outpost/World3D.tsx","utf8");

test("Commander INTERACT opens station operations idempotently instead of toggling them closed",()=>{
 const interact=flight.slice(flight.indexOf("const handleWork ="),flight.indexOf("const openTab ="));
 assert.match(interact,/setActions\(true\)/);
 assert.doesNotMatch(interact,/setActions\(v\s*=>\s*!v\)/);
 assert.match(flight,/aria-label="Close station controls"/);
 assert.match(flight,/onActivate=\{\(\)=>setActions\(false\)\}>× Close station controls/);
 // Duplicate WebKit touch/click delivery must not undo an opening.
 let opened=false;
 const open=()=>{opened=true;};
 const activation=createTouchActivation();
 assert.equal(activation.begin("touch",24),true);
 if(activation.release(24,true,100))open();
 if(activation.click(1,"touch",110))open();
 open(); // In case a future browser delivers an additional activation.
 assert.equal(opened,true);
});

test("Commander accepts delayed live-position sync after opening the station menu",()=>{
 assert.match(flight,/const pendingInteractionArea = useRef<ReturnType<typeof nearby> \| null>\(null\)/);
 assert.match(flight,/area === pendingInteractionArea\.current/);
 assert.match(flight,/pendingInteractionArea\.current = areaAtPress \?\? null/);
 assert.match(flight,/\}, \[area\]\)/);
 assert.match(flight,/\}, \[s\.objective\]\)/);
});

test("Outpost console ignores a compatibility click immediately after INTERACT",()=>{
 assert.match(outpost,/const consoleOpenedAt=useRef\(-Infinity\)/);
 assert.match(outpost,/consoleOpenedAt\.current=performance\.now\(\)/);
 assert.match(outpost,/performance\.now\(\)-consoleOpenedAt\.current<450/);
 assert.match(outpost,/onClick=\{event=>\{/);
 assert.match(outpost,/setPanel\(null\);setNotice\("а?"\);|setPanel\(null\);setNotice\(""\);/);
});

test("Outpost 3D loop does not consume queued input behind a menu",()=>{
 assert.match(outpost,/blocked=\{Boolean\(panel\)\}/);
 assert.match(world,/blocked:boolean/);
 assert.match(world,/const isBlocked=latest\.current\.blocked/);
 assert.match(world,/if\(isBlocked\)\{/);
 assert.match(world,/lastInteraction=latest\.current\.interactSeq/);
 assert.match(world,/interactRequest=false/);
 assert.match(world,/if\(!isBlocked&&state\.open&&now-state\.openAt>350&&!entered\)/);
});
