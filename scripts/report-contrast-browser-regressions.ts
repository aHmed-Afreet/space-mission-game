/** Real Report component + production CSS, rendered in Chromium.
 * Presentation-only fixture using an actual earned report. Never mission PASS.
 * Run after npm run build, with the only browser slot free and REPORT_STATE
 * pointing to an unmodified earned Commander *-REPORT-state.json.
 */
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFile,readdir,mkdir,writeFile} from 'node:fs/promises';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import Report from '../src/commander/campaign/Report';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'/opt/codex/runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
assert.equal(process.env.OTHER_BROWSER_STOPPED,'1','The caller must own the only browser slot');
assert.ok(process.env.REPORT_STATE,'Use an actual earned report; never fabricate completion');
const state=JSON.parse(await readFile(process.env.REPORT_STATE,'utf8'));
assert.ok(state.session?.report?.success,'Genuine successful report required');
const artifacts=process.env.BROWSER_ARTIFACTS||'/tmp/report-contrast-browser-regressions';await mkdir(artifacts,{recursive:true});
const dist=process.env.DIST_DIR||new URL('../dist/',import.meta.url).pathname;
const assets=(await readdir(dist+'/assets')).filter(name=>name.endsWith('.css'));
const css=(await Promise.all(assets.map(name=>readFile(dist+'/assets/'+name,'utf8')))).join('\n');
const markup=renderToStaticMarkup(createElement(Report,{result:state.session.report,onHome:()=>{}}));
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
const results=[];
try{
 for(const viewport of [{width:1280,height:900},{width:1024,height:768},{width:390,height:844},{width:844,height:390}]){
  const context=await browser.newContext({viewport});const page=await context.newPage();
  // Worst-case white background is an explicitly declared presentation fixture.
  // Real game CSS is unchanged. No running application or progress state exists.
  await page.route('**/*',route=>route.abort());
  await page.setContent('<!doctype html><html><head><style>'+css+'</style><style>#root{background:#fff}#root::before{background:#fff}</style></head><body><div id="root">'+markup+'</div></body></html>');
  // tsx may retain inferred function names in serialized nested callbacks.
  // This helper belongs only to the declared presentation fixture.
  await page.evaluate('globalThis.__name=(fn)=>fn');
  const samples=await page.locator('.campaign-report h1,.campaign-report-title p,.campaign-report-title .eyebrow,.campaign-report-grid article>span,.campaign-report-counts,.campaign-report .score strong,.campaign-report .score>span').evaluateAll(nodes=>{
   const parse=(s:string)=>{const n=s.match(/[\d.]+/g)!.map(Number);return[n[0],n[1],n[2],n[3]??1];};
   const luminance=(rgb:number[])=>rgb.slice(0,3).map(v=>{const s=v/255;return s<=.04045?s/12.92:((s+.055)/1.055)**2.4;}).reduce((a,v,i)=>a+v*[.2126,.7152,.0722][i],0);
   return nodes.map(node=>{const style=getComputedStyle(node),fg=parse(style.color);let bg=[255,255,255,1];const ancestors=[];for(let el:Element|null=node;el;el=el.parentElement)ancestors.unshift(el);
    for(const el of ancestors){const c=parse(getComputedStyle(el).backgroundColor);bg=[0,1,2].map(i=>c[i]*c[3]+bg[i]*(1-c[3])).concat(1);}
    const composite=[0,1,2].map(i=>fg[i]*fg[3]+bg[i]*(1-fg[3]));const a=luminance(composite),b=luminance(bg);return{text:node.textContent?.trim(),color:style.color,background:bg,contrast:(Math.max(a,b)+.05)/(Math.min(a,b)+.05),fontSize:style.fontSize};});
  });
  assert.ok(samples.length>=10,'Actual report headings, labels and metrics must be observed');
  const failures=samples.filter(s=>s.contrast<4.5);
  const surface=await page.locator('.campaign-report').evaluate(el=>getComputedStyle(el).backgroundColor);
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth);
  await page.screenshot({path:artifacts+`/report-${viewport.width}x${viewport.height}.png`,fullPage:true});
  results.push({viewport,surface,samples,overflow,status:failures.length||overflow?'FAIL':'PASS',failures});
  await context.close();
 }
}finally{await browser.close();await writeFile(artifacts+'/results.json',JSON.stringify({scope:'Actual earned report rendered by real React component + compiled production CSS on declared white-backdrop fixture; native Chromium, not live gameplay, OS print or mission-completion evidence.',reportInput:process.env.REPORT_STATE,reportRunId:state.session.report.runId,assets,results},null,2));}
console.log(JSON.stringify({artifacts,results:results.map(r=>({viewport:r.viewport,status:r.status,failures:r.failures}))}));
assert.ok(results.every(r=>r.status==='PASS'),'All rendered report text must reach 4.5:1 and fit the viewport');
