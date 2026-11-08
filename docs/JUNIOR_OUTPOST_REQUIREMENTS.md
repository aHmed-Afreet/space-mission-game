# Junior Astronaut Mission Trainer — design and challenge mapping

## Mission objective

A student runs a fictional lunar or Martian research outpost for ten simulated sols. The learning goal is to experience engineering trade-offs among **life support, radiation shielding, electricity and food production**. This addition runs from **Home → Junior Astronaut — Space Outpost**, separately from Commander, Strategy and History.

## Challenge requirement traceability

| Requested concept | In-game implementation |
| --- | --- |
| Interactive Moon or Mars outpost | Two playable destinations with independently persisted saves; schematic base with six inspectable facilities |
| Life support | Linked oxygen/water/food meter; recycling consumes electrical power and recovers oxygen and water |
| Radiation protection | Shield level and cumulative exposure; solar particle events affect exposure; crew safety depends on exceeding the model threshold |
| Power | Solar generation responds to daytime, night and dust; battery energy carries loads across low-generation periods; priorities allocate electricity |
| Food production | Greenhouses grow crops, consume water and power; a harvest action converts crop points into edible food and records production |
| Competing demands | One major construction or operational decision per sol and a finite mission credit budget; life-support-first, balanced and crop-first priorities |
| Success and failure | Ten-sol survival with six clear requirements; depleted essential supplies or unsafe crew conditions end a run |
| Learning and evidence | Daily forecast, power projection, decision feedback and history, objective checklist, final score and official NASA reading links |
| Beginner/Youth accessibility | Simple action labels, touch-sized buttons, no reaction-time requirement, responsive iPad/iPhone/desktop layout |
| Safe persistence | Destination-scoped versioned browser localStorage, schema validation, restart confirmation; existing game saves unchanged |

## Rules and simplifications

This is an independent educational game, **not affiliated with NASA**. The resource percentages, credit costs, sol progression, sunlight scenarios, storm timings, crop growth, radiation index, and victory thresholds are invented game rules. They are **not calibrated physical rates, NASA mission requirements or actual probabilities of crew survival**.

The relationship between the systems is educational: solar panels provide electrical energy; water recycling costs energy; greenhouses use water and energy to grow food; shielding protects crew from radiation; storms and darkness can reduce available electricity.

The Moon's true day/night cycle and Mars's true weather cannot be forecast using this toy model. Events are deterministic and repeatable for teaching purposes. Real engineering would require calculations of mass/thermal loads, crop yield, pressurized atmospheric composition, life-support redundancy and tested operational procedures.

## Reviewer walkthrough

1. Start **Junior Astronaut — Space Outpost** from the homepage.
2. Choose **Moon** (beginner) or **Mars** (advanced).
3. Inspect the **Crew Habitat, Solar Field, Storm Shelter, Life Support, Greenhouse and Battery Bank** on the map.
4. Compare **Life support first**, **Balanced** and **Food production** power allocation, watching the projected battery change.
5. Reinforce radiation protection, grow and harvest crops, conserve energy for a lunar night or dust storm and advance ten sols.
6. Show the mission score, six success requirements, decision history and links to NASA scientific background.
7. Start the other destination to compare its solar and hazard profile.

Suggested safe example routes for verification:
- **Moon:** Sol 1 Reinforce radiation shelter; Sol 2 Harvest food crops; otherwise Monitor systems (Balanced power).
- **Mars:** Sol 1 Expand solar arrays; Sol 2 Reinforce radiation shelter; Sol 3 Harvest food crops; otherwise Monitor systems (Balanced power).

These simple routes demonstrate attainability, not an optimal or uniquely correct strategy. More complicated engineering decisions can improve or harm resource outcomes.

## NASA background references

- [NASA — Moon by the numbers](https://science.nasa.gov/moon/by-the-numbers/)
- [NASA — Mars facts](https://science.nasa.gov/mars/facts/)
- [NASA GSFC — Solar irradiance science](https://earth.gsfc.nasa.gov/climate/projects/solar-irradiance/science)

The NASA links provide external background facts. No source is claimed to validate fictional game percentages.

## Testing and publication

- The game's tests run through `npm test` and include deterministic success routes, radiation/solar/life-support interactions, one-action-per-sol enforcement, invalid save rejection, mission failure and resource nonnegativity.
- `npm run build` checks TypeScript and produces the production bundle.
- Additional real-device testing on iPad and browser-based user observation remain necessary before saying that physical gameplay has been fully verified.
- The repository existed before the 2026 NASA Space Apps event. Preserve prior Git history and obtain the event organizer's instructions on eligibility and what development may qualify as work during the event; do not claim pre-existing work was newly produced at the event.
