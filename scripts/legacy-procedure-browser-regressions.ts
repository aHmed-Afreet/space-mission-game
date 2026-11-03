/** Native saved-procedure compatibility gate, never a mission-completion proof.
 * A production preview must be running and the sole browser slot free.
 * Restore only an entire genuinely earned Mission7 revision3 storageState.
 */
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {decodeStore,SAVE_KEY} from '../src/commander/campaign/save';
import {missionForSession} from '../src/commander/campaign/definitions';
assert.equal(process.env.OTHER_BROWSER_STOPPED,'1','Caller must own the only browser slot');
assert.ok(process.env.LEGACY_M7_STORAGE_STATE,'Use a whole genuine legacy profile');
const input=process.env.LEGACY_M7_STORAGE_STATE,bytes=await readFile(input),profile=JSON.parse(bytes.toString());
const base=process.env.BASE_URL||'http://127.0.0.1:4173',origin=profile.origins.find((o:any)=>o.origin===new URL(base).origin);
assert.ok(origin);const values=Object.fromEntries(origin.localStorage.map((r:any)=>[r.name,r.value]));
const expected=decodeStore(values[SAVE_KEY]),session=expected.session!;
assert.equal(session.missionId,'mission-7');assert.equal(session.revision,3);assert.equal(session.report,undefined);
const procedure=missionForSession(session),expectedUi=Number(process.env.EXPECT_SAVED_UI_TOTAL||procedure.objectives.length);
assert.equal(procedure.objectives.length,58);assert.ok(expectedUi===58||expectedUi===59);
const artifacts=process.env.BROWSER_ARTIFACTS||'/tmp/legacy-procedure-browser';await mkdir(artifacts,{recursive:true});
const sha=(b:Buffer)=>createHash('sha256').update(b).digest('hex');await writeFile(artifacts+'/whole-genuine-input.json',bytes);
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_MODULE||'/opt/codex/runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
let context:any;const results:any[]=[];const errors:string[]=[];
try{
 context=await browser.newContext({storageState:input,viewport:{width:1024,height:768},deviceScaleFactor:.7,serviceWorkers:'block'});
 const page=await context.newPage();page.setDefaultTimeout(30000);page.on('pageerror',(e:Error)=>errors.push(e.message));
 const enter=async()=>{await page.goto(base,{waitUntil:'domcontentloaded'});await page.getByRole('button',{name:'ENTER COMMANDER',exact:true}).click();await page.getByRole('button',{name:/^Laptop /}).click();await page.getByRole('button',{name:'Continue →',exact:true}).click();};
 const current=async()=>page.evaluate((key:string)=>JSON.parse(localStorage.getItem(key)!),SAVE_KEY);
 const conserved=async(label:string)=>{const store=await current();assert.deepEqual(store.progress,expected.progress,label+': every prior score/archive/economy/outpost remains');assert.deepEqual(store.design,expected.design);assert.deepEqual(store.life,expected.life);assert.deepEqual(store.session,expected.session,label+': actual entire paused legacy session remains');return store;};
 const capture=async(label:string)=>{await page.screenshot({path:artifacts+'/'+label+'.png',fullPage:true});await context.storageState({path:artifacts+'/'+label+'-storage.json'});await writeFile(artifacts+'/'+label+'-state.json',JSON.stringify(await current(),null,2));};
 await enter();const text=await page.locator('.campaign-resume p').innerText();assert.equal(text,`Task ${session.objective+1} of ${expectedUi}. Progress is preserved.`);await conserved('native home');await capture('01-saved-summary');
 await page.getByRole('button',{name:'Resume mission →',exact:true}).click();await page.locator('.cmd-canvas canvas').waitFor();assert.equal(await page.getByRole('button',{name:'Resume mission',exact:true}).isVisible(),true,'Legacy scene remains paused; do not play or earn a new task');await conserved('actual paused3D resume');
 await page.getByRole('button',{name:'Open mission objectives',exact:true}).click();
 const tablet=page.getByRole('tabpanel',{name:'MISSION',exact:true});await tablet.waitFor();
 assert.match(await tablet.locator('.cmd-section-heading>span').innerText(),/\/\s*58$/,'Actual mission tablet uses its58-task legacy procedure');
 assert.match(await tablet.getByRole('status').innerText(),/Legacy procedure revision 3/);
 await conserved('actual legacy objective tablet');await capture('02-paused-legacy-3D');await page.getByRole('button',{name:'Close tablet',exact:true}).click();
 await page.getByRole('button',{name:'Save & campaign',exact:true}).click();await page.locator('.campaign-home').waitFor();await conserved('Save and campaign');await page.reload({waitUntil:'domcontentloaded'});await page.getByRole('button',{name:'ENTER COMMANDER',exact:true}).click();await page.getByRole('button',{name:/^Laptop /}).click();await page.getByRole('button',{name:'Continue →',exact:true}).click();
 assert.equal(await page.locator('.campaign-resume p').innerText(),text);await conserved('actual document reload');assert.deepEqual(errors,[]);await capture('03-actual-reload-summary');
 results.push({status:expectedUi===procedure.objectives.length?'PASS':'REPRODUCED_WRONG_HOME_TOTAL',input,inputSha256:sha(bytes),missionId:session.missionId,revision:session.revision,nextObjective:session.objective+1,actualProcedureTotal:procedure.objectives.length,displayedTotal:expectedUi,summary:text,normalUiResumeSaveReload:true,entirePausedSessionAndProgressConserved:true,errors});
}finally{if(context)await context.close();await browser.close();assert.equal(sha(await readFile(input)),sha(bytes),'Original profile file remains unchanged');await writeFile(artifacts+'/results.json',JSON.stringify({scope:'Actual native Home/paused3D/Save&campaign/full-reload with whole genuine revision3 profile. No unpause, new task, fabricated progress or mission PASS. EXPECT_SAVED_UI_TOTAL=59 explicitly reproduces old home defect while flight remains58.',results,errors},null,2));}
console.log(JSON.stringify({artifacts,results}));
