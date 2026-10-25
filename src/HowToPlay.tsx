import "./howTo.css";
type Props={onExit:()=>void};
const steps=[
 {name:"Choose your mode",detail:"Engineer mode prepares a spacecraft for a fictional astronaut; Commander is first-person flight; Story Mode uses verified NASA videos."},
 {name:"Strategy: select a level",detail:"Receive the assigned astronaut’s briefing and confirm the equipment, fuel and budget needed."},
 {name:"Strategy: design and launch",detail:"Configure parts, rocket and route. Authorize launch; your astronaut operates the spacecraft."},
 {name:"Strategy: manage mission events",detail:"Receive astronaut radio requests, send decisions from Mission Control, and review the crew mission report."},
 {name:"Commander: start a complete mission",detail:"Choose a mission, prepare equipment, launch, finish tasks and return safely."},
 {name:"Commander: move and use equipment",detail:"Touch: left moves, right looks, SPRINT runs, INTERACT operates controls. Laptop: WASD moves, Shift runs, E interacts."},
 {name:"Commander: find your location",detail:"Use MAP for rooms and hatches. Approach a station, then INTERACT."},
 {name:"Crew resources and EVA",detail:"Monitor food, water, oxygen, battery and fuel. Suit up before EVA; check both airlock hatches and pressure. In orbit, use thrusters to ascend or descend."},
 {name:"Progress, settings and saves",detail:"Commander saves progress in this browser. Settings controls graphics, sound and reset. Strategy progress is separate."},
 {name:"Understand the history",detail:"Choose Story Mode, watch verified official NASA footage where available, then recreate documented actions in order. Unknown controls and gaps are labeled as simulations."},
];
export default function HowToPlay({onExit}:Props){
 return <main className="help-page">
  <header className="help-header"><button onClick={onExit}>← Main menu</button><strong>✦ ORBITAL / FLIGHT MANUAL</strong></header>
  <section className="help-hero"><small>MISSION OPERATIONS MANUAL</small><h1>How to play ORBITAL</h1>
   <p>Learn modes, flight controls and mission progress.</p></section>
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
