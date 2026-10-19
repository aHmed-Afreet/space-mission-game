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

## Commander Mode — crew readiness sortie

The mode picker preserves the original Strategy game unchanged. Commander is an independent, single-crew living simulation with a six-hour readiness objective; it does not claim to provision a full Mars transit.

### Design and engineering

Configure the original hardware, rocket and transfer profile plus a dedicated Life Support section: food, water, water/oxygen recycling, oxygen tanks, environmental control and reserve batteries. The builder displays total cost, mass, net power and endurance estimates, then enforces its $300M budget, rocket payload, nonnegative power margin, essential instruments and 10 fuel reserve. Water has a greater mass cost than a meal. Recycling trades mass, money and power for endurance. Batteries add kWh capacity and mass. Every selected value initializes the actual mission.

### Walk, interact and live aboard

Use WASD/arrows or hold the onscreen touch controls to walk. Drag the view to look around. Approach a station to unlock its actions; map entries never teleport the player. The Three.js cabin includes a cockpit, science console, communications, power, galley, sleeping berth and equipment storage. The central aisle and collision boundaries keep stations reachable.

- Galley: take a meal, fill the 1 L bottle, or drink at the dispenser.
- Inventory tablet: eat a carried meal or drink 250 mL from the bottle. Stored meals decrease when taken; carried meals decrease when eaten. Water transfers from tank to bottle, then is consumed. Working powered recyclers return the configured fraction to the tank.
- Sleeping berth: rest to recover energy. Sleeping locks movement and station actions until waking.
- Equipment: collect toolkit. Power station: repair a fault using one spare part.
- Science: gather water-search data, spending crew energy and battery reserve.
- Communications: calibrate a failed link and transmit at least 30 science points.
- Cockpit: verify course using fuel, then complete the sortie once objectives are ready.

The Mission Tablet starts closed and opens from a compact HUD button as a temporary slide-out overlay. STATUS, INVENTORY, OBJECTIVES, MAP, SYSTEMS and LOG sections provide gauges, item cards, a live deck schematic and mission information. Low food/water/oxygen/power, crew readiness, cabin environment, solar activity, communications and equipment faults produce alerts. A link failure occurs at 90 mission minutes, solar activity at 120–180 and a repairable equipment fault at 210. These scheduled training incidents make emergency practice repeatable.

Default time is 1 real second per mission minute; a 5× setting is available. Pause freezes consumption. Food, hydration, duty time and sleep affect energy and mission readiness. Oxygen, reserve power and cabin environment update with mission time. Critical oxygen, pressure or energy loss triggers a safety abort. Body weight and appearance are not simulated.

### Persistence and scope

Mission configuration, supplies, crew state, objectives and recent action log auto-save to this browser's localStorage. A restored mission starts paused. Hidden tabs automatically pause; missions do not consume supplies while the app is closed. Camera position is not persisted and resumes on the flight deck. Storage failures are reported in the tablet. Refresh or switch back to Commander to resume. Strategy retains its original in-memory behavior.

`src/commander/simulation.ts` contains pure simulation and action functions, typed area/action interfaces and configuration models. `Cabin.tsx` owns rendering and movement, and `Commander.tsx` owns builder, tablet and persistence. This boundary supports future EVA, samples, docking, surface exploration and emergency modules; those future features are not implemented yet. A WebGL-capable browser is required for the 3D cabin. Models and textures are original procedural graphics; no external artwork is loaded.

Validation includes the original five strategy tests, nine Commander simulation tests and two cabin-navigation checks. The Three.js renderer is loaded separately when Commander Mode is selected, so Strategy does not download it on entry.


### Commander visual redesign

The cabin now uses compact flight, science/communications, service and habitation zones. The interior has beveled panels, structural pressure bulkheads, inset strip lights, small integrated equipment placards, upholstered seats, workstations, storage lockers, life-support plumbing, vents, a sleeping berth, galley dispenser and repair hardware. The forward flight deck has a viewport and procedural Mars backdrop. Stations are identified by their equipment, with a subtle edge light when in interaction range, not floating signs.

Move with WASD/arrows or the analog virtual joystick. Drag the separate look surface to turn. Press E or tap the compact interaction prompt to access station actions. The personal terminal opens with the Mission Tablet control; Escape, the close button or the outside backdrop dismisses it. Modal keyboard focus stays within the tablet. The map shows continuous player position, heading, current zone and next objective. Inventory cards preserve the existing food/water actions and clearly distinguish remote science observations from physical samples, which are not part of the current mission.

Automatic flight hatch motion, a hinged food cabinet, in-hand food/bottle/tool feedback, distinct navigation, science, communications and life-support displays, pulsing caution lamps and a rest transition provide lightweight visual feedback. The original simulation functions, saved-state key/schema, events, resource calculations and objective conditions remain unchanged. Presentation coordinates and collision checks are isolated in `layout.ts`; furniture, lighting and instancing are isolated in `interior.ts`. `MissionTablet.tsx` owns the six terminal sections and schematic.

Performance choices: shared low-detail primitive geometry, instanced repeated fittings, small canvas textures, capped device pixel ratio (1.5), a 30 fps rendering target on coarse-pointer touch devices, bounded practical lighting, no real-time shadows and no 3D post-processing. Rendering stops in hidden tabs. These are performance budgets rather than a guarantee of frame rate on every iPad model; test target hardware before a presentation. Reduced-motion settings disable interface transitions. A graphics context failure pauses the mission to protect saved supplies.


The final visual validation uses a WebGL-capable Chromium browser at desktop, iPad landscape/portrait and phone viewport sizes, checks modal bounds and horizontal overflow, and exercises walking, station actions, finite supplies, keyboard dismissal and saved mission restoration. Touch-pointer emulation is used for the joystick and separate look surface. This does not substitute for physical-device Safari performance testing.
