/** Actual React TouchActionButton native browser regression; no game/server.
 * Preparation: node --check scripts/touch-action-browser-regressions.mjs
 * Run serially: OTHER_BROWSER_STOPPED=1 BROWSER_ARTIFACTS=/unused/external/path
 *   node scripts/touch-action-browser-regressions.mjs
 * esbuild writes only an external fixture bundle. Playwright routes a virtual
 * fixture origin; no app/save/mission or second preview is opened. Programmatic
 * button.click is explicitly separate from trusted native input evidence.
 */
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFile,writeFile,mkdir,mkdtemp,readdir} from 'node:fs/promises';
import {dirname,join,resolve,relative} from 'node:path';
import {fileURLToPath} from 'node:url';
import {tmpdir} from 'node:os';
import {createHash} from 'node:crypto';

const repo=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const self=fileURLToPath(import.meta.url),sha=bytes=>createHash('sha256').update(bytes).digest('hex');
assert.equal(process.env.OTHER_BROWSER_STOPPED,'1','Root must release the sole gameplay browser before running this fixture.');
const busy=[];
for(const pid of await readdir('/proc')){
 if(!/^\d+$/.test(pid))continue;
 try{const comm=(await readFile('/proc/'+pid+'/comm','utf8')).trim(),stat=await readFile('/proc/'+pid+'/stat','utf8');
  if(/chrom(e|ium)/i.test(comm)&&stat.slice(stat.lastIndexOf(')')+2).split(' ')[0]!=='Z')busy.push({pid:Number(pid),comm});
 }catch{}
}
assert.deepEqual(busy,[],'Another live Chromium owns the serial slot.');
const out=process.env.BROWSER_ARTIFACTS?resolve(process.env.BROWSER_ARTIFACTS):await mkdtemp(join(tmpdir(),'touch-action-component-native-'));
assert.ok(relative(repo,out).startsWith('..'),'Fixture output must remain outside the repository.');
if(process.env.BROWSER_ARTIFACTS)await mkdir(out,{recursive:false});
const require=createRequire(import.meta.url),{build}=require('esbuild');
const sourceFiles=[self,join(repo,'src/TouchActionButton.tsx'),join(repo,'src/touchActivation.ts'),join(repo,'src/commander/modalFocus.ts')];
const sourceHashes=Object.fromEntries(await Promise.all(sourceFiles.map(async path=>[path,sha(await readFile(path))])));
for(const path of sourceFiles)await writeFile(join(out,'source-'+path.split('/').at(-1)),await readFile(path),{flag:'wx'});

const fixtureSource=String.raw`
import React,{useEffect,useRef,useState} from 'react';
import {createRoot} from 'react-dom/client';
import TouchActionButton from ${JSON.stringify(join(repo,'src/TouchActionButton.tsx'))};
import {useModalFocus} from ${JSON.stringify(join(repo,'src/commander/modalFocus.ts'))};
function Fixture(){
 const [counts,setCounts]=useState({pause:0,a:0,b:0,disabled:0,open:0,close:0});
 const [held,setHeld]=useState<Record<string,number[]>>({h1:[],h2:[],h3:[]});
 const [disableB,setDisableB]=useState(false),[modal,setModal]=useState(false);
 const pauseRef=useRef<HTMLButtonElement>(null),closeRef=useRef<HTMLButtonElement>(null),dialogRef=useRef<HTMLDivElement>(null);
 const bump=(id:keyof typeof counts)=>{window.__nativeFixtureTrace.activations.push({id,at:performance.now(),focused:document.activeElement?.id});setCounts(v=>({...v,[id]:v[id]+1}));};
 const release=(id:string,pointerId:number)=>setHeld(v=>({...v,[id]:v[id].filter(p=>p!==pointerId)}));
 useModalFocus({dialog:dialogRef,initialFocus:closeRef,active:modal,onClose:()=>setModal(false)});
 useEffect(()=>{
  window.__readActualTouchActionRefs=()=>({pauseTag:pauseRef.current?.tagName,pauseId:pauseRef.current?.id,
   pauseIsActual:pauseRef.current===document.getElementById('pause'),pauseIsFocused:pauseRef.current===document.activeElement,
   closeTag:closeRef.current?.tagName,closeId:closeRef.current?.id,closeIsActual:closeRef.current===document.getElementById('close-modal'),closeIsFocused:closeRef.current===document.activeElement});
  return()=>{delete window.__readActualTouchActionRefs;};
 },[]);
 return <main>
  <h1>Actual TouchActionButton component fixture</h1><p>No game, mission, save or physical-device claim.</p>
  <section aria-label="held continuous contact fixtures" className="row">
   {['h1','h2','h3'].map(id=><button type="button" id={id} key={id}
    onPointerDown={e=>{e.preventDefault();e.currentTarget.setPointerCapture(e.pointerId);setHeld(v=>({...v,[id]:[...new Set([...v[id],e.pointerId])]}));}}
    onPointerUp={e=>release(id,e.pointerId)} onPointerCancel={e=>release(id,e.pointerId)} onLostPointerCapture={e=>release(id,e.pointerId)}>Hold {id}</button>)}
  </section>
  <section aria-label="actual component actions" className="row actions">
   <TouchActionButton id="pause" ref={pauseRef} onActivate={()=>bump('pause')}
    onKeyDown={e=>window.__nativeFixtureTrace.forwardedKeys.push({key:e.key,code:e.code,trusted:e.nativeEvent.isTrusted})}>Pause action</TouchActionButton>
   <TouchActionButton id="a" onActivate={()=>bump('a')}>Action A</TouchActionButton>
   <TouchActionButton id="b" disabled={disableB} onActivate={()=>bump('b')}>Action B</TouchActionButton>
   <TouchActionButton id="disabled" disabled onActivate={()=>bump('disabled')}>Disabled action</TouchActionButton>
   <TouchActionButton id="open-modal" onActivate={()=>{bump('open');setModal(true);}}>Open fixture modal</TouchActionButton>
   <button id="toggle-b" type="button" onClick={()=>setDisableB(v=>!v)}>{disableB?'Enable B':'Disable B'}</button>
  </section>
  <section className="readings"><output id="counts">{JSON.stringify(counts)}</output><output id="held">{JSON.stringify(held)}</output><output id="react-version">{React.version}</output></section>
  <div id="drag-area">Empty native drag/release area</div>
  {modal&&<div className="modal" role="dialog" aria-label="Actual focus hook fixture" aria-modal="true" ref={dialogRef}>
   <h2>Actual useModalFocus integration</h2><TouchActionButton id="close-modal" ref={closeRef} onActivate={()=>{bump('close');setModal(false);}}>Close fixture modal</TouchActionButton>
  </div>}
 </main>;
}
createRoot(document.getElementById('root')!).render(<Fixture/>);
`;
const entry=join(out,'actual-component-fixture.tsx');await writeFile(entry,fixtureSource,{flag:'wx'});
const built=await build({absWorkingDir:repo,entryPoints:[entry],nodePaths:[join(repo,'node_modules')],bundle:true,write:false,
 platform:'browser',format:'iife',jsx:'automatic',define:{'process.env.NODE_ENV':'"production"'},target:'es2022',metafile:true,
 outfile:join(out,'actual-component-fixture.js'),logLevel:'silent'});
assert.equal(built.outputFiles.length,1);const bundle=built.outputFiles[0].contents;
await writeFile(join(out,'actual-component-fixture.js'),bundle,{flag:'wx'});
await writeFile(join(out,'esbuild-metafile.json'),JSON.stringify(built.metafile,null,2),{flag:'wx'});
const inputPaths=Object.keys(built.metafile.inputs).map(path=>resolve(repo,path));
for(const path of sourceFiles.slice(1))assert.ok(inputPaths.includes(path),'The fixture must bundle the real repository source: '+path);
assert.ok(inputPaths.some(path=>path.includes('/node_modules/react/')));assert.ok(inputPaths.some(path=>path.includes('/node_modules/react-dom/')));

const html=String.raw`<!doctype html><html><head><meta charset="utf-8"><link rel="icon" href="data:,"><title>Actual touch action component</title>
<style>*{box-sizing:border-box}body{margin:0;padding:20px;background:#142136;color:#f5f8ff;font:16px sans-serif;touch-action:none}h1{font-size:24px;margin:0 0 8px}p{margin:0 0 12px}.row{display:flex;flex-wrap:wrap;gap:12px;width:650px;margin-bottom:14px}button{width:200px;height:72px;font:16px sans-serif;color:white;background:#315a86;border:2px solid #a4ddff;border-radius:8px;touch-action:none}button:focus{outline:4px solid #ffe398}button:disabled{opacity:.5}.readings output{display:block;white-space:pre-wrap;margin:8px 0}#drag-area{margin-top:16px;width:650px;height:90px;border:2px dashed #839ab7;padding:15px}.modal{position:fixed;inset:140px 120px;background:#273e5d;border:4px solid white;padding:30px}</style></head><body><div id="root"></div>
<script>(()=>{const trace={events:[],activations:[],globalGameKeys:[],forwardedKeys:[]};Object.defineProperty(window,'__nativeFixtureTrace',{value:trace});
for(const type of ['pointerdown','pointermove','pointerup','pointercancel','gotpointercapture','lostpointercapture','click','keydown','keyup','focusin','focusout'])addEventListener(type,e=>{
 const button=e.target?.closest?.('button'),row={type,at:performance.now(),timeStamp:e.timeStamp,trusted:e.isTrusted,target:e.target?.id||e.target?.tagName,control:button?.id||null,pointerId:e.pointerId??null,pointerType:e.pointerType??null,isPrimary:e.isPrimary??null,detail:e.detail??null,key:e.key??null,code:e.code??null,x:e.clientX??null,y:e.clientY??null};trace.events.push(row);queueMicrotask(()=>row.defaultPreventedAfter=e.defaultPrevented);
},{capture:true});
// Reproduce the real game's bubbling Space prevention without game state.
addEventListener('keydown',e=>{trace.globalGameKeys.push({key:e.key,code:e.code,trusted:e.isTrusted});if(e.key===' '||e.key==='Spacebar')e.preventDefault();});})();</script>
<script src="/actual-component-fixture.js"></script></body></html>`;
await writeFile(join(out,'actual-component-fixture.html'),html,{flag:'wx'});
const origin='http://touch-action-fixture.invalid';
const report={status:'RUNNING_NOT_PASS',startedUtc:new Date().toISOString(),out,sourceHashes,bundleSha256:sha(bundle),
 scope:'Actual bundled React + repository TouchActionButton/touchActivation and real useModalFocus, served only through an explicitly labelled Playwright virtual fixture. Trusted CDP touch/mouse/keyboard; programmatic button.click labelled separately. No game or core completion.',
 limits:['Chromium touch emulation is not a physical-device or screen-reader certification.','The modal and held-contact controls are fixtures; the actual button/controller/focus hook are unmodified production source.','No gameplay browser/server/profile is opened or changed.'],
 cases:[],protocol:[],pageErrors:[],consoleErrors:[],unexpectedRequests:[],cleanup:{}};
const persist=()=>writeFile(join(out,'results.json'),JSON.stringify(report,null,2));await persist();
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'/opt/codex/runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
let browser,context,page,cdp,activeCase,stopping=false;
async function snapshot(){return page.evaluate(()=>({
 counts:JSON.parse(document.getElementById('counts').textContent),held:JSON.parse(document.getElementById('held').textContent),
 activeId:document.activeElement?.id,refs:window.__readActualTouchActionRefs(),reactVersion:document.getElementById('react-version').textContent,
 inertIds:[...document.querySelectorAll('[inert]')].map(e=>e.id||e.tagName),trace:window.__nativeFixtureTrace,
}));}
async function settled(){await page.waitForTimeout(100);return snapshot();}
function counts(state,expected,label){for(const [id,value]of Object.entries(expected))assert.equal(state.counts[id],value,label+': '+id+' activation count');}
function heldCount(state){return Object.values(state.held).flat().length;}
async function center(id){const box=await page.locator('#'+id).boundingBox();assert.ok(box,'Visible native target '+id);return{x:box.x+box.width/2,y:box.y+box.height/2};}
async function protocol(type,touchPoints,label){
 const row={case:activeCase.name,label,type,touchPoints,at:new Date().toISOString()};report.protocol.push(row);
 try{row.result=await cdp.send('Input.dispatchTouchEvent',{type,touchPoints});row.status='ACCEPTED';}catch(error){row.status='PROTOCOL_ERROR';row.error=String(error);throw error;}
}
function contacts(){
 const active=new Map();
 return{
  add:async(id,target)=>{assert.ok(!active.has(id));active.set(id,{id,...await center(target),radiusX:4,radiusY:4,force:1});await protocol('touchStart',[...active.values()],'down '+target);},
  move:async(id,point)=>{assert.ok(active.has(id));active.set(id,{...active.get(id),...point});await protocol('touchMove',[...active.values()],'move '+id);},
  end:async(id)=>{assert.ok(active.has(id));const lifted=active.get(id);await protocol('touchEnd',[lifted],'up only lifted '+id);active.delete(id);},
  cancel:async()=>{await protocol('touchCancel',[],'native cancel');active.clear();},
  tap:async(id,target)=>{assert.ok(!active.size);const point={id,...await center(target),radiusX:4,radiusY:4,force:1};await protocol('touchStart',[point],'tap down '+target);await protocol('touchEnd',[point],'tap up only lifted '+id);},
 };
}
async function runCase(name,body){
 activeCase={name,status:'RUNNING_NOT_PASS'};report.cases.push(activeCase);await persist();
 page=await context.newPage();page.setDefaultTimeout(15000);
 page.on('pageerror',error=>report.pageErrors.push({case:name,error:error.message}));
 page.on('console',message=>{if(message.type()==='error')report.consoleErrors.push({case:name,error:message.text()});});
 await page.goto(origin+'/',{waitUntil:'load'});
 await page.waitForFunction(()=>typeof window.__readActualTouchActionRefs==='function');
 cdp=await context.newCDPSession(page);await cdp.send('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:5});
 if(!report.browserVersion)report.browserVersion=await cdp.send('Browser.getVersion');
 const initial=await snapshot();assert.equal(initial.refs.pauseTag,'BUTTON');assert.equal(initial.refs.pauseIsActual,true,'React19 ref must point to the actual rendered button');
 activeCase.initial=initial;
 try{await body(contacts());activeCase.final=await settled();activeCase.status='PASS_ACTUAL_COMPONENT_NATIVE_FIXTURE';await page.screenshot({path:join(out,name+'.png'),fullPage:true});}
 finally{await writeFile(join(out,name+'-result.json'),JSON.stringify(activeCase,null,2));await persist();}
 await cdp.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]}).catch(()=>{});
 await cdp.detach();cdp=null;await page.close();page=null;
}
async function stop(signal){if(stopping)return;stopping=true;report.status='INTERRUPTED_NOT_PASS';report.signal=signal;if(browser)await browser.close().catch(()=>{});await persist();process.exit(signal==='SIGINT'?130:signal==='SIGHUP'?129:143);}
for(const signal of ['SIGINT','SIGTERM','SIGHUP'])process.once(signal,()=>void stop(signal));
try{
 browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,handleSIGINT:false,handleSIGTERM:false,handleSIGHUP:false,args:['--no-sandbox','--disable-dev-shm-usage']});
 context=await browser.newContext({viewport:{width:900,height:800},hasTouch:true,deviceScaleFactor:1,serviceWorkers:'block'});
 await context.route('**/*',async route=>{
  const url=route.request().url();
  if(url===origin+'/')return route.fulfill({status:200,contentType:'text/html; charset=utf-8',body:html});
  if(url===origin+'/actual-component-fixture.js')return route.fulfill({status:200,contentType:'text/javascript; charset=utf-8',body:Buffer.from(bundle)});
  report.unexpectedRequests.push(url);return route.abort();
 });
 await runCase('secondary-fourth-touch-pause',async touch=>{
  await touch.add(11,'h1');await touch.add(12,'h2');await touch.add(13,'h3');
  const held=await settled();assert.equal(heldCount(held),3);
  await touch.add(14,'pause');const down=await settled();counts(down,{pause:0},'press alone');
  const pointer=down.trace.events.find(e=>e.type==='pointerdown'&&e.control==='pause'&&e.trusted&&e.pointerType==='touch');
  assert.ok(pointer,'Actual trusted fourth pointerdown');assert.equal(pointer.isPrimary,false);
  await touch.end(14);const released=await settled();counts(released,{pause:1,a:0,b:0},'secondary release');
  assert.equal(heldCount(released),3,'Fourth-button release must preserve the three held controls');
  assert.ok(released.trace.events.some(e=>e.type==='pointerup'&&e.pointerId===pointer.pointerId&&e.trusted));
  assert.equal(released.refs.pauseIsFocused,true,'Touch activates/focuses the actual ref target');
  activeCase.secondaryPointerId=pointer.pointerId;activeCase.remainingHeldAfterRelease=released.held;
  await touch.end(13);await touch.end(12);await touch.end(11);counts(await settled(),{pause:1},'after all other releases');
 });
 await runCase('primary-touch-once-and-ref-focus',async touch=>{
  await touch.tap(21,'pause');const state=await settled();counts(state,{pause:1},'primary touch');
  assert.equal(state.refs.pauseTag,'BUTTON');assert.equal(state.refs.pauseIsActual,true);assert.equal(state.refs.pauseIsFocused,true);
  assert.ok(state.trace.events.some(e=>e.type==='pointerdown'&&e.control==='pause'&&e.isPrimary&&e.trusted));
  assert.ok(state.trace.events.some(e=>e.type==='pointerup'&&e.control==='pause'&&e.trusted));
 });
 await runCase('mouse-keyboard-assistive-and-game-key-propagation',async touch=>{
  await touch.tap(31,'pause');counts(await settled(),{pause:1},'initial touch');
  // Native mouse must continue to work immediately after touch suppression.
  await page.locator('#pause').click();let state=await settled();counts(state,{pause:2},'trusted mouse');
  assert.ok(state.trace.events.some(e=>e.type==='click'&&e.control==='pause'&&e.trusted&&e.pointerType==='mouse'));
  await page.keyboard.press('Space');state=await settled();counts(state,{pause:3},'native Space');
  await page.keyboard.press('Enter');state=await settled();counts(state,{pause:4},'native Enter');
  assert.deepEqual(state.trace.globalGameKeys.filter(e=>e.key===' '||e.key==='Enter'),[],'Focused button keys must not reach global game prevention');
  assert.deepEqual(state.trace.forwardedKeys.filter(e=>e.key===' '||e.key==='Enter').map(e=>e.key),[' ','Enter'],'The optional onKeyDown prop still receives both actual keys');
  await page.keyboard.press('w');state=await settled();counts(state,{pause:4},'W is movement, not activation');
  assert.equal(state.trace.globalGameKeys.filter(e=>e.key==='w'&&e.trusted).length,1,'WASD must still reach the game listener');
  // Standard DOM activation is explicitly an untrusted assistive-contract case,
  // separate from the trusted native hardware-input evidence above.
  await page.locator('#pause').evaluate(button=>button.click());state=await settled();counts(state,{pause:5},'programmatic assistive-style activation');
  assert.ok(state.trace.events.some(e=>e.type==='click'&&e.control==='pause'&&!e.trusted&&e.detail===0));
  activeCase.assistiveScope='Standard HTMLElement.click/detail0 contract, not a real screen-reader/device claim';
 });
 await runCase('native-cancellation-and-recovery',async touch=>{
  await touch.add(41,'pause');await touch.cancel();let state=await settled();counts(state,{pause:0},'cancelled touch');
  assert.ok(state.trace.events.some(e=>e.type==='pointercancel'&&e.control==='pause'&&e.trusted));
  await touch.tap(42,'pause');state=await settled();counts(state,{pause:1},'new contact after cancellation');
 });
 await runCase('drag-outside-and-recovery',async touch=>{
  await touch.add(51,'pause');await touch.move(51,await center('drag-area'));await touch.end(51);
  counts(await settled(),{pause:0},'release outside captured button');
  await touch.tap(52,'pause');counts(await settled(),{pause:1},'new contact after drag out');
 });
 await runCase('disabled-native-and-programmatic-none',async touch=>{
  await touch.tap(61,'disabled');const point=await center('disabled');await page.mouse.click(point.x,point.y);
  await page.locator('#disabled').evaluate(button=>button.click());counts(await settled(),{disabled:0,pause:0},'disabled actions');
 });
 await runCase('disabled-between-contact-down-and-up',async touch=>{
  await touch.add(71,'b');await page.locator('#toggle-b').click();assert.equal(await page.locator('#b').isDisabled(),true);
  await touch.end(71);counts(await settled(),{b:0},'disabled release');
  await page.locator('#toggle-b').click();assert.equal(await page.locator('#b').isEnabled(),true);
  await touch.tap(72,'b');counts(await settled(),{b:1},'new enabled contact');
 });
 await runCase('distinct-buttons-own-distinct-contacts',async touch=>{
  await touch.add(81,'a');await touch.add(82,'b');await touch.end(82);
  let state=await settled();counts(state,{a:0,b:1},'release B independently');
  await touch.end(81);state=await settled();counts(state,{a:1,b:1},'release A independently');
  const downs=state.trace.events.filter(e=>e.type==='pointerdown'&&['a','b'].includes(e.control)&&e.trusted);
  assert.equal(new Set(downs.map(e=>e.pointerId)).size,2,'Distinct buttons must use actual distinct native IDs');
 });
 await runCase('same-button-second-contact-cannot-steal',async touch=>{
  await touch.add(91,'a');await touch.add(92,'a');await touch.end(92);counts(await settled(),{a:0},'unowned second contact release');
  await touch.end(91);counts(await settled(),{a:1},'original owned contact release');
 });
 await runCase('actual-ref-modal-focus-restoration',async touch=>{
  await touch.tap(101,'open-modal');await page.getByRole('dialog',{name:'Actual focus hook fixture',exact:true}).waitFor();
  let state=await settled();counts(state,{open:1,close:0},'open modal by primary touch');
  assert.equal(state.refs.closeTag,'BUTTON');assert.equal(state.refs.closeIsActual,true);assert.equal(state.refs.closeIsFocused,true,'Real hook receives actual forwarded close-button ref');
  await page.keyboard.press('Escape');await page.getByRole('dialog',{name:'Actual focus hook fixture',exact:true}).waitFor({state:'hidden'});
  state=await settled();assert.equal(state.activeId,'open-modal','Actual modal hook restores the touch trigger focus');assert.deepEqual(state.inertIds,[]);
  counts(state,{open:1,close:0},'Escape closes without an extra activation');
 });
 assert.deepEqual(report.pageErrors,[]);assert.deepEqual(report.consoleErrors,[]);assert.deepEqual(report.unexpectedRequests,[]);
 for(const path of sourceFiles)assert.equal(sha(await readFile(path)),sourceHashes[path],'Source changed during the native fixture: '+path);
 assert.ok(report.cases.every(row=>row.status==='PASS_ACTUAL_COMPONENT_NATIVE_FIXTURE'));
 report.status='PASS_ACTUAL_COMPONENT_NATIVE_FIXTURE_NOT_GAMEPLAY';report.finishedUtc=new Date().toISOString();await persist();
 console.log(JSON.stringify({status:report.status,out,cases:report.cases.map(r=>({name:r.name,status:r.status})),bundleSha256:report.bundleSha256}));
}catch(error){
 report.status='FAIL_ACTUAL_COMPONENT_FIXTURE';report.failure=String(error?.stack||error);
 if(page){if(activeCase)activeCase.failureObservation=await snapshot().catch(()=>null);await page.screenshot({path:join(out,'failure.png'),fullPage:true}).catch(()=>{});}
 console.error('TOUCH_ACTION_BROWSER_FAILED',report.failure);process.exitCode=1;
}finally{
 if(cdp)await cdp.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]}).catch(()=>{});
 if(cdp)await cdp.detach().catch(()=>{});if(context)await context.close().catch(error=>report.cleanup.contextCloseError=String(error));
 if(browser)await browser.close().catch(error=>report.cleanup.browserCloseError=String(error));report.cleanup.closedUtc=new Date().toISOString();await persist();
}
