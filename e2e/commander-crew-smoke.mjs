/** Network smoke test on GitHub's Chromium browser: independent pages connected
 * over the actual PeerJS Cloud and WebRTC signaling, not a mocked network.
 * No accounts or personal data. Requires playwright-core installed by CI. */
import assert from "node:assert/strict";
import {chromium} from "playwright-core";

const base="http://127.0.0.1:4173/";
const browser=await chromium.launch({channel:"chrome",headless:true,args:["--disable-dev-shm-usage","--use-gl=angle","--use-angle=swiftshader","--enable-webgl"]});
const pages=[];
const errors=[];
async function startPage(index){
 const context=await browser.newContext({viewport:{width:1280,height:820},permissions:[]});
 const page=await context.newPage();
 pages.push({context,page});
 page.on("pageerror",error=>errors.push("Browser "+index+": "+error.message));
 page.on("console",message=>{if(message.text().includes("[crew-signaling]"))console.log("BROWSER",index,message.text());});
 await page.goto(base,{waitUntil:"domcontentloaded",timeout:30000});
 await page.getByRole("button",{name:/PLAY COMMANDER/}).first().click();
 await page.getByRole("button",{name:/Laptop/}).click();
 await page.getByRole("button",{name:/Continue/}).click();
 await page.getByRole("button",{name:/ONLINE CREW/}).click();
 await page.getByText("CREATE OR JOIN A MISSION").waitFor();
 return page;
}
async function main(){
 for(let i=0;i<50;i++){
  try{const r=await fetch(base);if(r.ok)break;}
  catch{if(i===49)throw Error("Vite server did not start");}
  await new Promise(r=>setTimeout(r,300));
 }
 const captain=await startPage(0);
 await captain.getByRole("button",{name:"CREATE PRIVATE ROOM"}).click();
 await captain.locator(".commander-crew-status b").filter({hasText:"CONNECTED"}).waitFor({timeout:25000});
 const code=(await captain.locator(".commander-crew-code strong").innerText()).replace(/\s/g,"");
 assert.equal(code.length,12,"Host must issue a 12-character private room code");
 console.log("HOST ROOM READY; testing actual remote client connections");
 for(let i=1;i<=3;i++){
  const guest=await startPage(i);
  await guest.getByLabel("12-CHARACTER CREW CODE").fill(code);
  await guest.getByRole("button",{name:"JOIN CREW ONLINE"}).click();
  await guest.locator(".commander-crew-status b").filter({hasText:"CONNECTED"}).waitFor({timeout:28000});
  await guest.locator(".commander-crew-roster li:not(.waiting)").first().waitFor();
  await captain.locator(".commander-crew-roster li:not(.waiting)").nth(i).waitFor({timeout:15000});
  const count=await captain.locator(".commander-crew-roster li:not(.waiting)").count();
  assert.equal(count,i+1,"Every connected browser must appear in captain's roster");
  console.log("REAL WEBRTC CONNECTED",i+1,"/4 astronauts");
 }
 const roles=await captain.locator(".commander-crew-roster li:not(.waiting) b").allInnerTexts();
 assert.deepEqual(roles,["Commander","Engineer","Scientist","Communications"]);
 if(errors.length)throw Error(errors.join("\n"));
 console.log("PASS: four independent browser contexts joined over actual PeerJS signaling.");
}
try{await main();}
catch(error){
 for(const [i,entry] of pages.entries()){
  try{await entry.page.screenshot({path:"/tmp/orbital-crew-browser-"+i+".png",fullPage:true});}catch{}
  try{console.error("Browser",i,"error label:",await entry.page.locator(".commander-crew-error").allInnerTexts());
    console.error("Browser",i,"seats:",await entry.page.locator(".commander-crew-roster li").allInnerTexts());}catch{}
 }
 console.error(errors.join("\n"));
 throw error;
}finally{
 for(const item of pages)await item.context.close();
 await browser.close();
}
