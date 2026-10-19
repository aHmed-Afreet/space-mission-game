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

## Commander campaign

Commander Mode keeps the existing procedural cabin, life-support simulation and Strategy Mode, and adds a sequential training campaign. **Levels 1–12 are playable.** All 24 mission definitions are included, but levels 13–24 (Mars and deep space) are explicitly marked planned and cannot be launched. They are not completed destinations.

### Playable missions

| Levels | Missions |
| --- | --- |
| 1–6 · Command Training | Navigation, meals and hydration, science and rest, communications, repair training, orbital EVA |
| 7–12 · Lunar Operations | Lunar approach, guided landing, first surface EVA, geological survey and samples, research camp deployment, camp repair and transmission |

Complete a mission to unlock the next. Replay any completed mission; best scores are retained and recent attempts appear in the log. Each mission displays one current task, a plain-language instruction and a single waypoint. Ordered objectives prevent skipping safety checks or completing later tasks early. Short, dismissible tutorials introduce systems once and can be reset from the tablet.

### Design and equipment

The spacecraft builder preserves hardware, rocket, trajectory and Life Support controls. Food, water, recycling, oxygen, environmental control and batteries change real mission mass, cost, consumption and endurance. Required and optional field equipment adds mass and cost; EVA adds an airlock and its operating power. Payload, budget, power, fuel and carried-load constraints are checked before starting. Engineering details collapse by default for beginners.

Every mission is a separately provisioned sortie using the selected design, rather than a continuous multi-month transit. Destination parameters are simplified educational scenarios, not flight-planning or life-support certification data. Landing and approach use guided system procedures and countdowns, not an orbital flight-physics model.

### Walk, eat, repair and explore

- Desktop: WASD/arrows to walk, drag the view to look, E to interact. Space hops on the Moon.
- Touch: a large analog joystick moves; drag the separate look area to turn simultaneously. Release stops movement. A surface hop control appears where applicable.
- Galley: take a meal, fill a 1 L bottle, or use the dispenser. Eat or drink carried supplies from inventory. Actual stored and carried quantities decrease; hydration, nutrition, rest and duty time affect crew readiness. Meal and drink cooldowns discourage repeated consumption.
- Cabin: sleep, collect tools, repair faults with spare parts, gather science, manage communications and verify trajectory. The original station systems remain available.
- EVA: collect the selected suit and equipment, check oxygen and power, enter the airlock, close the inner hatch, depressurize, open the outer hatch and physically walk outside. Hatches are interlocked. Return, close the outer hatch, repressurize and open the inner hatch before re-entering. Suit oxygen, power and condition decrease outside. Meals and drinks are unavailable in vacuum.
- Moon: scan geology, collect physical samples, drill and photograph sites. A research camp consumes carried deployment equipment and includes solar generation, battery storage, antenna, environmental sensor, sample storage and an **unpressurized instrument shelter**. Powered experiments and transmissions consume energy. A successful camp persists into the repair mission; a repair consumes a spare part.

The temporary Mission Tablet has **MISSION, STATUS, INVENTORY, MAP and LOG** sections. Simple status cards use GOOD, WARNING and CRITICAL; optional engineering details expose cabin pressure, temperature, generation, net power, radiation and configuration. The deck/surface schematic shows actual position and current objective. The view fills the available viewport, with safe-area spacing and a tablet that starts closed.

Mission reports include overall score, science, resources, spacecraft condition, crew readiness, power, fuel, communications, samples and experiments, with practical feedback. Scores are educational performance measures, not real probabilities. Resource exhaustion or unsafe crew conditions can abort a sortie.

### Saving and offline use

The versioned campaign save (`orbital-campaign-v2`) includes configuration, progress, position/heading, current ordered objective, resources, suit, airlock, inventory, samples, camp, tutorials and reports. Restored checkpoints start paused. Hidden tabs pause automatically; no supplies are consumed while closed. A previous valid save is retained as a backup, invalid saves are handled visibly, and newer save versions are protected from overwrite.

The old `orbital-commander-v1` readiness sortie is preserved separately and remains playable through “Resume previous sortie.” Its design can be imported without granting campaign unlocks. Legacy sorties retain their original six-hour objectives, tablet and clock speed. New campaign time advances by 0.5 mission minutes per real second. Strategy remains in memory and is unchanged.

A web manifest, original icons and production service worker support standalone installation and offline reload after a successful online load. Serve `dist/` over HTTPS (or localhost). Browser installation UI varies; the app does not force browser fullscreen or hide browser controls through unsupported APIs. LocalStorage and service-worker availability depend on browser settings. There is no server synchronization.

### Architecture and performance

- `src/commander/campaign/definitions.ts`: typed mission/objective definitions, phases, prerequisites and availability.
- `environments.ts` / `equipment.ts`: destination scenarios and equipment trade-offs.
- `engine.ts`: pure ordered progression, actions, EVA, resources, camp, scoring and unlocks.
- `save.ts`: versioned checkpoint validation, backup and legacy migration.
- `CampaignHome.tsx`, `Preparation.tsx`, `Flight.tsx`, `CampaignTablet.tsx`, `Report.tsx`: campaign presentation.
- `world.ts`: lazily loaded orbital platform, Moon surface, airlock and deployed camp.
- `src/commander/simulation.ts`: original crew/life-support model; campaign opts out of legacy timed communications/equipment incidents and uses mission-defined incidents.
- `Cabin.tsx`, `interior.ts`, `layout.ts`: retained cabin rendering, physical layout and movement.
- `LegacyCommander.tsx`: previous readiness sortie UI and save compatibility.

Rendering uses shared primitive geometry, instanced fittings/rocks, small procedural textures, capped pixel ratio (1.5), a 30 fps touch rendering target, no real-time shadows or post-processing, and bounded terrain. The field module loads only for EVA missions. Rendering stops in hidden tabs. A graphics failure pauses play. These are performance budgets, not a guarantee for every iPad; validate physical Safari hardware before a presentation.

### Validation

`npm test` covers Strategy calculations, legacy Commander simulation/navigation and campaign definitions, ordered progression, all 12 complete mission flows, unlocks, supplies, suit/airlock safety, equipment trade-offs, environment differences, saving, joystick response and PWA metadata. `npm run build` checks TypeScript and produces the static application.

Browser validation uses WebGL Chromium with desktop, iPad landscape/portrait and phone viewport sizes, touch/look input, modal bounds, saved restoration and offline reload. Emulation does not replace physical iPad/Safari performance testing. All artwork and cabin graphics are original procedural assets; no agency branding or external artwork is used.
