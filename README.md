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
