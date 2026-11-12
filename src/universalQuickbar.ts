/** Independent quickbar customization. No mission resources or save formats
 * are changed: tools are equipment selections and safe navigation shortcuts. */
export type QuickbarMode="outpost"|"commander"|"strategy"|"history"|"history_all";
export type ToolId="map"|"tablet"|"scanner"|"wrench"|"camera"|"sample"|"radio"|"medical"|"none";
export const TOOL_CATALOG:Record<ToolId,{name:string;symbol:string;description:string}>={
 map:{name:"Navigator",symbol:"⌖",description:"Open the available navigation or mission map."},
 tablet:{name:"Mission tablet",symbol:"▤",description:"Open the mission list or available instructions."},
 scanner:{name:"Scanner",symbol:"◉",description:"Inspect nearby systems; does not perform engineering actions automatically."},
 wrench:{name:"Repair tool",symbol:"⚒",description:"Carry a maintenance tool. Repairs must still be performed at their assigned station."},
 camera:{name:"Camera",symbol:"▣",description:"Carry a mission camera for exploring and documenting spacecraft."},
 sample:{name:"Sample kit",symbol:"◇",description:"Carry a sealed sample container for science missions."},
 radio:{name:"Radio",symbol:"◌",description:"Carry a portable communications unit."},
 medical:{name:"First-aid kit",symbol:"✚",description:"Carry a first-aid kit. It does not replace crew safety missions."},
 none:{name:"Empty slot",symbol:"＋",description:"Leave this quickbar slot empty."}
};
export const QUICKBAR_SLOTS=6;
export function quickbarKey(mode:QuickbarMode){return "orbital-quickbar-"+mode+"-v1";}
export function defaultQuickbar(mode:QuickbarMode):ToolId[]{
 if(mode==="strategy")return ["tablet","scanner","map","camera","wrench","sample"];
 if(mode==="history"||mode==="history_all")return ["tablet","camera","map","sample","radio","scanner"];
 return ["map","tablet","scanner","wrench","sample","camera"];
}
export function parseQuickbar(raw:string|null,mode:QuickbarMode):ToolId[]{
 if(!raw)return defaultQuickbar(mode);
 try{
  const v:unknown=JSON.parse(raw);
  if(!Array.isArray(v)||v.length!==QUICKBAR_SLOTS||!v.every(x=>typeof x==="string"&&x in TOOL_CATALOG))
   return defaultQuickbar(mode);
  return v as ToolId[];
 }catch{return defaultQuickbar(mode);}
}
export const QUICKBAR_USE_EVENT="orbital:quickbar-use";
export const QUICKBAR_EQUIP_EVENT="orbital:quickbar-equip";
export const QUICKBAR_EDIT_EVENT="orbital:quickbar-edit";
export type QuickbarDetail={tool:ToolId;mode:QuickbarMode};
