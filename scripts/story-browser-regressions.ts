/** UI playthroughs, with isolated storage fault tests; never inject mission progress. */
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { historyMissions } from "../src/history/missionHistory";
const require=createRequire(import.meta.url);
const { chromium }=require(process.env.PLAYWRIGHT_MODULE||"/opt/codex/runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright");
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||"/usr/bin/chromium",headless:true,args:["--no-sandbox","--disable-dev-shm-usage","--enable-unsafe-swiftshader"]});
const context=await browser.newContext({viewport:{width:640,height:480},deviceScaleFactor:.7});
const page=await context.newPage();page.setDefaultTimeout(15000);
context.on("page",(p:any)=>{if(p!==page)p.close().catch(()=>{});});
const errors:string[]=[];page.on("pageerror",(e:Error)=>errors.push(e.message));
const base=process.env.BASE_URL||"http://127.0.0.1:4173";
const labels={brief:"Flight brief",systems:"Engineering",operations:"Mission operations",science:"Science / Data"};
type Station=keyof typeof labels;
const pos:Record<Station,{side:number;row:number}>={brief:{side:-1,row:1},systems:{side:1,row:1},operations:{side:-1,row:-1},science:{side:1,row:-1}};
const results:{id:string;title:string;tasks:number}[]=[];
async function aimed(label:string){return (await page.locator(".story-fps-target>span").allTextContents()).some((t:string)=>t.startsWith(label+" ·"));}
async function walk(key:string,predicate:()=>Promise<boolean>){
  if(await predicate())return;
  await page.keyboard.down(key);const end=Date.now()+45000;let found=false;
  try{while(Date.now()<end){if(await predicate()){found=true;break;}await page.waitForTimeout(70);}}
  finally{await page.keyboard.up(key);}
  await page.waitForTimeout(180);assert.ok(found,"Movement reached the actual HUD target");
}
try{
  await page.goto(base);await page.getByRole("button",{name:/Explore Space History/}).click();
  const selected=process.argv.includes("--regressions-only")?historyMissions.filter(m=>["history-1","history-2","history-16"].includes(m.id)):historyMissions;
  for(const m of selected){
    await page.getByRole("button",{name:"READ HISTORY",exact:true}).click();await page.getByRole("searchbox").fill(m.title);
    const card=page.locator(".history-card").filter({has:page.getByRole("heading",{name:m.title,exact:true})});
    await card.getByRole("button",{name:"Read story →",exact:true}).click();
    assert.equal(await page.locator(".history-story-panels article").count(),6);
    await page.locator(".history-story-actions").getByRole("button",{name:"Live the story",exact:true}).click();
    // These tests exercise the video gate, not external NASA video playback.
    if(await page.locator(".history-film-watch").count()){
      await page.locator(".history-film-watch").click();await page.getByRole("button",{name:"I WATCHED THE VIDEO · START LIVING THE MISSION →",exact:true}).click();
    }else{
      await page.getByRole("slider",{name:"Video position",exact:true}).focus();await page.keyboard.press("End");
      await page.getByRole("button",{name:"VIDEO FINISHED · LIVE THE MISSION →",exact:true}).click();
    }
    await page.getByRole("button",{name:"BEGIN 3D MISSION →",exact:true}).click();let done=0;
    if(m.title==="Apollo 11"){
      await page.getByRole("button",{name:"EVA / AIRLOCK",exact:true}).click();
      await page.getByRole("button",{name:"EQUIP PROTECTIVE SPACE SUIT",exact:true}).click();
      await page.getByRole("button",{name:"CLOSE INNER HATCH · SIMULATE DEPRESSURIZATION",exact:true}).click();
      await page.getByRole("button",{name:"OPEN OUTER HATCH · EXIT IN SUIT",exact:true}).click();done++;
      await page.waitForTimeout(15000);
      const before=await page.locator(".story-fps-suit-hud").innerText();
      await page.getByRole("button",{name:"II MENU",exact:true}).click();
      await page.keyboard.press("Space");await page.keyboard.down("w");await page.waitForTimeout(10000);await page.keyboard.up("w");
      assert.equal(await page.locator(".story-fps-suit-hud").innerText(),before,"paused oxygen and distance freeze");
      await page.getByRole("button",{name:"RESUME MISSION",exact:true}).click();
      const unfinished=await page.locator(".story-fps-objective>span").innerText();
      await page.getByRole("button",{name:"RETURN / AIRLOCK",exact:true}).click();
      await page.getByRole("button",{name:"CLOSE OUTER HATCH · REPRESSURIZE · ENTER",exact:true}).click();
      await page.getByRole("button",{name:"EVA / AIRLOCK",exact:true}).click();
      await page.getByRole("button",{name:"REPLENISH SUIT OXYGEN FROM CABIN",exact:true}).click();
      assert.match(await page.locator(".story-fps-readout").innerText(),/100%/);
      assert.equal(await page.locator(".story-fps-objective>span").innerText(),unfinished,"refill retains original objective");
      await page.getByRole("button",{name:"CLOSE INNER HATCH · SIMULATE DEPRESSURIZATION",exact:true}).click();
      await page.getByRole("button",{name:"OPEN OUTER HATCH · EXIT IN SUIT",exact:true}).click();
      await walk("w",()=>page.getByRole("button",{name:"EXAMINE LUNAR SOIL",exact:true}).isEnabled());
      for(const name of ["EXAMINE LUNAR SOIL","TAKE FIELD PHOTOGRAPH","COLLECT CONTINGENCY SAMPLE","DEPLOY FLAG WITH CREW"]){await page.getByRole("button",{name,exact:true}).click();done++;}
      await walk("s",async()=>/[12] m FROM HATCH/.test(await page.locator(".story-fps-suit-hud").innerText()));
      await page.getByRole("button",{name:"RETURN / AIRLOCK",exact:true}).click();await page.getByRole("button",{name:"CLOSE OUTER HATCH · REPRESSURIZE · ENTER",exact:true}).click();done++;
      console.log("PASS Apollo pause/resupply regression through real EVA UI");
    }else{
      let current:Station|null=null;
      for(let i=0;i<10;i++){
        if(await page.getByRole("button",{name:"SAVE COMPLETION & RETURN",exact:true}).isVisible())break;
        const instruction=await page.locator(".story-fps-instruction").innerText();
        const station=(Object.keys(labels) as Station[]).find(k=>instruction.includes(labels[k].toUpperCase()));assert.ok(station,instruction);
        if(current===null){await walk("w",()=>aimed(labels.brief));current="brief";}
        if(current!==station){
          const a=pos[current],b=pos[station];
          if(a.side!==b.side){const lateral=(Object.keys(pos) as Station[]).find(k=>pos[k].side===b.side&&pos[k].row===a.row)!;await walk(b.side<0?"a":"d",()=>aimed(labels[lateral]));current=lateral;}
          if(pos[current].row!==b.row){await walk(b.row>0?"s":"w",()=>aimed(labels[station]));current=station;}
        }
        await page.getByRole("button",{name:"INTERACT",exact:true}).click();const dialog=page.getByRole("dialog",{name:"Mission procedure",exact:true});
        if(station==="systems"){await dialog.getByRole("button",{name:"VERIFY POWER & THERMAL STATUS",exact:true}).click();await dialog.getByRole("button",{name:"VERIFY TELEMETRY & COMMUNICATIONS",exact:true}).click();}
        if(station==="operations")await dialog.getByRole("button",{name:/^ARM /}).first().click();
        if(station==="science")await dialog.getByRole("button",{name:"CAPTURE SCIENCE READING",exact:true}).click();
        await dialog.getByRole("checkbox").check();await dialog.getByRole("button",{name:/✓$/}).click();done++;
      }
    }
    if(m.id==="history-2"){
      // Fault injection changes storage availability only, never game progress.
      await page.evaluate(()=>{const original=Storage.prototype.setItem;(window as any).__restoreHistoryWrites=()=>{Storage.prototype.setItem=original;};Storage.prototype.setItem=function(k,v){if(k==="orbital-history-progress-v1")throw new DOMException("Audit quota","QuotaExceededError");return original.call(this,k,v);};});
      await page.getByRole("button",{name:"SAVE COMPLETION & RETURN",exact:true}).click();
      await page.getByRole("alert").filter({hasText:"Completion could not be saved"}).waitFor();
      assert.ok(await page.getByRole("dialog",{name:"Mission completed",exact:true}).isVisible());
      assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem("orbital-history-progress-v1")!)["history-1"]),2);
      await page.evaluate(()=>(window as any).__restoreHistoryWrites());
      await page.getByRole("button",{name:"RETRY SAVE COMPLETION & RETURN",exact:true}).click();
      console.log("PASS Story save failure keeps completed scene and previous progress; retry commits");
    }else await page.getByRole("button",{name:"SAVE COMPLETION & RETURN",exact:true}).click();
    await page.locator(".history-card").filter({has:page.getByRole("heading",{name:m.title,exact:true})}).locator(".history-done").waitFor();
    results.push({id:m.id,title:m.title,tasks:done});console.log("STORY_COMPLETED "+JSON.stringify(results.at(-1)));
  }
  await page.reload();await page.getByRole("button",{name:/Explore Space History/}).click();
  assert.match(await page.locator(".history-completions").innerText(),new RegExp(`^${results.length} / 55`));
  assert.deepEqual(errors,[]);console.log("STORY_BROWSER_SUMMARY "+JSON.stringify({completed:results.length,tasks:results.reduce((n,r)=>n+r.tasks,0),reloadVerified:true,errors}));
}catch(e){console.error("STORY_BROWSER_FAILED",e,await page.locator("body").innerText());process.exitCode=1;}
finally{await browser.close();}
