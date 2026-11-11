import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const sharedButton=readFileSync("src/TouchActionButton.tsx","utf8");
const outpost=readFileSync("src/outpost/Junior3D.tsx","utf8");
const commander=readFileSync("src/commander/campaign/Flight.tsx","utf8");

test("all Commander and historical primary-touch buttons wait until browser click completes",()=>{
 assert.match(sharedButton,/postClick\.current\.commit\(\(\)=>\{/);
 assert.match(sharedButton,/lastTouchRelease\.current=event\.timeStamp/);
 assert.match(sharedButton,/sinceTouch>=0&&sinceTouch<900/);
 assert.match(sharedButton,/useEffect\(\(\)=>\(\)=>postClick\.current\.cancel\(\),\[\]\)/);
 assert.match(sharedButton,/if \(!disabled && activation\.current\.click\(event\.detail, pointerType, event\.timeStamp\)\) onActivate\(\)/);
});

test("Outpost stationary and held-joystick interactions both use the same deferred release",()=>{
 assert.match(outpost,/postClickInteract\.current\.commit\(\(\)=>setSeq\(n=>n\+1\)\)/);
 assert.match(outpost,/if\(e\.type==="pointerup"&&!p\.dragged&&e\.pointerType==="touch"\)/);
 assert.match(outpost,/useEffect\(\(\)=>\(\)=>postClickInteract\.current\.cancel\(\),\[\]\)/);
 assert.match(outpost,/const recent=performance\.now\(\)-lastTouchActivation\.current<750/);
});

test("Commander still opens, rather than toggles closed, when INTERACT is activated",()=>{
 const start=commander.indexOf("const handleWork =");
 const end=commander.indexOf("const openTab =",start);
 const interaction=commander.slice(start,end);
 assert.match(interaction,/setActions\(true\)/);
 assert.doesNotMatch(interaction,/setActions\(v\s*=>\s*!v\)/);
 assert.match(commander,/aria-label="Close station controls"/);
});
