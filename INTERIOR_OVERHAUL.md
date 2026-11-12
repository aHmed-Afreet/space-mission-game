# ORBITAL spacecraft interior overhaul

This release replaces the earlier layered Commander cabinet-and-panel presentation with a coherent original pressure-module interior. It covers the shared Commander cabin (all 18 missions and legacy cabin play), its interactive stowage and EVA airlock, and the shared historical interior renderer used by Featured Stories and all 55 archive missions. Mission Planner and Outpost gameplay were not redesigned by this interior release.

## Visible changes

- **Flight deck:** contoured restraint couches, continuous formed instrument wing, recessed live MFDs, tactile guarded controls, deep twin pressure-window frames and proper structural seals.
- **Communications:** dedicated RF cartridges, retained receiver modules, routed coaxial cables, handholds and live waveform instrumentation.
- **Engineering/life support:** exposed manifold plumbing, tapered pressure vessels, mechanical connectors, protected valves, pump hardware and power-bus indication.
- **Galley/water:** formed dispenser niche, water connection, retained work tray, warming/storage hardware and the existing food cupboard/inventory animation.
- **Science:** purpose-built laboratory workcell, transparent hood, microscope, sample carousel/vials and live readings.
- **EVA/equipment:** full-height imported suit in a retention cradle, formed service tray and actual tool/cargo/scientific hardware. Suit and item visibility follow real inventory state; closed compartments do not preload all their contents.
- **Passageways:** continuous curved liner panels, quilted fabric PBR finish, ceramic painted sections, pressure flanges, recessed practical lamps, routed service bundles, handrails and non-slip service deck. The old overlapping hull/cabinet detail layers are no longer installed.
- **Airlocks:** formed pressure tunnel and rounded compression frames, inspection ports, gaskets, captive fasteners and mechanical handwheels. Moving leaf positions and analytic interaction/collision planes stay at the original coordinates. Non-EVA spacecraft retain a sealed restricted aft hatch.
- **Historical interiors:** contoured era-specific console housings, pressure lining, stowage, light coves and original analog/modern instrument faces. Crewed and terrestrial robotic operations remain distinct. These are educational reconstructions, not exact historical dimensions or procedures.

## Models and material provenance

[Complete credits and exact source/runtime hashes](public/assets/interior/ATTRIBUTION.md) · [Machine-readable manifest](public/assets/interior/manifest.json).

The two main cabin GLBs are **original ORBITAL authored models**, not NASA cabin downloads. No suitable complete NASA cabin/seat interior was available in the reviewed collection. Purpose-drawn lofts, extruded pressure profiles, recessed openings and contoured furniture were authored in metric simulator coordinates and baked into GLB. Their source and reproducible export/compression instructions are in [scripts/interior](scripts/interior/README.md).

New NASA reference hardware: Crew Lock Bag, Pistol Grip Tool and Infrared Camera are used as inventory contents. Orbiter Docking System and Flight System Support are documented optional reference files; they were not passed off as complete cabin/hatch models. The existing NASA astronaut supplies the suit geometry. Source-specific NASA media guidelines and credits apply; ORBITAL is independent and not NASA-endorsed.

ambientCG **Fabric030 and Metal038** base color/normal/roughness/metallic maps are **CC0**. Neutral quilted liner albedo and height-derived stitch normals are original derivatives of the cloth scan, with source attribution and modifications recorded. Paint, textile, rubber, glass and metal retain different material responses. Architecture normal maps are omitted in Battery mode; small stowage fittings retain their cloth normal.

## Performance and loading

- Draco geometry compression; original material names and **UV coordinates retained** so runtime PBR maps actually work.
- Quality shell + workstations: **458,816 bytes**, 121,440 triangles, 19 material primitives. Balanced/Battery variants: **445,912 bytes**, 109,630 triangles. Simplification uses tight error bounds and locked topological borders; pressure openings and instrument seams are retained.
- Maps capped at 1k; quilt maps 512px. New library including both geometry tiers, references, maps and documentation is about 3.2MB on disk. Only the selected model tier and visible contents load.
- Static material batching, batched movable closures, existing adaptive pixel ratio and graphics settings. No bloom, SSAO or additional realtime shadow pass was added. Contact shading and low-resolution material reflections supply indirect-light cues.
- Original-model fallback appears independently of successful downloads. Local model failure does not replace the mission engine with a mockup. Successfully used assets cache on demand; service-worker installation does not download the new library in advance.
- Fixed-view render counts fell, for example, from 84 to about 40 in the cockpit, 212 to 168 in engineering and 431 to 363 looking down the corridor. Detailed geometry increases triangle work; the default reduced-geometry variant lowers that cost further. These are rendering-work counts, not a frame-rate claim.

**Physical iPad 30 FPS is not verified.** The available browser uses CPU SwiftShader, which is much slower than an iPad GPU. Real-device profiling is still required; no hardware performance guarantee is inferred from these captures.

## Preservation and verification

The release is based on main commit `5cfc1f0`, retaining all 15 newer stationary/multitouch INTERACT fixes byte-for-byte. No mission definitions, engineering calculations, save schemas, objective IDs or analytic target coordinates were changed. Additional tests cover state/save purity across all stations and graphics tiers, real stowage contents, exact door completion timing, hidden-panel batching, map lifetime, retained GLB UVs and unobscured historical displays.

Automated checks: complete suite **422 tests passed**, TypeScript passed and production build passed. The usual Vite warning remains for the shared Three.js chunk; mode routing remains lazy.

Actual Chromium captures use fixed checkpoint views through the game's real renderer plus app navigation and touch controls. Captures are not concept art. Fresh isolated storage was used; no real player saves were reset. Before views use the prior interior at `cef65c5`; the newer 15 control commits did not change those visuals.

## Same-view before/after evidence

| Area | Before | After |
| --- | --- | --- |
| Flight deck | [Before](docs/interior-review/before-cockpit-wide.png) | [After](docs/interior-review/final-cockpit-wide.png) |
| Communications | [Before](docs/interior-review/before-communications.png) | [After](docs/interior-review/final-communications.png) |
| Engineering | [Before](docs/interior-review/before-engineering.png) | [After](docs/interior-review/final-engineering.png) |
| Galley | [Before](docs/interior-review/before-galley.png) | [After](docs/interior-review/final-galley.png) |
| EVA suit storage | [Before](docs/interior-review/before-eva-suit.png) | [After](docs/interior-review/final-eva-suit.png) |
| Science | [Before](docs/interior-review/before-science.png) | [After](docs/interior-review/final-science.png) |
| Passageways | [Before](docs/interior-review/before-corridor.png) | [After](docs/interior-review/final-corridor.png) |
| Aft hatch | [Before](docs/interior-review/before-airlock.png) | [After](docs/interior-review/final-airlock.png) |

Actual historical gameplay: [Apollo interior](docs/interior-review/history-apollo.png), [Apollo EVA](docs/interior-review/history-apollo-eva.png), [Shuttle](docs/interior-review/history-shuttle.png), [robotic mission control](docs/interior-review/history-voyager.png).

The result remains an original educational simulation, not photorealism or an official spacecraft digital twin. Some small control/held-item geometry and exterior systems remain procedural. This release deliberately replaces the major visible interior forms and materials while preserving the working mission systems.

Full application HUD captures: [cockpit](docs/interior-review/gameplay-cockpit.png), [communications](docs/interior-review/gameplay-communications.png), [galley](docs/interior-review/gameplay-galley.png), [EVA equipment](docs/interior-review/gameplay-eva.png). The unchanged mission/resource displays and touch controls remain live over the new geometry.

The built-game touch test passed primary stationary INTERACT and secondary INTERACT while a joystick contact remained held. Station operations stayed open through asynchronous position sync; the document remained viewport-fixed. Five app views reported no page/asset errors and canvas dimensions matched the 1180×820 visible viewport. Historical Apollo interior/airlock egress, Shuttle and Voyager control scenes also loaded without page errors.

[Full HUD engineering capture](docs/interior-review/gameplay-engineering.png). Screenshots were taken after actual rendered frames and asset loading; early software-renderer warm-up frames were rejected rather than presented as the visual result.
