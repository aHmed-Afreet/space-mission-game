/**
 * Prevent browser/document scrolling during a fullscreen outpost mission.
 * iPad Chrome uses WebKit: overflow:hidden by itself does not stop touch panning.
 * This specifically preserves scrolling inside gameplay dialogs.
 */
// 100dvh is sometimes larger than the actual iPad Chrome visual viewport
// when browser tabs and the address bar are showing. Use WebKit's measured
// visualViewport instead of guessing a fixed pixel offset.
export function outpostVisibleHeight(visualHeight:number|undefined,innerHeight:number):number {
 const h=Number.isFinite(visualHeight)&&visualHeight!>200?visualHeight!:innerHeight;
 return Math.max(240,Math.floor(Number.isFinite(h)?h:768));
}
export function lockOutpostViewport():()=>void {
 const html=document.documentElement,body=document.body;
 const appRoot=document.getElementById("root");
 const savedScroll={x:window.scrollX,y:window.scrollY};
 const previous={
  htmlOverflow:html.style.overflow,
  htmlOverscroll:html.style.overscrollBehavior,
  htmlHeight:html.style.height,
  bodyOverflow:body.style.overflow,
  bodyPosition:body.style.position,
  bodyTop:body.style.top,
  bodyLeft:body.style.left,
  bodyRight:body.style.right,
  bodyWidth:body.style.width,
  bodyHeight:body.style.height,
  bodyOverscroll:body.style.overscrollBehavior,
  rootPosition:appRoot?.style.position??"",
  rootInset:appRoot?.style.inset??"",
  rootWidth:appRoot?.style.width??"",
  rootHeight:appRoot?.style.height??"",
  rootOverflow:appRoot?.style.overflow??"",
  rootVisibleHeight:appRoot?.style.getPropertyValue("--outpost-visible-height")??""
 };
 const blockPanning=(event:TouchEvent|WheelEvent)=>{
  const target=event.target;
  // Maps, help/console dialogs and selection screen must remain scrollable.
  if(target instanceof Element&&target.closest(".j3-panel,.j3-select"))return;
  if(event.cancelable)event.preventDefault();
 };
 const resetScroll=()=>{
  if(window.scrollX!==0||window.scrollY!==0)window.scrollTo(0,0);
 };
 const syncVisibleViewport=()=>{
  const measured=outpostVisibleHeight(window.visualViewport?.height,window.innerHeight);
  // Keep the entire game HUD and bottom-right controls inside the actually
  // visible Chrome content area, even while its browser bars resize.
  appRoot?.style.setProperty("--outpost-visible-height",measured+"px");
 };
 // The old implementation offset the fixed body by -scrollY, which can move
 // the entire game canvas when launched from a scrolled homepage on iPadOS.
 window.scrollTo(0,0);
 html.classList.add("outpost-viewport-locked");
 html.style.overflow="hidden";
 html.style.overscrollBehavior="none";
 html.style.height="100%";
 body.style.overflow="hidden";
 body.style.overscrollBehavior="none";
 body.style.position="fixed";
 body.style.top="0";
 body.style.left="0";
 body.style.right="0";
 body.style.width="100%";
 body.style.height="100dvh";
 if(appRoot){
  appRoot.style.position="fixed";
  appRoot.style.inset="0";
  appRoot.style.width="100%";
  appRoot.style.height="100dvh";
  appRoot.style.overflow="hidden";
 }
 syncVisibleViewport();
 // iPad Chrome's address bar can expand or collapse without a window resize.
 // visualViewport.resize is the reliable signal for the usable screen height.
 window.visualViewport?.addEventListener("resize",syncVisibleViewport);
 window.visualViewport?.addEventListener("scroll",syncVisibleViewport);
 window.addEventListener("resize",syncVisibleViewport);
 window.addEventListener("orientationchange",syncVisibleViewport);
 // Chrome/Safari on iOS requires a non-passive listener to cancel touchmove.
 document.addEventListener("touchmove",blockPanning,{capture:true,passive:false});
 document.addEventListener("wheel",blockPanning,{capture:true,passive:false});
 window.addEventListener("scroll",resetScroll,{passive:true});
 return ()=>{
  window.visualViewport?.removeEventListener("resize",syncVisibleViewport);
  window.visualViewport?.removeEventListener("scroll",syncVisibleViewport);
  window.removeEventListener("resize",syncVisibleViewport);
  window.removeEventListener("orientationchange",syncVisibleViewport);
  window.removeEventListener("scroll",resetScroll);
  document.removeEventListener("touchmove",blockPanning,true);
  document.removeEventListener("wheel",blockPanning,true);
  html.classList.remove("outpost-viewport-locked");
  html.style.overflow=previous.htmlOverflow;
  html.style.overscrollBehavior=previous.htmlOverscroll;
  html.style.height=previous.htmlHeight;
  body.style.overflow=previous.bodyOverflow;
  body.style.position=previous.bodyPosition;
  body.style.top=previous.bodyTop;
  body.style.left=previous.bodyLeft;
  body.style.right=previous.bodyRight;
  body.style.width=previous.bodyWidth;
  body.style.height=previous.bodyHeight;
  body.style.overscrollBehavior=previous.bodyOverscroll;
  if(appRoot){
   appRoot.style.position=previous.rootPosition;
   appRoot.style.inset=previous.rootInset;
   appRoot.style.width=previous.rootWidth;
   appRoot.style.height=previous.rootHeight;
   appRoot.style.overflow=previous.rootOverflow;
   if(previous.rootVisibleHeight)appRoot.style.setProperty("--outpost-visible-height",previous.rootVisibleHeight);
   else appRoot.style.removeProperty("--outpost-visible-height");
  }
  window.scrollTo(savedScroll.x,savedScroll.y);
 };
}
