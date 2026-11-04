/** Actual earned Strategy debrief -> normal Resume UI -> native Print/PDF.
 * OTHER_BROWSER_STOPPED=1 DIST_DIR=/actual/served/production/dist
 * EARNED_STORAGE_STATE=/whole/genuine/stage6-storage.json
 * BROWSER_ARTIFACTS=/unused/external/path node scripts/strategy-print-browser-regressions.mjs
 * Starts no server/mission; no DOM report fabrication, print stub, storage writes
 * or original-profile edits. Uses installed pdftotext to inspect actual PDFs.
 */
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFile,writeFile,mkdir,readdir,realpath} from 'node:fs/promises';
import {resolve,dirname,relative,join,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
const repo=resolve(dirname(fileURLToPath(import.meta.url)),'..'),base='http://127.0.0.1:4173';
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const normalize=text=>text.normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]/gu,'');
assert.equal(process.env.OTHER_BROWSER_STOPPED,'1','Root must own the sole browser slot.');
assert.ok(process.env.DIST_DIR&&process.env.EARNED_STORAGE_STATE&&process.env.BROWSER_ARTIFACTS,'Supply served dist, entire genuine saved report profile and unused external output.');
const busy=[];for(const pid of await readdir('/proc')){if(!/^\d+$/.test(pid))continue;try{const comm=(await readFile('/proc/'+pid+'/comm','utf8')).trim(),stat=await readFile('/proc/'+pid+'/stat','utf8');if(/chrom(e|ium)/i.test(comm)&&stat.slice(stat.lastIndexOf(')')+2).split(' ')[0]!=='Z')busy.push({pid:Number(pid),comm});}catch{}}
assert.deepEqual(busy,[],'Another live Chromium owns the slot.');
const input=await realpath(process.env.EARNED_STORAGE_STATE),bytes=await readFile(input),inputSha256=sha(bytes),profile=JSON.parse(bytes);
assert.ok(Array.isArray(profile.cookies)&&Array.isArray(profile.origins),'Entire genuine Playwright storageState required.');
const originalOrigin=profile.origins.filter(o=>o.origin===base);assert.equal(originalOrigin.length,1);
const originalEntries=originalOrigin[0].localStorage.map(e=>[e.name,e.value]).sort(([a],[b])=>a.localeCompare(b));
const values=Object.fromEntries(originalEntries),attempt=JSON.parse(values['orbital-strategy-attempt-v1']);
assert.equal(attempt.stage,6,'Use the actual saved earned stage6 report, not scores or fabricated report DOM.');
assert.equal(attempt.choices.length,3);assert.equal(attempt.log.length,3);
const missionId='strategy-'+(attempt.challengeIndex+1),summary=JSON.parse(values['orbital-strategy-levels-v1']);
assert.ok(summary[missionId]>0&&values['orbital-strategy-best-v1:'+missionId+':'+summary[missionId]]==='earned','Original native saved best/receipt required.');
const out=resolve(process.env.BROWSER_ARTIFACTS),outside=relative(repo,out);assert.ok(outside==='..'||outside.startsWith('..'+sep),'All outputs must remain outside the repository.');await mkdir(out,{recursive:false});
await writeFile(join(out,'whole-genuine-earned-input.json'),bytes,{flag:'wx'});
const dist=await realpath(process.env.DIST_DIR),indexBytes=await readFile(join(dist,'index.html'));
const indexResponse=await fetch(base,{cache:'no-store',signal:AbortSignal.timeout(20000)});assert.equal(indexResponse.status,200);assert.equal(sha(Buffer.from(await indexResponse.arrayBuffer())),sha(indexBytes),'Wrong served production index.');
const sources=['scripts/strategy-print-browser-regressions.mjs','src/style.css','src/strategyPlanning.css','src/App.tsx'];
const sourceHashes=Object.fromEntries(await Promise.all(sources.map(async name=>[name,sha(await readFile(join(repo,name)))])));
for(const name of sources)await writeFile(join(out,name.replaceAll('/','__')),await readFile(join(repo,name)),{flag:'wx'});
const cssFiles=(await readdir(join(dist,'assets'))).filter(name=>name.endsWith('.css'));
const cssHashes=Object.fromEntries(await Promise.all(cssFiles.map(async name=>['assets/'+name,sha(await readFile(join(dist,'assets',name)))])));
execFileSync(process.env.PDFTOTEXT||'pdftotext',['-v'],{stdio:'ignore'});
const report={status:'RUNNING_NOT_PASS',startedUtc:new Date().toISOString(),input,inputSha256,missionId,attemptId:attempt.id,
 dist,indexSha256:sha(indexBytes),sourceHashes,cssHashes,
 scope:'Actual complete genuinely earned saved Strategy attempt restored whole and opened by ordinary Review saved debrief UI. Trusted Print report click plus real Chromium PDFs with backgrounds ON/OFF, native print computed contrast/visibility/overflow and actual extracted PDF text. No new core completion, OS dialog/printer or physical-paper claim.',
 cases:[],errors:[],cleanup:{}};
const persist=()=>writeFile(join(out,'results.json'),JSON.stringify(report,null,2));await persist();
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_MODULE||'/opt/codex/runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
let browser,context,page,stopping=false;
async function conserved(label){const current=await page.evaluate(()=>Object.entries(localStorage).sort(([a],[b])=>a.localeCompare(b)));assert.deepEqual(current,originalEntries,label+': entire original-origin earned storage must remain byte-identical');assert.equal(sha(await readFile(input)),inputSha256,'Original input file changed');}
async function stop(signal){if(stopping)return;stopping=true;report.status='INTERRUPTED_NOT_PASS';report.signal=signal;if(context)await context.storageState({path:join(out,'interrupted-whole-storage.json')}).catch(()=>{});if(browser)await browser.close().catch(()=>{});await persist();process.exit(signal==='SIGINT'?130:signal==='SIGHUP'?129:143);}
for(const signal of ['SIGINT','SIGTERM','SIGHUP'])process.once(signal,()=>void stop(signal));
try{
 browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,handleSIGINT:false,handleSIGTERM:false,handleSIGHUP:false,args:['--no-sandbox','--disable-dev-shm-usage']});
 context=await browser.newContext({storageState:input,viewport:{width:1280,height:900},deviceScaleFactor:1,serviceWorkers:'block'});
 await context.addInitScript({content:`(()=>{const original=window.print,events=[];for(const type of ['beforeprint','afterprint'])addEventListener(type,e=>events.push({type,trusted:e.isTrusted,at:performance.now()}));addEventListener('click',e=>{if(e.target?.closest?.('button')?.textContent?.trim()==='Print report')events.push({type:'Print report click',trusted:e.isTrusted,at:performance.now()});},{capture:true});Object.defineProperty(window,'__nativeStrategyPrintRegression',{value:()=>({events:[...events],nativePrintUnchanged:window.print===original,nativePrintSource:String(window.print)})});})();`});
 page=await context.newPage();page.setDefaultTimeout(20000);page.on('pageerror',error=>report.errors.push(error.message));
 await page.goto(base,{waitUntil:'domcontentloaded'});await page.getByRole('button',{name:/Build & Launch Missions/}).click();
 await page.getByRole('button',{name:'Review saved debrief →',exact:true}).click();await page.locator('.report-hero').waitFor();
 await page.getByRole('status').filter({hasText:'Progress saved in this browser.'}).waitFor();await page.evaluate(()=>document.fonts.ready);
 assert.equal(await page.locator('.report-metric').count(),5);assert.equal(await page.locator('.log p').count(),3);
 assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('orbital-strategy-attempt-v1')).id),attempt.id);
 await conserved('normal saved-debrief UI resume');
 report.screen={text:await page.locator('.app main').innerText(),css:await page.evaluate(()=>[...document.styleSheets].map(sheet=>sheet.href).filter(Boolean)),scienceDetailsInitiallyOpen:await page.locator('.strategy-energy details').evaluate(el=>el.open)};
 await page.screenshot({path:join(out,'actual-earned-report-screen.png'),fullPage:true});
 // textContent supplies real closed-disclosure text too; nothing is fabricated
 // or expanded in the DOM. Every report text node must print visibly.
 const expected=await page.locator('.app main').evaluate(main=>{
  const chunks=[],walker=document.createTreeWalker(main,NodeFilter.SHOW_TEXT);let node;
  while(node=walker.nextNode()){const text=node.textContent.trim();if(text&&!node.parentElement.closest('.actions,.strategy-attempt-actions,button,script,style'))chunks.push(text);}
  return [...new Set(chunks)];
 });
 report.expectedReportTextChunks=expected;assert.ok(expected.some(text=>text.includes('not a real-world probability')));assert.ok(expected.some(text=>text.includes('not mission measurements')));
 assert.ok(attempt.log.every(line=>expected.includes(line)),'All3 actual earned decision records must be in the report.');
 for(const href of report.screen.css){const url=new URL(href);assert.equal(url.origin,base);const path=url.pathname.slice(1);assert.ok(cssHashes[path],'Actual CSS is outside the supplied build');const response=await fetch(url,{cache:'no-store',signal:AbortSignal.timeout(20000)});assert.equal(response.status,200);assert.equal(sha(Buffer.from(await response.arrayBuffer())),cssHashes[path],'Wrong served actual report stylesheet');}
 const initialPrint=await page.evaluate(()=>window.__nativeStrategyPrintRegression());assert.match(initialPrint.nativePrintSource,/\[native code\]/);
 await page.getByRole('button',{name:'Print report',exact:true}).click();
 const clicked=await page.evaluate(()=>window.__nativeStrategyPrintRegression());assert.equal(clicked.nativePrintUnchanged,true);assert.ok(clicked.events.some(e=>e.type==='Print report click'&&e.trusted),'Trusted actual Print report input required');report.nativePrintClick=clicked;
 assert.ok(clicked.events.slice(initialPrint.events.length).some(e=>e.type==='beforeprint'&&e.trusted),'Actual native print must run from the button before emulateMedia or page.pdf can trigger print events.');
 await conserved('native Print report click');
 // A4 content width: (210mm - 2*14mm) * 96 / 25.4. This also
 // checks the print layout at its actual paper content width, without scaling.
 await page.setViewportSize({width:688,height:1000});await page.emulateMedia({media:'print'});await page.evaluate(()=>document.fonts.ready);
 const printObservation=await page.locator('.app main').evaluate(main=>{
  const rgba=value=>{const n=value.match(/[\d.]+/g)?.map(Number);return n?[n[0],n[1],n[2],n[3]??1]:null;};
  const luminance=rgb=>rgb.slice(0,3).map(v=>{const c=v/255;return c<=.04045?c/12.92:((c+.055)/1.055)**2.4;}).reduce((s,c,i)=>s+c*[.2126,.7152,.0722][i],0);
  const rows=[],walker=document.createTreeWalker(main,NodeFilter.SHOW_TEXT);let node;
  while(node=walker.nextNode()){
   const text=node.textContent.trim(),parent=node.parentElement;if(!text||parent.closest('.actions,.strategy-attempt-actions,button,script,style'))continue;
   const style=getComputedStyle(parent),chain=[];for(let el=parent;el;el=el.parentElement)chain.unshift(el);
   let background=[255,255,255,1],opacity=1;const images=[];let hidden=false;
   for(const el of chain){const s=getComputedStyle(el),c=rgba(s.backgroundColor);if(c)background=[0,1,2].map(i=>c[i]*c[3]+background[i]*(1-c[3])).concat(1);opacity*=Number(s.opacity);if(s.backgroundImage!=='none')images.push({tag:el.tagName,className:el.className,image:s.backgroundImage});if(s.display==='none'||s.visibility==='hidden')hidden=true;}
   const range=document.createRange();range.selectNodeContents(node);const rects=[...range.getClientRects()].filter(r=>r.width>0&&r.height>0).map(r=>({x:r.x,y:r.y,width:r.width,height:r.height,right:r.right,bottom:r.bottom}));
   const foreground=rgba(style.webkitTextFillColor)||rgba(style.color),composite=foreground?foreground.slice(0,3).map((v,i)=>v*foreground[3]*opacity+background[i]*(1-foreground[3]*opacity)):null;
   const a=composite?luminance(composite):0,b=luminance(background),contrast=(Math.max(a,b)+.05)/(Math.min(a,b)+.05);
   rows.push({text,color:style.color,textFillColor:style.webkitTextFillColor,fontSize:parseFloat(style.fontSize),background,contrast,opacity,hidden,rects,images,horizontalOverflow:rects.some(r=>r.x<-.5||r.right>innerWidth+.5)});
  }
  const surfaces=['html','body','#root','.app','.report-hero','.report-metric','.strategy-energy','.strategy-result','.log'].map(selector=>[...document.querySelectorAll(selector)].map(el=>{const s=getComputedStyle(el);return{selector,background:s.backgroundColor,image:s.backgroundImage,color:s.color};})).flat();
  return{rows,surfaces,viewport:{width:innerWidth,height:innerHeight},documentWidth:document.documentElement.scrollWidth,
   hiddenControls:[...document.querySelectorAll('.cmd-mode-bar,.app > header,.app .layout > aside,.app .actions,.app .strategy-attempt-actions')].map(el=>({className:el.className,display:getComputedStyle(el).display})),
   details:{open:main.querySelector('.strategy-energy details').open,pseudoContentVisibility:getComputedStyle(main.querySelector('.strategy-energy details'),'::details-content').contentVisibility}};
 });
 report.nativeComputedPrint=printObservation;await writeFile(join(out,'actual-native-print-contrast.json'),JSON.stringify(printObservation,null,2),{flag:'wx'});await persist();
 const hiddenText=printObservation.rows.filter(row=>row.hidden||!row.rects.length||row.opacity<.99),badContrast=printObservation.rows.filter(row=>row.contrast<4.5||row.images.length),smallText=printObservation.rows.filter(row=>row.fontSize<11.9),overflow=printObservation.rows.filter(row=>row.horizontalOverflow);
 assert.deepEqual(hiddenText,[],'All actual report values/decision logs/science disclaimers must remain visible in print, including closed details');
 assert.deepEqual(badContrast,[],'All actual print text must reach4.5:1 with no dark/gradient background');assert.deepEqual(smallText,[],'Report print text must remain at least9pt');
 assert.deepEqual(overflow,[],'No actual report text may overflow the A4 content width');assert.ok(printObservation.documentWidth<=689);
 for(const surface of printObservation.surfaces){assert.equal(surface.image,'none');assert.ok(/rgba?\((?:255, 255, 255|0, 0, 0, 0)\)/.test(surface.background),'Print surface must be white or transparent: '+surface.selector+' '+surface.background);}
 assert.ok(printObservation.hiddenControls.every(control=>control.display==='none'),'Nonreport navigation/actions should be hidden');
 await page.screenshot({path:join(out,'actual-earned-report-print-media.png'),fullPage:true});
 for(const printBackground of [true,false]){
  const label=printBackground?'backgrounds-on':'backgrounds-off',pdfPath=join(out,'actual-earned-report-'+label+'.pdf');
  const pdf=await page.pdf({path:pdfPath,format:'A4',preferCSSPageSize:true,printBackground,scale:1});assert.equal(pdf.subarray(0,5).toString(),'%PDF-');assert.ok(pdf.length>1000);
  const textPath=join(out,'actual-earned-report-'+label+'.txt');execFileSync(process.env.PDFTOTEXT||'pdftotext',['-enc','UTF-8','-raw',pdfPath,textPath]);
  const extracted=await readFile(textPath,'utf8'),normalized=normalize(extracted),missing=expected.filter(chunk=>normalize(chunk)&&!normalized.includes(normalize(chunk)));
  const row={label,printBackground,pdfPath,pdfSha256:sha(pdf),pdfBytes:pdf.length,textPath,pdfPages:Math.max(1,(extracted.match(/\f/g)||[]).length),missingReportChunks:missing,nativePrint:await page.evaluate(()=>window.__nativeStrategyPrintRegression())};report.cases.push(row);await persist();
  assert.deepEqual(missing,[],'Actual PDF must retain every earned report text chunk');assert.equal(row.nativePrint.nativePrintUnchanged,true);await conserved('actual PDF '+label);
 }
 await page.emulateMedia({media:'screen'});await conserved('after all print output');await context.storageState({path:join(out,'final-whole-conserved-storage.json')});
 assert.deepEqual(report.errors,[]);for(const name of sources)assert.equal(sha(await readFile(join(repo,name))),sourceHashes[name],'Source changed during native regression: '+name);
 for(const [path,hash]of Object.entries(cssHashes))assert.equal(sha(await readFile(join(dist,path))),hash,'Served build stylesheet changed during regression');
 report.status='PASS_NATIVE_EARNED_STRATEGY_PRINT_CONTRAST_AND_PDF';report.finishedUtc=new Date().toISOString();await persist();console.log(JSON.stringify({status:report.status,out,cases:report.cases.map(r=>({label:r.label,pdfPath:r.pdfPath,pdfPages:r.pdfPages,missing:r.missingReportChunks.length}))}));
}catch(error){report.status='FAIL_NATIVE_STRATEGY_PRINT';report.failure=String(error?.stack||error);process.exitCode=1;if(page)await page.screenshot({path:join(out,'failure.png'),fullPage:true}).catch(()=>{});if(context)await context.storageState({path:join(out,'failure-whole-storage.json')}).catch(()=>{});console.error(report.failure);}
finally{if(context)await context.close().catch(error=>report.cleanup.contextCloseError=String(error));if(browser)await browser.close().catch(error=>report.cleanup.browserCloseError=String(error));report.originalInputUnchanged=sha(await readFile(input))===inputSha256;if(!report.originalInputUnchanged){report.status='FAIL_ORIGINAL_INPUT_CHANGED';process.exitCode=1;}report.cleanup.closedUtc=new Date().toISOString();await persist();}
