/** Actual Tutorial pause/resume/remounted-trigger focus regression.
 * Supply a whole genuinely earned paused Mission1 objective17 profile, not a
 * fabricated pose/goal. This is a controls check, never a core mission PASS.
 */
import assert from 'node:assert/strict';import {createRequire} from 'node:module';
import {readFile,writeFile,mkdir,readdir} from 'node:fs/promises';import {resolve,dirname,relative,join} from 'node:path';
import {fileURLToPath} from 'node:url';import {createHash} from 'node:crypto';
const repo=resolve(dirname(fileURLToPath(import.meta.url)),'..'),sha=b=>createHash('sha256').update(b).digest('hex');
assert.equal(process.env.OTHER_BROWSER_STOPPED,'1');assert.ok(process.env.EARNED_STORAGE_STATE&&process.env.DIST_DIR&&process.env.BROWSER_ARTIFACTS);
for(const pid of await readdir('/proc'))if(/^\d+$/.test(pid)){try{const comm=await readFile('/proc/'+pid+'/comm','utf8'),stat=await readFile('/proc/'+pid+'/stat','utf8');assert.ok(!/chrom(e|ium)/i.test(comm)||stat.slice(stat.lastIndexOf(')')+2).split(' ')[0]==='Z','Another live browser: '+pid);}catch(e){if(e.code!=='ENOENT'&&e.code!=='ESRCH')throw e;}}
const input=resolve(process.env.EARNED_STORAGE_STATE),bytes=await readFile(input),profile=JSON.parse(bytes),base='http://127.0.0.1:4173',key='orbital-campaign-v3';
const original=JSON.parse(profile.origins.find(o=>o.origin===base).localStorage.find(r=>r.name===key).value);assert.equal(original.session.missionId,'mission-1');assert.equal(original.session.objective,17,'This genuine task has the supplies tutorial; objective0 has none');assert.equal(original.session.state.paused,true);assert.ok(!original.session.report&&!original.session.state.ended);
const out=resolve(process.env.BROWSER_ARTIFACTS);assert.ok(relative(repo,out).startsWith('..'));await mkdir(out,{recursive:false});await writeFile(out+'/whole-genuine-input.json',bytes);
const dist=resolve(process.env.DIST_DIR),indexSha256=sha(await readFile(join(dist,'index.html')));assert.equal(sha(Buffer.from(await(await fetch(base)).text())),indexSha256);
const sourceFiles=['scripts/tutorial-focus-browser-regressions.mjs','src/commander/campaign/Flight.tsx','src/TouchActionButton.tsx','src/commander/modalFocus.ts'];
const sources=Object.fromEntries(await Promise.all(sourceFiles.map(async n=>[n,sha(await readFile(join(repo,n)))])));
const report={status:'RUNNING',input,inputSha256:sha(bytes),dist,indexSha256,sources,scope:'Whole genuine objective17 profile. Actual normal resume, explicit Tutorial open, native Escape/Close, logical remounted-button focus. No goal/resource/pose/time/focus injection after close. Resources may advance during real live seconds.',cases:[],errors:[]};const persist=()=>writeFile(out+'/results.json',JSON.stringify(report,null,2));await persist();
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_MODULE||'/opt/codex/runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});let context,page;
async function saved(){return page.evaluate(key=>JSON.parse(localStorage.getItem(key)),key);}
async function capture(label){const d=await saved();assert.equal(d.session.id,original.session.id);assert.equal(d.session.objective,original.session.objective);assert.deepEqual(d.session.completed,original.session.completed);assert.deepEqual(d.progress.completed,original.progress.completed);await context.storageState({path:out+'/'+label+'-storage.json'});await page.screenshot({path:out+'/'+label+'.png',fullPage:true});return d;}
try{
 context=await browser.newContext({storageState:input,viewport:{width:1024,height:768},deviceScaleFactor:.7,hasTouch:true,serviceWorkers:'block'});page=await context.newPage();page.on('pageerror',e=>report.errors.push(e.message));
 await page.goto(base);await page.getByRole('button',{name:'ENTER COMMANDER',exact:true}).click();await page.getByRole('button',{name:/^Laptop /}).click();await page.getByRole('button',{name:'Continue →',exact:true}).click();await page.getByRole('button',{name:'Open Orbital Training campaign levels',exact:true}).click();await page.getByRole('button',{name:'Resume mission →',exact:true}).click();await page.locator('.cmd-canvas canvas').waitFor();await page.getByRole('button',{name:'Resume mission',exact:true}).click();
 const trigger=page.getByRole('button',{name:'ⓘ VIEW TUTORIAL (OPTIONAL)',exact:true}),dialog=page.locator('.campaign-tutorial[role="dialog"]');
 for(const closeMode of ['Escape','visible-close']){
  await trigger.waitFor();const old=await trigger.elementHandle();
  if(closeMode==='Escape'){await trigger.focus();await page.keyboard.press('Enter');}else await trigger.tap();
  await dialog.waitFor();await page.waitForFunction(key=>JSON.parse(localStorage.getItem(key)).session.state.paused===true,key);const close=dialog.getByRole('button',{name:'Got it →',exact:true});assert.equal(await close.evaluate(el=>document.activeElement===el),true);await page.keyboard.press('Tab');assert.equal(await dialog.evaluate(el=>el.contains(document.activeElement)),true);
  await capture(closeMode+'-paused-inside-tutorial');assert.equal(await old.evaluate(el=>el.isConnected),false,'Opening tutorial removes the old guidance trigger');
  if(closeMode==='Escape')await page.keyboard.press('Escape');else await close.click();
  await dialog.waitFor({state:'hidden'});await trigger.waitFor();await page.waitForFunction(()=>document.activeElement?.matches('.campaign-tutorial-manual'));
  const focus=await trigger.evaluate(el=>({logicalTriggerFocused:document.activeElement===el,connected:el.isConnected,inert:!!el.closest('[inert]'),text:el.textContent}));assert.equal(focus.logicalTriggerFocused,true);assert.equal(focus.inert,false);await page.getByRole('button',{name:'Pause mission',exact:true}).waitFor();
  await capture(closeMode+'-logical-trigger-restored');report.cases.push({name:closeMode,status:'PASS',oldNodeDisconnected:true,focus});await persist();await old.dispose();
 }
 await page.getByRole('button',{name:'Pause mission',exact:true}).click();await page.waitForFunction(key=>JSON.parse(localStorage.getItem(key)).session.state.paused===true,key);await capture('final-normal-pause');assert.deepEqual(report.errors,[]);for(const n of sourceFiles)assert.equal(sha(await readFile(join(repo,n))),sources[n]);report.status='PASS_NATIVE_TUTORIAL_LOGICAL_FOCUS_NOT_GAMEPLAY';
}catch(e){report.status='FAIL_NATIVE_TUTORIAL_LOGICAL_FOCUS';report.failure=String(e.stack||e);process.exitCode=1;if(page)await page.screenshot({path:out+'/failure.png',fullPage:true}).catch(()=>{});}
finally{if(context)await context.close();await browser.close();report.originalFileUnchanged=sha(await readFile(input))===sha(bytes);await persist();}
console.log(JSON.stringify({status:report.status,out,cases:report.cases,failure:report.failure}));
