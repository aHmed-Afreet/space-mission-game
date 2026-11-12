import {useEffect,useState} from "react";
import {QUICKBAR_EDIT_EVENT,QUICKBAR_EQUIP_EVENT,QUICKBAR_SLOTS,QUICKBAR_USE_EVENT,
 TOOL_CATALOG,defaultQuickbar,parseQuickbar,quickbarKey,type ToolId,type QuickbarMode} from "./universalQuickbar";
import "./universalQuickbar.css";

export default function UniversalToolbar({mode}:{mode:QuickbarMode}){
 const [slots,setSlots]=useState<ToolId[]>(()=>{
  try{return parseQuickbar(localStorage.getItem(quickbarKey(mode)),mode);}
  catch{return defaultQuickbar(mode);}
 });
 const [active,setActive]=useState<number|null>(null);
 const [editing,setEditing]=useState(false);
 const [collapsed,setCollapsed]=useState(false);
 const [message,setMessage]=useState("");
 const held=active!==null?slots[active]:null;
 useEffect(()=>{try{localStorage.setItem(quickbarKey(mode),JSON.stringify(slots));}
 catch{/* Equipment remains editable in memory if storage is disabled. */}},[slots,mode]);
 useEffect(()=>{
  window.dispatchEvent(new CustomEvent(QUICKBAR_EDIT_EVENT,{detail:{editing,mode}}));
  return ()=>window.dispatchEvent(new CustomEvent(QUICKBAR_EDIT_EVENT,{detail:{editing:false,mode}}));
 },[editing,mode]);
 useEffect(()=>{
  if(!held||held==="none")return;
  window.dispatchEvent(new CustomEvent(QUICKBAR_EQUIP_EVENT,{detail:{tool:held,mode}}));
 },[held,mode]);
 const choose=(index:number)=>{
  setActive(index);setMessage(slots[index]==="none"?"Empty slot":"Holding "+TOOL_CATALOG[slots[index]].name);
 };
 const action=()=>{
  if(!held||held==="none")return;
  if(held==="map"||held==="tablet"){
   window.dispatchEvent(new CustomEvent(QUICKBAR_USE_EVENT,{detail:{tool:held,mode}}));
   setMessage("Opening "+TOOL_CATALOG[held].name+" where this mode supports it");
  }else{
   setMessage(TOOL_CATALOG[held].description);
  }
 };
 return <>
  <div className={"orbital-quickbar"+(collapsed?" is-collapsed":"")} role="region" aria-label="Editable equipment hotbar">
   <button type="button" className="orbital-quickbar-toggle" onClick={()=>setCollapsed(x=>!x)} aria-label={collapsed?"Show equipment hotbar":"Hide equipment hotbar"}>{collapsed?"▲ EQUIPMENT":"▼"}</button>
   {!collapsed&&<>
    <div className="orbital-quickbar-slots" role="group" aria-label="Select an item to hold">
     {slots.map((item,i)=><button type="button" key={i} className={"orbital-quickbar-slot"+(active===i?" active":"")}
       aria-pressed={active===i} aria-label={"Slot "+(i+1)+": "+TOOL_CATALOG[item].name} onClick={()=>choose(i)}>
       <small>{i+1}</small><b aria-hidden="true">{TOOL_CATALOG[item].symbol}</b>
     </button>)}
    </div>
    <button type="button" className="orbital-quickbar-edit" onClick={()=>setEditing(true)} aria-label="Edit toolbar slots">EDIT</button>
    {held&&held!=="none"&&<button type="button" className="orbital-quickbar-use"
       onClick={action}>{held==="map"||held==="tablet"?"OPEN":"INSPECT"}</button>}
   </>}
   {held&&held!=="none"&&!collapsed&&<span className="orbital-quickbar-held" aria-live="polite">HELD: {TOOL_CATALOG[held].name.toUpperCase()}</span>}
  </div>
  {message&&!editing&&<div className="orbital-quickbar-feedback" role="status" onClick={()=>setMessage("")}>{message}</div>}
  {editing&&<div className="orbital-quickbar-shade">
    <section className="orbital-quickbar-editor" role="dialog" aria-modal="true" aria-label="Customize equipment toolbar">
     <div className="orbital-quickbar-editor-head"><div><small>PERSONAL LOADOUT · {mode.toUpperCase()}</small>
       <h2>Edit your equipment toolbar</h2><p>Choose an item for each slot. Your layout is saved separately for each mode.</p></div>
       <button type="button" onClick={()=>setEditing(false)}>✕ CLOSE</button></div>
     <div className="orbital-quickbar-editor-list">{slots.map((item,i)=><label key={i}>
       <span>SLOT {i+1}</span>
       <select aria-label={"Equipment for slot "+(i+1)} value={item}
        onChange={e=>setSlots(old=>old.map((x,j)=>j===i?e.target.value as ToolId:x))}>
        {Object.entries(TOOL_CATALOG).map(([id,tool])=><option key={id} value={id}>{tool.name}</option>)}
       </select>
     </label>)}</div>
     <p className="orbital-quickbar-caveat">Equipment selection does not grant extra resources or bypass mission steps. MAP and MISSION TABLET open existing controls where supported.</p>
     <div className="orbital-quickbar-editor-actions"><button type="button" onClick={()=>{setSlots(defaultQuickbar(mode));setActive(null);}}>RESET DEFAULT</button>
       <button type="button" onClick={()=>setEditing(false)}>SAVE & RETURN TO GAME</button></div>
    </section>
  </div>}
 </>;
}
