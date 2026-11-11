/**
 * Fullscreen game viewport guard for Commander and historical 3D missions.
 * iPad browsers can pan the document even when a child canvas is fixed.
 * Lock the document, but preserve real scrolling inside mission dialogs.
 */
export function visibleMissionHeight(visualHeight:number|undefined, innerHeight:number):number {
  const value=typeof visualHeight==="number"&&Number.isFinite(visualHeight)&&visualHeight>200
    ?visualHeight:innerHeight;
  return Math.max(240,Math.floor(value));
}
export function lockMissionViewport():()=>void {
  const html=document.documentElement, body=document.body, root=document.getElementById("root");
  const scrollX=window.scrollX, scrollY=window.scrollY;
  const prev={
    htmlOverflow:html.style.overflow,htmlOverscroll:html.style.overscrollBehavior,htmlHeight:html.style.height,
    bodyOverflow:body.style.overflow,bodyOverscroll:body.style.overscrollBehavior,bodyPosition:body.style.position,
    bodyTop:body.style.top,bodyLeft:body.style.left,bodyRight:body.style.right,
    bodyWidth:body.style.width,bodyHeight:body.style.height,
    rootPosition:root?.style.position??"",rootInset:root?.style.inset??"",
    rootWidth:root?.style.width??"",rootHeight:root?.style.height??"",
    rootMinHeight:root?.style.minHeight??"",rootOverflow:root?.style.overflow??"",
    visibleHeight:root?.style.getPropertyValue("--mission-visible-height")??""
  };
  const scrollable=(target:EventTarget|null)=>{
    if(!(target instanceof Element))return false;
    for(let el:Element|null=target;el&&el!==body&&el!==html;el=el.parentElement){
      // Only the actual overflow region may scroll. Never let a background
      // gesture in the 3D scene bubble into document scrolling.
      const style=window.getComputedStyle(el);
      if(/^(auto|scroll)$/.test(style.overflowY)&&el.scrollHeight>el.clientHeight+1)return true;
      if(/^(auto|scroll)$/.test(style.overflowX)&&el.scrollWidth>el.clientWidth+1)return true;
    }
    return false;
  };
  const stopDocumentPan=(event:TouchEvent|WheelEvent)=>{
    if(scrollable(event.target))return;
    if(event.cancelable)event.preventDefault();
  };
  const keepWindowAtZero=()=>{
    if(window.scrollX!==0||window.scrollY!==0)window.scrollTo(0,0);
  };
  const measure=()=>{
    root?.style.setProperty("--mission-visible-height",visibleMissionHeight(window.visualViewport?.height,window.innerHeight)+"px");
  };
  window.scrollTo(0,0);
  html.classList.add("mission-viewport-locked");
  html.style.overflow="hidden";
  html.style.overscrollBehavior="none";
  html.style.height="100%";
  body.style.overflow="hidden";
  body.style.overscrollBehavior="none";
  body.style.position="fixed";
  body.style.top="0";body.style.left="0";body.style.right="0";
  body.style.width="100%";body.style.height="100%";
  if(root){
    root.style.position="fixed";root.style.inset="0";
    root.style.width="100%";root.style.height="100%";
    root.style.minHeight="0";root.style.overflow="hidden";
  }
  measure();
  window.visualViewport?.addEventListener("resize",measure);
  window.visualViewport?.addEventListener("scroll",measure);
  window.addEventListener("resize",measure);
  window.addEventListener("orientationchange",measure);
  document.addEventListener("touchmove",stopDocumentPan,{capture:true,passive:false});
  document.addEventListener("wheel",stopDocumentPan,{capture:true,passive:false});
  window.addEventListener("scroll",keepWindowAtZero,{passive:true});
  return ()=>{
    window.visualViewport?.removeEventListener("resize",measure);
    window.visualViewport?.removeEventListener("scroll",measure);
    window.removeEventListener("resize",measure);
    window.removeEventListener("orientationchange",measure);
    document.removeEventListener("touchmove",stopDocumentPan,true);
    document.removeEventListener("wheel",stopDocumentPan,true);
    window.removeEventListener("scroll",keepWindowAtZero);
    html.classList.remove("mission-viewport-locked");
    html.style.overflow=prev.htmlOverflow;
    html.style.overscrollBehavior=prev.htmlOverscroll;
    html.style.height=prev.htmlHeight;
    body.style.overflow=prev.bodyOverflow;
    body.style.overscrollBehavior=prev.bodyOverscroll;
    body.style.position=prev.bodyPosition;body.style.top=prev.bodyTop;
    body.style.left=prev.bodyLeft;body.style.right=prev.bodyRight;
    body.style.width=prev.bodyWidth;body.style.height=prev.bodyHeight;
    if(root){
      root.style.position=prev.rootPosition;root.style.inset=prev.rootInset;
      root.style.width=prev.rootWidth;root.style.height=prev.rootHeight;
      root.style.minHeight=prev.rootMinHeight;root.style.overflow=prev.rootOverflow;
      if(prev.visibleHeight)root.style.setProperty("--mission-visible-height",prev.visibleHeight);
      else root.style.removeProperty("--mission-visible-height");
    }
    window.scrollTo(scrollX,scrollY);
  };
}
