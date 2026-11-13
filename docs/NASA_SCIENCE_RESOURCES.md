# NASA science resources integration (November 13, 2026)

## Scope
ORBITAL Mission Lab uses primary NASA data and sources in the Outpost's **NASA SCIENCE LAB** screen. This feature uses publicly accessible NASA services and publicly available technical literature. It was developed independently; the project is **not NASA-affiliated or NASA-endorsed**.

The exact contents of the 2026 Junior Astronaut Mission Trainer challenge's **Resources** tab were not independently accessible when this integration was created. Do not describe any resource below as confirmed to be on that exact tab without checking the official live listing.

## NASA sources actually used in the game

1. **NASA Community Coordinated Modeling Center, DONKI Space Weather Database**
   - NASA documentation: https://ccmc.gsfc.nasa.gov/tools/DONKI/
   - Official September 2026 migration announcement: https://ccmc.gsfc.nasa.gov/news/major-updates/
   - Public API: https://ccmc.gsfc.nasa.gov/DONKI-API/get/SEP and https://ccmc.gsfc.nasa.gov/DONKI-API/get/FLR
   - Usage: Load NASA solar energetic particle-event and flare records for the last 30 UTC days. Show recorded event time, event type, NASA source link and (for flares) NASA class. Events are optional educational context; the in-game radiation index is **not** derived from NASA event counts. No secret API key.
2. **NASA Image and Video Library**
   - Docs: https://images.nasa.gov/docs/images.nasa.gov_api_docs.pdf
   - API: https://images-api.nasa.gov/search
   - Usage: Search actual NASA Moon/Mars mission photos. Show NASA ID, title, credited center and direct library reference. Photos come from NASA, not from procedural game models. Individual rights/attribution still apply; inspect records when republishing beyond this view.
3. **NASA Life Support Baseline Values and Assumptions Document (BVAD)**
   - NASA report: https://ntrs.nasa.gov/citations/20210024855
   - Usage: Cite NASA engineering literature when explaining oxygen, water, food and recycling trade-offs. The existing life-support numbers are gameplay simulations, **not** measured NASA rates.
4. **NASA Solar System Treks**
   - Reference: https://trek.nasa.gov/
   - Usage: External learning reference for planetary maps. Current Outpost terrain is still artistic/simulated; Trek layers are **not** used as textures or topographic measurements.
5. **NASA Space Apps Challenge**
   - Challenge: https://www.spaceappschallenge.org/2026/challenges/junior-astronaut-mission-trainer/
   - Usage: Educational inspiration and challenge context, not official NASA branding or approval.

## Player-visible behavior
- Open **NASA** in the Outpost's top menu (beside MAP and QUESTS).
- Also accessible from the MISSION briefing and HELP screen.
- **SPACE WEATHER** shows recent NASA events or explicitly says data is unavailable (no fabricated records). A short, optional shelter-question mini-game uses the records as educational context.
- **NASA PHOTOS** fetches NASA Image Library photos for the Moon or Mars.
- **RESEARCH** cites primary NASA sources and explains how they inform the simulation.
- Reading the panel pauses the **4-minute Outpost day timer** like MAP and HELP; exploration, rover and engineering mini-games still use the timer.
- Data requests are cached for 1 hour on the device and do not modify progress, scores, resource percentages or saves.
- Network failures are handled. Third-party API cross-origin rules may affect availability; the game remains playable if NASA is unreachable.
- Existing Outpost v2 saves, modes and previous features remain unchanged.

## Scientific limitations
Solar flares or particle-event records alone do not establish radiation dose at a particular Moon/Mars habitat. A meaningful dose simulation requires location, geometry, shielding and suitable physics/measurements. We deliberately do not map NASA-event counts to in-game hazard severity.

## Technical verification
- Tests in `src/outpost.nasa-resources.test.ts` cover NASA URL changes, response validation, API mocking, cache, photo credits, and paused timer semantics.
- After production deployment, manually check the NASA panel in landscape iPad, external resource links, scrolling and return-to-game.
- The public API and browser CORS behavior should also be checked from a live browser: automated API mocks are not proof of NASA availability on that device.

## Challenge eligibility
The base game predates the 2026 hackathon. Always follow current official NASA Space Apps rules regarding prebuilt projects, when development may begin, and how sources and team contributions should be credited. An added NASA API does not, by itself, establish eligibility for judging.
