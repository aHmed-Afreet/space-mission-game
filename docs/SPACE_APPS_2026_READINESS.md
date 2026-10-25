# Space Mission Game — competition readiness (October 2026)

**Project:** ORBITAL Mission Lab. Independent educational simulation, not affiliated with NASA.

**Status:** Engineering preparation in progress; NOT an approved Space Apps submission.

**Existing project:** Development began before the November 14–15, 2026 hackathon. Disclose the existing GitHub history. Obtain guidance from the 2026 Local Event lead before presenting this repository as an event entry. Do NOT call existing work new hackathon work; earlier NASA Space Apps guidance asked teams to begin challenge work during the event. Approval cannot be inferred from a passing build.

## The educational challenge

Real spacecraft design forces trade-offs: a larger instrument yields more science but increases mass, power needs and cost. The wrong rocket, inadequate resources or a risky trajectory can block the mission. Space Mission Game makes those interconnected engineering decisions playable.

### Existing features
- Strategy Mode: 20 sequential spacecraft-engineering assignments with rocket, payload, budget, resource, event and score decisions.
- Commander Mode: 18 implemented missions in six independent campaigns, with Level 1 in each available from the start. Includes first-person EVA, spacecraft systems and repair/recovery tasks.
- History: curated educational context and fictional, historically inspired simulations.
- Mission Decision Lab: NASA-cited solar energy, travel of light and gravity context; live game-specific resource headroom beside existing spacecraft controls.

## NASA-source evidence and limits

| NASA source | Scientific reference | What the game does | What it DOES NOT claim |
| --- | --- | --- | --- |
| [NASA GSFC Solar Irradiance](https://earth.gsfc.nasa.gov/climate/projects/solar-irradiance/science) | ~1,361 W/m2 incident at 1 AU | Shows inverse-square scaling with solar distance | Predict solar-array efficiency, eclipses, orientation or battery discharge |
| [NASA Mars facts](https://science.nasa.gov/mars/facts/) | Mean Sun–Mars distance ~1.52 AU | Computes Mars sunlight ~43% of Earth using 1/r² | Compute live Mars ephemeris |
| [NASA Moon facts](https://science.nasa.gov/moon/by-the-numbers/) | Moon surface gravity ~1.624 m/s² | Displays gravity context for lunar missions | Solve full lunar descent physics |
| [NASA light-travel explainer](https://science.nasa.gov/mission/voyager/voyager-1/voyager-1-what-is-a-light-day/) | Mean Earth–Moon distance ~384,400 km and Mars one-way radio delay ~3–22 minutes | Calculates Moon mean delay ~1.28 s, labels Mars as variable | Implement actual delayed communication in the game engine |

The game explicitly does not invent an exact sunlight, gravity or communication value for an unspecified asteroid. The educational panel is not a source of mission-certified engineering numbers.

The rest of the game uses fictional compressed timings, cost credits, fuel units, power/supply approximations, risk scores, and success ratings. No part of the product is a real spacecraft guidance or training system.

## Three-minute judge demo

1. Home -> Build & Launch Missions -> Level 1 -> Spacecraft Builder.
2. Add/remove an instrument. Demonstrate the live changes to mass, power, remaining budget and expected science. Select another launch vehicle and compare payload limits.
3. Open Mission Decision Lab. Explain which numbers are NASA sourced and which are game assumptions. Point out sunlight at Mars vs Earth and one-way communications delay.
4. Validate the design, launch, resolve a simulated problem and review the mission report.
5. Home -> Fly as an Astronaut -> Satellite Repair & EVA -> Level 1. Show a short, rehearsed segment demonstrating the physical 3D gameplay and recovery.

Do not attempt to tour every campaign during a short judging presentation; demonstrate one verified complete experience, then highlight other available tracks.

## Release verification (real device tests are NOT complete simply because CI is green)

### Automated checks
- [ ] Latest GitHub Actions npm test and npm run build are both successful on the final SHA
- [ ] No new console or TypeScript errors
- [ ] Live hosting is confirmed serving that SHA

### Manual iPad and desktop
- [ ] iPad: all menu and game modes open with no black-screen loading errors
- [ ] All six campaign pages open and Level 1 of each is available
- [ ] Level 2 of one campaign unlocks only after its own Level 1
- [ ] Touch joystick, sprint, interaction and map work at different orientations
- [ ] EVA hatch buttons work on both sides; equipment can be collected and used
- [ ] Fault repair resumes the original mission objective, without corrupting progress
- [ ] Pause -> Save -> exit -> reload -> Resume preserves mission state
- [ ] Completed/failed/replayed missions preserve scores and finance correctly
- [ ] Strategy and Commander tradeoff numbers change when hardware changes
- [ ] All cited NASA source links open and are accurately attributed
- [ ] Check offline/PWA install, iPhone controls and laptop mouse/keyboard
- [ ] Test on an actual slower device; record performance, layout and any interaction blockers
- [ ] Show the prototype to at least one other student without instructions, record confusion, fix reproducible problems

### Competition actions requiring the participant/team
- [ ] Confirm the 2026 official challenge brief, category and eligibility
- [ ] Ask the Local Event organizers specifically about the existing pre-event repository and how to comply
- [ ] Register correctly as an under-18 participant with parent/guardian if required
- [ ] Make and document new, eligible hackathon work during the event where required
- [ ] Record screen demo; add screenshots, working link, GitHub source, team members and credits
- [ ] Document evaluation with real learners rather than claiming unmeasured impact
- [ ] Submit through the official NASA Space Apps project portal by Nov 15, 2026, 11:59 PM local event time

## Ninety-second pitch (adapt and verify the presentation)

0–15s: Students know that rockets fly, but do not experience how engineers balance scientific ambition against spacecraft limits.

15–35s: Our mission game lets students design a spacecraft, choose a rocket and transfer plan, and observe consequences to mass, budget, electrical power and science.

35–55s: Mission Decision Lab connects those tradeoffs to cited NASA facts and visibly separates facts from simulation assumptions. For example, sunlight at Mars is substantially weaker than at Earth.

55–75s: Commander Mode allows students to operate equipment, respond to malfunctions and learn why engineering margin matters.

75–90s: This is a learning tool: students can test ideas and see their engineering tradeoffs immediately.

## Organizer references

- [NASA Space Apps 2026 event](https://www.spaceappschallenge.org/2026/)
- [NASA official October 15 announcement](https://science.nasa.gov/universe/nasa-welcomes-all-ages-experience-levels-for-space-apps-challenge/)
- [Older NASA Space Apps participant FAQ about start-of-event work](https://legacy.spaceappschallenge.org/resources/faq/)

Awards, event acceptance, legal eligibility and live-device quality cannot be guaranteed from automated testing alone.
