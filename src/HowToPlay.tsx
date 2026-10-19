import "./howTo.css";
type Props={onExit:()=>void};
const steps=[
 {name:"Choose your mode",detail:"Strategy (Mission Planning) is a spacecraft design and resource-management campaign. Commander is a first-person spacecraft operations game. Real Space History is a reference library, and Live the Story is a guided decision experience inspired by actual missions."},
 {name:"Strategy: select a level",detail:"Pick a challenge from the mission board. Study the goal and minimum success requirements. Research instrumentation, reliability, power, mass and fuel before making your design."},
 {name:"Strategy: design and launch",detail:"Choose components, a launch vehicle and a transfer route. The preflight panel catches missing instruments, excessive mass, budget problems and unsafe resource levels. Launch only when checks pass."},
 {name:"Strategy: manage mission events",detail:"During flight, read each incoming event and choose an option. Your final score reflects science, budget, reliability, fuel and communications. Completing the level goal unlocks the next challenge. Replay a level to improve the score."},
 {name:"Commander: start a complete mission",detail:"Choose a mission in the campaign and prepare your equipment and spacecraft. The mission uses multiple phases: launch, resource management, scientific tasks and safe return. Optional objectives can earn extra agency funding."},
 {name:"Commander: move and use equipment",detail:"On iPad or iPhone, touch the left side to summon a floating movement joystick. Drag the right side to look. Hold Sprint for speed (you can drag Sprint to turn) and aim at a control then press INTERACT. On a laptop, move with WASD or arrows, hold Shift to sprint, drag the mouse to look, and press E to interact."},
 {name:"Commander: find your location",detail:"Open the separate MAP button to see rooms, hatches and relevant surface work locations. Mission objectives name locations as they appear on the map. Inspect equipment when close enough and follow environmental safety rules."},
 {name:"Crew resources and EVA",detail:"Watch food, water, suit oxygen, battery, fuel, life-support systems and crew rest. For an EVA, collect required equipment and verify the suit and airlock. External work requires appropriate preparation; you cannot walk through sealed doors."},
 {name:"Progress, settings and saves",detail:"Commander progress saves in your current browser. Mission unlocks, reports, funding and upgrades remain between sessions. Settings includes control sensitivity, sound, graphics and an explicitly confirmed reset. Strategy progress is stored separately."},
 {name:"Understand the history",detail:"Historical pages describe when a mission launched, why it mattered, what actually happened and its engineering challenges. Live the Story asks educational choices but does not pretend you literally change real events. Real NASA missions and fictionalized gameplay are clearly labeled."}
];
export default function HowToPlay({onExit}:Props){
 return <main className="help-page">
  <header className="help-header"><button onClick={onExit}>← Main menu</button><strong>✦ ORBITAL / FLIGHT MANUAL</strong></header>
  <section className="help-hero"><small>MISSION OPERATIONS MANUAL</small><h1>How to play ORBITAL</h1>
   <p>Everything you need to plan missions, operate the ship, explore real spaceflight history and unlock new levels.</p></section>
  <div className="help-steps">{steps.map((s,i)=><article key={s.name}>
    <span>{String(i+1).padStart(2,"0")}</span><div><h2>{s.name}</h2><p>{s.detail}</p></div>
   </article>)}</div>
  <section className="help-controls">
   <h2>Controls at a glance</h2>
   <div><article><h3>iPad / iPhone</h3><p><strong>Left touch:</strong> Floating movement stick</p><p><strong>Right drag:</strong> Look around</p><p><strong>SPRINT:</strong> Hold and drag to move fast and turn</p><p><strong>INTERACT:</strong> Operate aimed-at doors, consoles or equipment</p><p><strong>MAP:</strong> Show detailed location plan</p></article>
   <article><h3>Laptop</h3><p><strong>W A S D / arrows:</strong> Move</p><p><strong>Shift:</strong> Sprint</p><p><strong>Mouse drag:</strong> Look around</p><p><strong>E:</strong> Interact</p><p><strong>MAP:</strong> Open location reference</p></article></div>
  </section>
  <p className="help-warning">Educational simulation only. Physics, astronaut operations, equipment and timescales are simplified. ORBITAL is not operated or endorsed by NASA.</p>
  <button className="help-return" onClick={onExit}>Back to game modes →</button>
 </main>;
}
