import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||"/opt/codex/runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright");
const base=process.env.BASE_URL||"http://127.0.0.1:4173";
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||"/usr/bin/chromium",headless:true,args:["--no-sandbox","--disable-dev-shm-usage"]});
try{
  const context=await browser.newContext({serviceWorkers:"allow"});const page=await context.newPage();const errors:string[]=[];
  page.on("pageerror",(e:Error)=>errors.push(e.message));
  await page.goto(base);await page.evaluate(async()=>{await navigator.serviceWorker.ready;});
  await page.reload();await page.waitForFunction(()=>!!navigator.serviceWorker.controller);
  await context.setOffline(true);await page.goto(base+"/privacy.html");assert.match(await page.locator("h1").innerText(),/Privacy/);
  await page.goto(base+"/");await page.getByRole("button",{name:/Explore Space History/}).click();
  await page.getByRole("searchbox").waitFor();assert.match(await page.locator(".history-result-count").innerText(),/55 missions found/);
  await page.getByRole("button",{name:"← Main menu",exact:true}).click();
  await page.getByRole("button",{name:/Build & Launch Missions/}).click();await page.locator(".strategy-level-grid").waitFor();
  assert.equal(await page.locator(".strategy-level").count(),20);assert.deepEqual(errors,[]);
  console.log("PASS installed production worker: offline privacy, app reload, lazy History and all20 Strategy board, no page errors");
}finally{await browser.close();}
