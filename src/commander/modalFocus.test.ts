import test from "node:test";
import assert from "node:assert/strict";
import { containModalFocus } from "./modalFocus";

// A small focus/event host exercises the installed behavior without a browser.
// Native range-key handling, layout visibility and pointer behavior are covered
// by the separately required browser checks, not claimed by this host model.
class FocusDocument {
  activeElement: FocusElement | null = null;
  defaultView = { HTMLElement:FocusElement };
  listeners = new Map<string, Set<(event:any)=>void>>();
  addEventListener(type:string, listener:(event:any)=>void) {
    if(!this.listeners.has(type))this.listeners.set(type,new Set());
    this.listeners.get(type)!.add(listener);
  }
  removeEventListener(type:string, listener:(event:any)=>void) { this.listeners.get(type)?.delete(listener); }
  emit(type:string,event:any) { for(const listener of this.listeners.get(type)||[])listener(event); }
  key(key:string,shiftKey=false) {
    const event={key,shiftKey,defaultPrevented:false,preventDefault(){this.defaultPrevented=true},stopPropagation(){}};
    this.emit("keydown",event);
    return event;
  }
}
class FocusElement {
  children:FocusElement[]=[];
  parentElement:FocusElement|null=null;
  inert=false;
  hidden=false;
  isConnected=true;
  attributes=new Map<string,string>();
  constructor(readonly document:FocusDocument,readonly name:string,readonly focusable=false) {}
  append(child:FocusElement) { child.parentElement=this;this.children.push(child);return child; }
  contains(child:FocusElement|null):boolean { return child===this || this.children.some(element=>element.contains(child)); }
  closest(selector:string):FocusElement|null {
    const blocked=(selector.includes("[inert]")&&this.inert)||(selector.includes("[hidden]")&&this.hidden);
    return blocked?this:this.parentElement?.closest(selector)||null;
  }
  querySelectorAll():FocusElement[] { return this.children.flatMap(child=>[...(child.focusable?[child]:[]),...child.querySelectorAll()]); }
  getClientRects() { return this.hidden?[]:[{}]; }
  getAttribute(name:string) { return this.attributes.get(name)??null; }
  setAttribute(name:string,value:string) { this.attributes.set(name,value); }
  removeAttribute(name:string) { this.attributes.delete(name); }
  focus() {
    if(this.closest("[inert]"))return;
    this.document.activeElement=this;
    this.document.emit("focusin",{target:this});
  }
}
function fixture() {
  const doc=new FocusDocument(),body=new FocusElement(doc,"body");
  const game=body.append(new FocusElement(doc,"game"));
  const opener=game.append(new FocusElement(doc,"settings opener",true));
  const preserved=body.append(new FocusElement(doc,"already inert"));preserved.inert=true;
  const overlay=body.append(new FocusElement(doc,"overlay"));
  const shade=overlay.append(new FocusElement(doc,"shade",true));
  const dialog=overlay.append(new FocusElement(doc,"dialog"));
  const close=dialog.append(new FocusElement(doc,"close",true));
  const slider=dialog.append(new FocusElement(doc,"slider",true));
  const last=dialog.append(new FocusElement(doc,"last",true));
  opener.focus();
  const mount=(onClose=()=>{})=>containModalFocus({dialog:dialog as unknown as HTMLElement,
    boundary:overlay as unknown as HTMLElement,initialFocus:close as unknown as HTMLElement,onClose},doc as unknown as Document);
  return {doc,body,game,opener,preserved,overlay,shade,dialog,close,slider,last,mount};
}

test("modal focuses once, contains Tab in both directions and redirects escaped focus",()=>{
  const f=fixture(),release=f.mount();
  assert.equal(f.doc.activeElement,f.close);
  assert.equal(f.game.inert,true);
  assert.equal(f.shade.inert,false,"the close shade remains clickable");
  f.slider.focus();
  assert.equal(f.doc.key("ArrowRight").defaultPrevented,false);
  assert.equal(f.doc.activeElement,f.slider,"changing a control must keep its focus");
  f.last.focus();assert.equal(f.doc.key("Tab").defaultPrevented,true);
  assert.equal(f.doc.activeElement,f.close);
  assert.equal(f.doc.key("Tab",true).defaultPrevented,true);
  assert.equal(f.doc.activeElement,f.last);
  f.doc.activeElement=f.opener;f.doc.emit("focusin",{target:f.opener});
  assert.equal(f.doc.activeElement,f.close);
  release();
});

test("Escape closes through the live callback and cleanup restores the opener and old inert state",()=>{
  const f=fixture();let count=0;
  let callback=()=>{count+=1};
  const release=f.mount(()=>callback());
  callback=()=>{count+=10};
  assert.equal(f.doc.key("Escape").defaultPrevented,true);
  assert.equal(count,10);
  release();
  assert.equal(f.doc.activeElement,f.opener);
  assert.equal(f.game.inert,false);
  assert.equal(f.preserved.inert,true);
  assert.equal(f.dialog.getAttribute("tabindex"),null);
  assert.equal(f.doc.key("Escape").defaultPrevented,false);
});

test("a nested modal owns keys and focus until it closes, then restores its parent",()=>{
  const f=fixture();let outerClosed=0,innerClosed=0;
  const releaseOuter=f.mount(()=>outerClosed++);
  const innerOverlay=f.dialog.append(new FocusElement(f.doc,"inner overlay"));
  const innerDialog=innerOverlay.append(new FocusElement(f.doc,"inner dialog"));
  const innerClose=innerDialog.append(new FocusElement(f.doc,"inner close",true));
  const releaseInner=containModalFocus({dialog:innerDialog as unknown as HTMLElement,
    boundary:innerOverlay as unknown as HTMLElement,onClose:()=>innerClosed++},f.doc as unknown as Document);
  assert.equal(f.doc.activeElement,innerClose);
  f.doc.key("Escape");
  assert.equal(innerClosed,1);assert.equal(outerClosed,0);
  releaseInner();
  assert.equal(f.doc.activeElement,f.close);
  assert.equal(f.game.inert,true,"outer scope retains its background lock");
  releaseOuter();
  assert.equal(f.game.inert,false);
});

test("a modal with no controls traps Tab on the dialog and tolerates an unmounted opener",()=>{
  const f=fixture();f.dialog.children=[];
  const release=containModalFocus({dialog:f.dialog as unknown as HTMLElement,
    boundary:f.overlay as unknown as HTMLElement},f.doc as unknown as Document);
  assert.equal(f.doc.activeElement,f.dialog);
  assert.equal(f.doc.key("Tab").defaultPrevented,true);
  f.opener.isConnected=false;
  release();
  assert.equal(f.game.inert,false);
});
