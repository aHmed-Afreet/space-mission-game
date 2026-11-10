import test from "node:test";
import assert from "node:assert/strict";
import {lockOutpostViewport} from "./outpost/scrollLock";

// Simulate WebKit's cancelable touchmove and the homepage's nonzero scroll.
// This test exercises real listener behavior rather than only searching code.
class FakeElement {
 style:Record<string,string>={};
 classes=new Set<string>();
 classList={
  add:(value:string)=>this.classes.add(value),
  remove:(value:string)=>this.classes.delete(value),
  contains:(value:string)=>this.classes.has(value)
 };
 scrollable=false;
 closest(selector:string){
  return this.scrollable && selector.includes(".j3-panel") ? this : null;
 }
}
type MockEvent={type:string;target:FakeElement;cancelable:boolean;prevented:boolean;preventDefault:()=>void};
test("iPad outpost stops page swipe and wheel but keeps its map panels scrollable",()=>{
 const g=globalThis as unknown as {document:Document;window:Window;Element:typeof Element};
 const original={document:g.document,window:g.window,Element:g.Element};
 const html=new FakeElement(),body=new FakeElement(),root=new FakeElement();
 html.style.overflow="auto";
 body.style.position="relative";
 root.style.height="auto";
 const listeners=new Map<string,{fn:(e:MockEvent)=>void;options:unknown}>();
 const fakeDocument={
  documentElement:html,body,
  getElementById:(name:string)=>name==="root"?root:null,
  addEventListener:(kind:string,fn:(e:MockEvent)=>void,options:unknown)=>listeners.set("doc:"+kind,{fn,options}),
  removeEventListener:(kind:string)=>listeners.delete("doc:"+kind)
 };
 const fakeWindow={
  scrollX:0,scrollY:740,
  scrollTo(x:number,y:number){this.scrollX=x;this.scrollY=y;},
  addEventListener:(kind:string,fn:(e:MockEvent)=>void,options:unknown)=>listeners.set("win:"+kind,{fn,options}),
  removeEventListener:(kind:string)=>listeners.delete("win:"+kind)
 };
 try{
  g.document=fakeDocument as unknown as Document;
  g.window=fakeWindow as unknown as Window;
  g.Element=FakeElement as unknown as typeof Element;
  const cleanup=lockOutpostViewport();
  assert.equal(fakeWindow.scrollY,0,"entering from a scrolled homepage must reset viewport offset");
  assert.equal(body.style.top,"0","never set negative scrollY as body top");
  assert.equal(body.style.position,"fixed");
  assert.equal(root.style.position,"fixed");
  assert.equal(root.style.inset,"0");
  assert.equal(root.style.overflow,"hidden");
  assert.equal(html.style.overflow,"hidden");
  assert.ok(html.classList.contains("outpost-viewport-locked"));
  const listener=listeners.get("doc:touchmove");
  assert.ok(listener);
  assert.deepEqual(listener.options,{capture:true,passive:false});
  const surface=new FakeElement();
  const swipe:MockEvent={type:"touchmove",target:surface,cancelable:true,prevented:false,preventDefault(){this.prevented=true;}};
  listener.fn(swipe);
  assert.equal(swipe.prevented,true,"world gestures must never scroll iPad page");
  const modal=new FakeElement();modal.scrollable=true;
  const menuScroll:MockEvent={...swipe,target:modal,prevented:false};
  listener.fn(menuScroll);
  assert.equal(menuScroll.prevented,false,"map/help dialog must still scroll");
  const wheel={...swipe,type:"wheel",prevented:false};
  listeners.get("doc:wheel")?.fn(wheel);
  assert.equal(wheel.prevented,true,"desktop wheel must not pan game");
  fakeWindow.scrollY=120;
  listeners.get("win:scroll")?.fn(swipe);
  assert.equal(fakeWindow.scrollY,0,"unexpected browser scroll is immediately restored");
  cleanup();
  assert.equal(fakeWindow.scrollY,740,"returning to homepage restores prior scroll offset");
  assert.equal(body.style.position,"relative");
  assert.equal(root.style.height,"auto");
  assert.equal(html.style.overflow,"auto");
  assert.equal(html.classList.contains("outpost-viewport-locked"),false);
  assert.equal(listeners.size,0,"no event handlers should leak to other modes");
 }finally{
  g.document=original.document;
  g.window=original.window;
  g.Element=original.Element;
 }
});
