/**
 * Runs a genuine browser-to-browser WebRTC Commander test.
 * Distinct browser contexts use separate storage and temporary identities.
 * Requires playwright as a CI-only dependency, a working Chromium and outgoing
 * WebSocket access to Trystero's public Nostr signaling relays.
 */
import assert from "node:assert/strict";
import {chromium} from "playwright";
import {newStore,SAVE_KEY} from "../src/commander/campaign/save";
import {launchMission} from "../src/commander/campaign/engine";
import {missionById} from "../src/commander/campaign/definitions";

const url=process.env.COOP_TEST_URL??"http://127.0.0.1:4173/";
const browser=await chromium.launch({
 headless:true,args:["--no-sandbox","--enable-unsafe-swiftshader","--disable-dev-shm-usage",
 "--use-fake-ui-for-media-stream"]});
let hostContext,guestContext;
const errors:string[]=[];
const traces:string[]=[];
const log=(label,page)=>{
 page.on("pageerror",err=>errors.push(label+": "+err.message));
 page.on("console",msg=>{if(msg.type()==="error")traces.push(label+" console: "+msg.text());});
 page.on("requestfailed",req=>{
  if(/esm|relay|nostr|trystero/i.test(req.url()))traces.push(label+" request failed: "+req.url()+" "+req.failure()?.errorText);
 });
};
try{
 hostContext=await browser.newContext({viewport:{width:1280,height:800},hasTouch:true});
 guestContext=await browser.newContext({viewport:{width:1280,height:800},hasTouch:true});
 const base=newStore(),mission=missionById("mission-1");
 const started=launchMission(mission,base.design,base.life,[...mission.requiredEquipment],base.progress);
 const saved={...base,...started,session:{
  ...started.session,
  flight:{...started.session.flight,status:"orbit"},
  state:{...started.session.state,paused:false}
 }};
 await hostContext.addInitScript(({key,payload})=>{
  localStorage.setItem(key,JSON.stringify(payload));
  localStorage.setItem("orbital-player-settings-v1",
   JSON.stringify({graphics:"battery",lookSensitivity:1,showHints:true}));
 },{key:SAVE_KEY,payload:saved});
 await guestContext.addInitScript(()=>{
  localStorage.setItem("orbital-player-settings-v1",
   JSON.stringify({graphics:"battery",lookSensitivity:1,showHints:true}));
 });
 const host=await hostContext.newPage(),guest=await guestContext.newPage();
 log("host",host);log("guest",guest);
 for(const p of [host,guest]){
  await p.goto(url,{waitUntil:"domcontentloaded",timeout:30000});
  await p.getByRole("button",{name:/PLAY COMMANDER/}).click();
  await p.getByRole("button",{name:/^iPad /}).click();
  await p.locator(".cmd-coop-lobby").waitFor({timeout:15000});
 }
 await host.getByRole("button",{name:"CREATE ROOM",exact:true}).click();
 const roomLabel=host.locator(".cmd-coop-invite strong");
 await roomLabel.waitFor({timeout:30000});
 const code=(await roomLabel.textContent())?.trim()??"";
 assert.match(code,/^[A-HJ-NP-Z2-9]{9}-4$/);
 console.log("ROOM CREATED",code);
 await guest.getByRole("textbox",{name:"JOIN A FRIEND'S ROOM"}).fill(code);
 await guest.getByRole("button",{name:"JOIN ROOM",exact:true}).click();
 await host.locator(".cmd-coop-seat.connected").nth(1).waitFor({timeout:110000});
 await guest.locator(".cmd-coop-seat.connected").nth(1).waitFor({timeout:110000});
 console.log("TWO BROWSERS CONNECTED");
 const hostSeats=await host.locator(".cmd-coop-seat.connected").count();
 const guestSeats=await guest.locator(".cmd-coop-seat.connected").count();
 assert.equal(hostSeats,2);
 assert.equal(guestSeats,2);
 await host.getByRole("button",{name:"Resume mission →",exact:true}).click();
 const resume=host.getByRole("button",{name:"Resume mission",exact:true});
 if(await resume.isVisible())await resume.click();
 await host.locator(".cmd-session").waitFor({timeout:30000});
 await guest.locator(".cmd-session").waitFor({timeout:35000});
 console.log("BOTH COMMANDER FLIGHTS OPEN");
 const ready=async page=>page.waitForFunction(()=>{
  const canvas=document.querySelector<HTMLCanvasElement>(".cmd-session canvas[data-crew-visible]");
  return Number(canvas?.dataset.crewVisible??0)>=1;
 },null,{timeout:30000});
 await Promise.all([ready(host),ready(guest)]);
 console.log("3D CREW AVATARS VISIBLE ON BOTH BROWSERS");
 assert.ok((await host.locator(".cmd-coop-flight-hud").textContent())?.includes("CREW"));
 assert.ok((await guest.locator(".cmd-coop-flight-hud").textContent())?.includes("CREW"));
 assert.equal(errors.length,0,"Browser errors: "+JSON.stringify(errors));
 console.log("PASS: two real Chromium browser contexts joined one online Commander mission and rendered each other's spacesuit avatars");
}catch(error){
 console.error("BROWSER CO-OP FAIL",error);
 console.error("BROWSER ERRORS",errors);
 console.error("NETWORK",traces.slice(-25));
 throw error;
}finally{
 await Promise.allSettled([hostContext?.close(),guestContext?.close()]);
 await browser.close();
}
