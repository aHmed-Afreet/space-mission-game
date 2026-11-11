import {rockets,trajectories} from './game';

/** Sectioned engineering drawing: the three fictional launchers are not real vehicles. */
export function LauncherDrawing({variant}:{variant:number}){
 const id=`launcher-${variant}`;const w=variant===0?24:30,boost=variant===2;
 return <svg className="planner-launcher-drawing" viewBox="0 0 240 260" role="img" aria-label={`${rockets[variant].name} launch vehicle schematic`}>
 <defs><linearGradient id={id}><stop stopColor="#485362"/><stop offset=".35" stopColor="#e1e4e7"/><stop offset=".55" stopColor="#b9c2cc"/><stop offset="1" stopColor="#465362"/></linearGradient></defs>
 <g stroke="#293848" strokeWidth=".6"><path d="M30 30H210M30 70H210M30 110H210M30 150H210M30 190H210M30 230H210M60 20V240M100 20V240M140 20V240M180 20V240"/></g>
 <g fill={`url(#${id})`} stroke="#d5dbe1" strokeWidth=".7"><path d={`M${120-w/2} 82Q${120-w/2} 46 120 25Q${120+w/2} 46 ${120+w/2} 82Z`}/><path d={`M${120-w/2} 82H${120+w/2}V211H${120-w/2}Z`}/>{boost&&<><path d="M91 112L96 94L101 112V211H91Z"/><path d="M139 112L144 94L149 112V211H139Z"/></>}<path d={`M${120-w/2} 185L${102-w/2} 211H${120-w/2}Z M${120+w/2} 185L${138+w/2} 211H${120+w/2}Z`}/><path d="M114 211H126L131 223H109Z"/></g>
 <g fill="#26313b"><path d={`M${120-w/2} 82H${120+w/2}V89H${120-w/2}Z M${120-w/2} 124H${120+w/2}V132H${120-w/2}Z M${120-w/2} 195H${120+w/2}V202H${120-w/2}Z`}/><rect x="117" y="143" width="6" height="20"/></g>
 <g fill="none" stroke="#a8b5c3" strokeWidth=".7"><path d="M147 55H176V49M141 108H191M139 168H180V177M76 26V223M71 26H81M71 223H81"/></g>
 <g fill="#b6c3ce" fontSize="7" fontFamily="monospace"><text x="166" y="44">FAIRING</text><text x="162" y="103">STAGE 02</text><text x="165" y="188">STAGE 01</text><text x="60" y="147" transform="rotate(-90 60 147)">VEHICLE ENVELOPE</text><text x="64" y="247">CONFIGURATION 0{variant+1} / SCHEMATIC</text></g>
 </svg>;
}

export function TransferDiagram({trajectory}:{trajectory:number}){
 const route=trajectories[trajectory];const curves=['M123 150 C145 26 350 25 421 114','M123 150 C164 45 333 53 421 114','M123 150 C118 -4 408 -9 421 114'];
 return <figure className="planner-transfer"><svg viewBox="0 0 560 220" role="img" aria-label={`${route.name}: Earth to Mars trajectory schematic, ${route.days} days. Not an ephemeris or scale drawing.`}>
 <defs><radialGradient id="diagram-earth"><stop stopColor="#a1bbcd"/><stop offset=".6" stopColor="#42647e"/><stop offset="1" stopColor="#0a1521"/></radialGradient><radialGradient id="diagram-mars"><stop stopColor="#cca184"/><stop offset=".6" stopColor="#9b6351"/><stop offset="1" stopColor="#35262a"/></radialGradient></defs>
 <ellipse cx="270" cy="129" rx="220" ry="73" fill="none" stroke="#34404d" strokeDasharray="3 5"/><ellipse cx="270" cy="129" rx="150" ry="49" fill="none" stroke="#283541"/><circle cx="270" cy="129" r="6" fill="#c9ac76"/>
 {curves.map((path,i)=><path key={path} d={path} fill="none" stroke={i===trajectory?'#dbb575':'#465565'} strokeWidth={i===trajectory?2.5:1} strokeDasharray={i===trajectory?'0':'3 6'}/>)}
 <circle cx="123" cy="150" r="17" fill="url(#diagram-earth)"/><circle cx="421" cy="114" r="13" fill="url(#diagram-mars)"/>
 <g fill="#c7d1da" fontSize="10" fontFamily="monospace"><text x="101" y="186">EARTH</text><text x="406" y="148">MARS</text><text x="232" y="157" fontSize="8">SUN</text><text x="20" y="24">TRANSFER ANALYSIS / ROUTE 0{trajectory+1}</text><text x="384" y="24">{route.days} DAYS · {route.fuel} FUEL UNITS</text></g>
 </svg><figcaption>Relative geometry is illustrative. Route duration, fuel units and risk follow the selected game model.</figcaption></figure>;
}

export function InstrumentDrawing({kind}:{kind:string}){
 const optics=kind==='camera'||kind==='spectrometer',power=kind==='solar'||kind==='battery';
 return <svg className="planner-instrument-drawing" viewBox="0 0 150 90" role="img" aria-label={`${componentsLabel[kind]||kind} engineering preview`}>
 <defs><linearGradient id={`instrument-metal-${kind}`} x2="0" y2="1"><stop stopColor="#d2d6d9"/><stop offset=".45" stopColor="#768491"/><stop offset="1" stopColor="#384652"/></linearGradient></defs>
 <path d="M15 72H136M25 77V18M130 77V18" stroke="#3b4a59" strokeWidth=".7" strokeDasharray="2 4"/>
 {kind==='antenna'||kind==='radar'?<g fill={`url(#instrument-metal-${kind})`} stroke="#bdc9d1" strokeWidth=".8"><path d="M45 24Q75 80 106 24Q75 45 45 24Z"/><path d="M75 45V69H91V73H59V69H72V45"/><path d="M75 45 65 17" fill="none"/><circle cx="65" cy="17" r="2.8" fill="#c4ad7d"/></g>:kind==='tank'?<g fill={`url(#instrument-metal-${kind})`} stroke="#bdc9d1" strokeWidth=".8"><rect x="37" y="27" width="76" height="36" rx="18"/><path d="M56 28V62M94 28V62M73 23V27M69 23H77M52 63V70M98 63V70" fill="none"/><path d="M65 40H86V51H65Z" fill="#363f46"/></g>:<g><path d="M35 30 48 21H112V60L99 70H35Z" fill={`url(#instrument-metal-${kind})`} stroke="#adbbc7" strokeWidth=".8"/><path d="M35 30H99V70M99 30 112 21" fill="none" stroke="#d4dde5" strokeWidth=".7"/>
 {optics?<><path d="M54 36H84V61H54Z" fill="#2a3540" stroke="#b1bdc8"/><circle cx="69" cy="48" r={kind==='camera'?10:6} fill="#0c1928" stroke="#bac2c9" strokeWidth="2"/><circle cx="67" cy="45" r="3" fill="#627c91"/>{kind==='spectrometer'&&<path d="M56 57H82" stroke="#c3a474" strokeWidth="2"/>}</>:power?<><path d="M40 35H93V63H40Z" fill="#1b2b42"/>{Array.from({length:6},(_,i)=><path key={i} d={`M${44+i*9} 35V63`} stroke="#6f8b9d" strokeWidth=".7"/>)}<path d="M40 45H93M40 54H93" stroke="#6f8b9d" strokeWidth=".7"/>{kind==='battery'&&<path d="M62 39 55 51H66L61 61 76 47H65L72 39Z" fill="#c9ae7a"/>}</>:<><path d="M41 37H92V61H41Z" fill="#9a8258"/><path d="m41 38 19 22 12-22 19 23M45 61 68 38 88 61" stroke="#d2bb89" strokeWidth=".6" opacity=".7"/></>}
 {[42,92].map(x=>[35,65].map(y=><circle key={`${x}${y}`} cx={x} cy={y} r="1.2" fill="#e1e3e4"/>))}</g>}
 <g fill="#b2c0cc" fontSize="6" fontFamily="monospace"><text x="17" y="13">{kind.toUpperCase()} / INTEGRATION STUDY</text><text x="86" y="84">NOT TO SCALE</text></g>
 </svg>;
}
const componentsLabel:Record<string,string>={camera:'Terrain camera',spectrometer:'Water spectrometer',radar:'Subsurface radar',solar:'Solar array',battery:'Battery pack',tank:'Fuel tank',antenna:'Deep-space antenna',shield:'Radiation shield'};
