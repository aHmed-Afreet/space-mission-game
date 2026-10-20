# Space Mission Design Game

A complete client-side **React + Vite + TypeScript** educational game. The first mission, **Mars Explorer**, challenges players to design and launch a robotic spacecraft to search for water.

## Run locally

Requires Node.js 20.19+ or 22.12+.

```sh
npm install
npm run dev
```

Open the URL printed by Vite. For production:

```sh
npm run test
npm run build
npm run preview
```

`dist/` is a static web app that can be hosted on any static hosting service. Relative asset paths support subdirectory hosting. No backend, account, API key or external graphics are required.

## Gameplay

1. Read the mission briefing.
2. Customize a starter spacecraft with eight component types (up to two each).
3. Choose one of three rockets with different costs, capacities and reliability.
4. Choose a fast, balanced or fuel-saving trajectory.
5. Pass preflight validation and launch the animated simulation.
6. Resolve three randomly selected mission events.
7. Review the detailed score, decision record and design feedback. Print the report or replay.

The live resource panel shows remaining budget, mass, power margin, fuel reserve after transfer, science potential and risk. Launch requires cost at or below $220M, mass within rocket capacity, at least 10 W power margin and 10 fuel reserve, plus a water spectrometer and deep-space antenna. The builder allows invalid designs so players can experiment; preflight explains every blocking constraint.

Events affect resource totals and final scores. Unaffordable power/fuel decisions are disabled. Shielding and batteries mitigate specific event impacts. Operations can spend beyond the original budget during events, reducing the budget score.

## Scoring

Overall score: 30% science, 15% budget management, 30% reliability, 10% fuel efficiency, 15% communication. Each category is clamped to 0–100.

- Science: total instrument and event science points.
- Budget: `100 - max(0, totalCost - 160) * 1.4`.
- Reliability: base 68 plus hardware/rocket bonuses, minus trajectory risk, plus event effects; negative power or fuel imposes a 25-point penalty each.
- Fuel efficiency: `60 + remainingFuel * 0.8` (reserve management proxy).
- Communication: base 45 plus antenna bonuses and event effects.

The success percentage is a game performance score, not a physical probability of mission success. Fuel units, power margins and mission dynamics are simplified educational models.

## Structure

- `src/game.ts`: component catalog, rocket/trajectory models, validation, event effects and scoring.
- `src/App.tsx`: seven interactive stages, live resources and report.
- `src/style.css`: original spacecraft/rocket graphics, dark mission-control theme, responsive layouts, print styling and reduced-motion support.
- `src/game.test.ts`: resource, launch-validation, event-mitigation and scoring checks.
- `src/main.tsx`: React entry point.

Large touch controls support iPad and desktop. Choices use native buttons with keyboard focus and selection state. The game is held in memory; refreshing resets the mission. No copyrighted artwork, NASA branding or agency affiliation is used.

## Publication and privacy

ORBITAL is an independent **educational simulation**, not an official NASA product or astronaut training system. Flight times, celestial mechanics, life-support rates, orbital navigation, and astronaut tasks are compressed and fictionalized to illustrate engineering decisions. Missions 1–4 include source-linked NASA history briefings inspired by STS-1, STS-125, Apollo 15, and Apollo 17. They do not literally recreate actual mission procedures.

**Web publication:** deploy from `main` using `npm run build` and publish directory `dist`. CI runs `npm test` and `npm run build`. The legal information page at `public/privacy.html` documents browser-local progress and preferences. The game requires neither account creation nor an API key. A current browser with WebGL is recommended.

**Remaining release checks:** verify all twelve Commander missions and twenty Strategy challenges on real touch devices and with keyboard/mouse; airplane/offline PWA install; save/restore and reset behavior; financial progression and legacy-save migration; viewport and fullscreen; controls, accessibility and performance on physical iPad/Safari and iPhone; host deployment and privacy link. A successful build does not by itself guarantee app-store acceptance.

## New first-person historical spacecraft experience

The Space History & Stories menu has **Read History** and **Live the Story**. Live the Story features procedurally modeled historic vehicle families (spherical satellites, Vostok, Mercury, Gemini, Apollo command modules, lunar landers, Space Shuttle, stations, robotic probes, rovers and telescopes). Each story uses mission-specific tasks and four interactive stations. Some famous missions have special historical checklists.

Controls: WASD/arrows or floating touch joystick for movement; drag to look; Shift or Sprint to move faster; E or INTERACT at a station. Players verify engineering calibration, arm operations and record science readings. Finished experiences are saved in browser local storage.

**Accuracy:** These are stylized playable training environments, not dimensionally correct vehicles or exact NASA procedures. For uncrewed probes the player is a mission operator, not an astronaut on board. Historical events cannot be changed by gameplay.

## Main menu, History and How to Play

The main menu now offers **five experiences**:
- **Strategy Mode:** 20 escalating, playable mission-design challenges. Each has specific science, reliability, budget and instrument requirements. Clearing one unlocks the next. Scores are stored in browser local storage.
- **Commander Mode:** 12 implemented first-person, multi-phase spacecraft sorties, including EVA, orbital maintenance, lunar landing and geology work. Four more Mars/asteroid missions are listed as planned but cannot be launched.
- **Real Space History:** An archive of 55 carefully selected spaceflight milestones across multiple agencies and decades, with historical background, outcomes and links to authoritative archives.
- **Live the Story:** Each of the 55 selected histories now opens a first-person 3D spacecraft training scene with a historically inspired vehicle and four mission-specific objectives. Astronaut and remote-robotic missions are distinguished. Real outcomes are shown after the exercise; it is not an exact replica of the mission.
- **How to Play:** Controls and instructions for Strategy, Commander and historical stories.

The history archive is a curated selection of major missions rather than a comprehensive listing of every flight. Some links open broad official chronology pages instead of a single mission's detailed record. Historical descriptions summarize real events, while simulations, decisions and game spacecraft are fictionalized for learning.

## Commander complete-mission campaign

Commander now uses **Chapter → Mission → Phase → Task**. Small tasks no longer count as campaign levels. The original professional cabin, life support, touch controls, temporary tablet, EVA/airlock, Moon environment, inventory, science, camp, PWA and Strategy Mode are preserved.

### Fully playable flights

| Mission                   | Purpose and distinctive operations                                                                                                                                                    |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1 · Orbital Qualification | Pre-launch checks, guided ascent, orbital science/power decision, meals, hydration, rest, power-bus failure and controlled recovery.                                                  |
| 2 · Satellite Repair      | Launch and rendezvous, independent relay diagnostics, tethered EVA, physical satellite connector repair and radio test, safe return and vehicle recovery.                             |
| 3 · Lunar Science Landing | Launch, transfer duty/rest, approach and guided landing, geological scan, temperature, crater rock and subsurface sampling, context photographs, fault resolution and return.         |
| 4 · Lunar Research Camp   | Launch and cargo landing, camp-site engineering choice, actual carried equipment deployment, powered experiments, connector-trip response, communications commissioning and recovery. |

Each flight has 4–9 phases, a short briefing, required equipment, multiple stations, resource decisions, a mandatory challenge, two optional objectives and a full report. Granular launch and airlock safety procedures produce 28–57 individual task steps. First-time play targets 15–30 minutes, but this is a design target rather than a measured promise; familiarity, exploration, optional detours and acceleration change duration. The current goal is prominent, but it observes completed conditions rather than locking unrelated systems. Early meals, water, equipment collection and suit checkout are recognized. Repeated measurements after a fault need fresh evidence.

Four additional missions (future Mars and asteroid operations) are **PLANNED and cannot be launched**. Only the twelve flights above are implemented. Adding another mission does not require changing a fixed mission-count limit.

### Launch, travel and controls

Before flight: read the briefing and Agency Budget, configure spacecraft/life support, choose field equipment and unlocked technology, review risk advisories, then commit the flight. Impossible payload, power, essential-equipment, fuel and funding configurations are blocked. Marginal endurance/fuel configurations can display an advisory without blocking launch.

Pre-launch happens inside the existing cabin at the launch site. Visit power, life support, radio and navigation, verify propellant, and seal the vehicle. The launch display then runs a six-second countdown and live ascent. Thrust changes acceleration and fuel consumption; pitch relative to guidance changes climb efficiency. Separate the booster above 12 km and reach 180 km plus 7.8 km/s before orbital insertion. Vehicle appearance, telemetry, exhaust and stage state reflect the actual flight state. Operation logs and serializable flight states provide hooks for future sound effects; audio is not implemented.

These are simplified flight-training dynamics. Orbital rendezvous, lunar approach, landing and return use guided procedures, reserves and monitored time intervals rather than a precision orbital/landing physics simulator. Lunar ascent/return is represented by the controlled return burn and recovery corridor.

- Desktop: WASD/arrows, drag to look, E to interact; Space hops on the Moon.
- Touch: large analog joystick with a larger invisible hit area; separate multitouch look area. Releasing centers the stick and stops movement.
- SIM RATE: 1×, 5×, 20× and 100×. Acceleration is permitted during monitored travel/rest waits, not ascent, EVA, hatch cycling, choices or low reserves. Task/phase transitions and warnings return to 1×. Long waits clamp to their endpoint instead of overshooting the clock.
- At 1×, one real second advances 0.5 mission minutes. Launch countdown and ascent use a separate compressed flight-dynamics clock. Pause freezes all consumption; hidden tabs pause; closed apps accrue no elapsed resource use.

The five-section Mission Tablet starts on MISSION and remains closed by default. STATUS uses GOOD/WARNING/CRITICAL with optional engineering details. INVENTORY, MAP and LOG retain their visual cards, live position and saved records. Permanent MISSION, INVENTORY and SYSTEMS controls remain available during active flight, EVA and rest. Instructions name the compartment or field site. Players navigate with integrated signage and maps; floating arrows, destination markers and objective routes are removed. Optional challenges list their location without drawing guidance.

### Agency Budget and rewards

All values are in-game millions, not real mission cost estimates.

- Start with **$425M** persistent Agency Budget.
- Initial allocations for Missions 1–4: **$80M / $100M / $130M / $150M**, credited on first flight commitment only.
- The selected complete spacecraft, rocket/profile, fuel hardware, instruments, life support/supplies, EVA and field equipment are charged atomically with that allocation. Unused funds remain in the programme.
- Success base rewards: **$110M / $125M / $145M / $155M**. Optional objectives pay **$2–5M** each; science pays at most **$4M**, reserve efficiency at most **$3M**, and applicable equipment recovery **$2M**.
- Active optional work spends actual power, crew energy and sometimes a spare part; it requires the correct location and carried tools. Reserve challenges are assessed at recovery. Main objectives never require optional completion.
- Settlement uses a run ID and is applied once. The ledger records each allocation/purchase and settlement. Reloading reports cannot repeat rewards.
- Completed flights replay as **training simulations**: no spending, allocation or cash rewards, but best scores and attempts are saved. This prevents money farming while allowing practice.

A failed flight earns no performance bonuses and does not unlock the next mission. A flight with substantial science can receive PARTIAL SUCCESS, but still needs replaying. Insured recovery returns 80% of eligible hardware spending, less a repair charge up to $3M; unrefunded spending represents losses. If funds run out, a standard configuration up to $285M receives a shortfall-only recovery underwriting payment. That amount is spent immediately on the flight and excluded from insurance; it cannot be withdrawn or farmed. Higher-cost configurations need sufficient agency funds. The campaign remains retryable.

Reports show budget before, allocation, underwriting if used, flight cost, base reward, each bonus category, optional results, insurance/repair charges, total earned and budget after, alongside score/rank, science, crew, resources, actual fuel/battery remaining and samples/experiments.

### Technology and engineering

Mission 1 unlocks a high-gain radio (faster acknowledgement). Mission 2 unlocks an extra 1 kWh reserve battery and extended-duration suit (0.50 kg oxygen, 25% more battery). Mission 3 unlocks a 60 W solar wing. Access persists; installing a mission-fit upgrade costs money and adds mass on each real flight. Basic controls, standard hardware and required mission equipment are never locked behind a purchase.

Builder decisions still initialize actual resources. Water/food increase mass and cost; water/oxygen recycling consumes power and improves endurance; batteries add reserve and mass. Required portable tools affect experiments and repairs. A 28 kg field-pack limit excludes the worn suit. A research shelter is **unpressurized instrument protection**, not a place to remove a helmet.

### Persistence and migration

`orbital-campaign-v3` stores Agency Budget/ledger, unlocked technology, configuration, full mission/phase/task progress, flight controls, operational observations, resources, suit/airlock, carried equipment, optional work, camp, reports and tutorial dismissals. Older v3 checkpoints receive compatible observation defaults without resetting money or mission progress. Checkpoints resume paused at 1×. Previous valid data is backed up; invalid saves produce a visible warning; newer versions are protected from overwrite.

A v2 task-level campaign migrates spacecraft configuration, outposts and prior results into a visible programme archive. Completed old chapters are recorded; completed Command Training grants high-gain research access. Old task-level achievements do **not** skip the new complete-flight sequence. The old checkpoint, including supplies and position, remains archived; new funded flights provision a fresh spacecraft. The original v2 storage entry remains untouched. The older `orbital-commander-v1` readiness sortie also remains separately playable and uses its original systems and timing.

The original manifest/icons, standalone mode, safe-area layout and production service worker remain. Serve `dist/` over HTTPS/localhost; after the first successful online load it supports offline reload. Normal browser play does not require installation, fullscreen APIs or an account. Browser storage permissions still govern local saving. No server/cloud save is used.

### Architecture and validation

- `definitions.ts`: complete-flight chapters, phases, tasks, event choices, optionals, rewards, technology unlocks and planned content.
- `engine.ts`: goal progression, guided flight, resources, freely available station actions, EVA, science, camp and reports. `observations.ts` records operational evidence, earlier preparation, visits, rest and data acknowledgements.
- `economy.ts`: funding, purchases, idempotent settlement, failure recovery and technology catalog.
- `save.ts`: v3 validation, backup, archive migration and protected future versions; `legacyDefinitions.ts` / `legacySave.ts` preserve v2 interpretation.
- `LaunchView.tsx`: lightweight original SVG/CSS flight display; `CampaignHome`, `Preparation`, `Flight`, `CampaignTablet`, `Report`: programme interface.
- `world.ts`: lazy orbital platform/satellite, lunar terrain and live deployed camp; existing `Cabin`, `interior`, `layout` and `simulation` retain cabin and living systems.

`npm test` covers the original Strategy/Commander simulations plus complete flights, phase/task order, money conservation, funding/spending/settlement idempotency, optional work, unlocks, failed retry, migration/checkpoint restore, flight and hatch safety, equipment effects, environments, touch-vector logic, PWA metadata and exact Strategy source fingerprints. `npm run build` checks TypeScript and bundles the application.

Browser checks cover the launch interface/dynamics, Mission Control and purchase/restore flow, free station access, early eating/drinking, persistent inventory, route-free maps, camp failure choices, financial reports and desktop/iPad/phone layouts. They use WebGL Chromium emulation; physical iPad/Safari frame rate and first-time play duration have not been measured. Rendering retains instancing, low-poly geometry, small textures, capped pixel ratio, touch frame budget, no real-time shadows/post-processing, lazy field loading and reduced-motion support. All visual assets remain original; no agency branding or external artwork is used.

### Free-roam operating rules

Normal stations remain available independently of the current goal. The interaction menu exposes inspection and working functions directly: galley stores, crew rest, power/cabin status, science instruments, Earth link, equipment collection, suit checkout and field/camp equipment. Inspections report actual live values to the console notification and mission log; detailed telemetry also remains in SYSTEMS. Radio activity consumes battery energy, science uses power and crew energy, repairs consume parts, and EVA equipment uses carried tools and suit reserves.

Real restrictions remain: launch checks and countdown, safe hatch pressure, a stable orbit/landing before EVA, tools and diagnosis before hardware repair, a completed approach before landing, valid instruments and access for field work, actual collected data plus acknowledgement for transmission, and mission-critical conditions before return. Eating and drinking are unavailable with a sealed helmet in vacuum or during ascent. Empty stores, short intake cooldowns and full hydration/nutrition still apply. These are physical/resource constraints, not current-task locks.

Orbital electrical faults are triggered by operating time, even while an unrelated goal is current; camp connector faults follow actual experiment operation. Either may be inspected and resolved before its checklist goal is displayed. World state, actions and resulting observations persist. Station faults are still simplified repeatable training scenarios, not a full electrical or life-support model.

### Physical spacecraft operations

Campaign flights now include persistent sliding section hatches, hinged lockers and local storage access. Hatch collision stays closed through the opening animation and prevents closing on the crew. Food, water, equipment, spare parts and samples have physical storage locations. Meals and portable equipment can be taken and returned; a suit can be stowed safely in the pressurized cabin. Suit checkout no longer silently collects every field tool: visit the appropriate locker and respect the existing pack-mass limit.

Nearby consoles operate the power buses, solar input, payload/radio circuits, emergency load shedding, water/oxygen recycling, cabin cooling/setpoint, antenna selection and navigation controls. These change consumption, generation, cabin temperature or mission readiness. Landing and return burns require the manoeuvre circuit to be armed and the correct navigation target selected. The goal checklist does not lock these controls.

`ship.ts` models deterministic operating-time faults in power, solar, communications, cooling, oxygen, water, science and navigation. A new fault requires diagnosis, local maintenance-panel access, the affected circuit isolated, a carried toolkit and one spare part, followed by circuit restoration and verification. Fault messages use advisory/caution/warning/emergency levels; strong cabin warning lighting is reserved for warning/emergency conditions. Existing scripted mission events and safety checks remain active.

Subsystem and portable-equipment condition persists between funded flights. Field use wears equipment and affects suit power demand. Mission Control offers explicit, priced servicing with an Agency Budget ledger entry; training flights do not change persistent condition or funding. Samples retain collection location, mission time, mass, classification and value in the inventory/archive and final report. Radio acknowledgements and authorization messages enter a categorized, timestamped log after a mission-time delay.

`fixtures.ts` adds lightweight shared-geometry cabin hardware and animations; `StationControls.tsx` exposes nearby operations within the existing interaction menu. `audio.ts` synthesizes ventilation, engine tone, footsteps, suit breathing, interaction and radio/warning cues without downloaded audio. Audio starts after a user gesture; LOG contains persistent mute and ambience/effects/radio levels. Existing tablet tabs, guidance, inventory, orbital/surface views and responsive controls remain in place.

This update does not add a manual multi-stage landing simulation, timed scan/drill experiments, a full camp cable-routing/priority model, continuous day/night terrain lighting or six-axis suit inertia. The existing guided landing, field science, camp generation/consumption and gravity-dependent movement remain playable. Future destination definitions are retained without presenting their missions as complete.

## Visual and exploration realism pass

Historical first-person scenes now have a safe optional **EVA / AIRLOCK** operation for crewed missions. From the spacecraft hatch, players equip a sealed spacesuit, check remaining oxygen and cycle the airlock before exiting. A return button works only near the outside hatch. Surface scenes include procedural relief and rocks; orbital scenes have no fake planetary floor and render destination-appropriate textured globes with Earth clouds. EVA excursions for missions that did not really include an EVA are clearly labelled fictional training. Historic robotic missions remain remote-control scenarios rather than putting an astronaut aboard an uncrewed probe.

Commander EVA-enabled missions preserve their existing suit reserve, pressure-equalization and mission safety checks. Section and EVA hatch buttons can now be aimed at from either side. Opening cabinets shows their physical contents (food rations, water bottles, suits, tools, sample containers and emergency kits), subject to the current saved inventory state. Planetary textures and interior detailing are **procedural stylized approximations**, not photogrammetry, certified spacecraft geometries or exact orbital physics.

This update does not convert all Commander non-EVA missions into EVA missions, nor does it turn the flight simulator into a photorealistic commercial game. Future art and level-design work can expand these elements incrementally without losing campaign saves.

### Optional planetary imagery

Earth and lunar globe models first display a locally generated fallback texture. When online, the game attempts to load public example planetary JPEG textures from the [three.js examples planetary texture directory](https://github.com/mrdoob/three.js/tree/master/examples/textures/planets), then replaces the fallback texture only after loading succeeds. Offline play and image-network failures still use the bundled procedural generator. The game makes no claim that procedural Mars and other planet maps are photographic replicas. Planetary imagery is used for educational visualization; credit for the example imagery belongs to its original creators/source archives, including NASA where applicable.
