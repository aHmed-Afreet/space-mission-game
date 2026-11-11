# ORBITAL Mission Lab — realism release

This release improves shared rendering across every mode while retaining mission engines, inventory, engineering calculations, checkpoint formats and local progress keys. It is an independent educational game, not a NASA product.

## Implemented

- **Commander (18 missions / six campaigns):** formed twin windscreen and continuous forward console with live MFDs; curved pressure frames, contact shading, quality-tier reflections; actual imported stowed EVA suit and service equipment; imported lunar module and scanned PBR regolith in lunar scenes; continuous highlands; Saturn V reference tracking view driven by existing launch state; gravity-aware first-person head movement. Static detail batching reduces draw calls. Camera collision and station coordinates retain existing rules.
- **Junior Astronaut (Moon and Mars):** distinct vacuum/dust lighting and sky, scanned rock albedo/normal/roughness maps, continuous terrain relief outside the level base, imported articulated astronaut, research rover and machinery, readable facility telemetry displays, quieter interior materials, gravity-dependent gait, graphic quality tiers, adaptive resolution, static scenery batching. All six authored facility types, animated doors, ten-sol routines and resources remain.
- **Mission Planner (20 challenges):** lazy interactive real Gemini/Voyager inspection, NASA Saturn V reference launch/transfer visuals, keyboard/touch orbit and zoom, original technical component drawings and selected mass manifest, launcher schematics and selected-route diagrams. Remains a planning game; models are explicitly labeled historical references, not a physical simulation of the selected fictional design.
- **Featured stories and full archive (10 featured / 55 total):** distinct capsule, lunar, shuttle, station and terrestrial operations architecture; analog and modern instrument panels; correctly matched historical GLB exteriors with existing authored fallbacks; imported mission-control and service hardware; camera collision around consoles. Robotic missions retain terrestrial operator context. Movement and playable cabin dimensions remain educational reconstructions.
- **Interfaces:** photographic landing page and six-mode directory, restrained matte controls and HUDs, readable loading/progress and historical screens; accessible graphics selector on the main menu and Outpost selection. Existing iPad viewport and touch scroll safeguards remain.

## Assets and optimization

See [asset credits](public/assets/realism/ATTRIBUTION.md) and [exact provenance/budget manifest](public/assets/realism/manifest.json).

13 new self-hosted NASA educational GLB derivatives total **1,185,912 bytes**: Apollo Lunar Module, astronaut, Gemini, Shuttle, ISS, Voyager, Opportunity, Saturn V, Habitat Demonstration Unit parts 1/2, Orbital Replacement Unit, JSC Mission Control Room and Apollo-Soyuz. Source-specific NASA media guidelines permit credited educational simulations; these are not a blanket software-license claim. Historical hardware marks do not imply endorsement. Some reference files are available for future use rather than substituted into an unrelated historical mission.

Poly Haven Rocky Terrain 02 base color, OpenGL normal and roughness maps are **CC0**, approximately 2.27 MB total. They are artistic terrestrial analogues, not measured lunar or Martian soil. Original technical panel/fabric/foil maps and the approximate astronaut rig are authored for ORBITAL.

Models are mesh-simplified, Draco-compressed, flattened/consolidated into 1–8 material primitives and use WebP textures capped at 1k. Scenes request them lazily; offline installation does not preload the new library. Successfully used assets cache on demand, and storage quota failure does not block play. No commercial-game assets or remote runtime asset dependencies were added.

## Verification and practical limits

Automated validation covers all existing mission/state/save regressions plus asset hashes and budgets, astronaut skin weights, static batching, historical family matching and camera collision. Actual Chromium WebGL screenshots cover menus, cockpit, lunar/EVA, Outpost, Planner and historical scenes. Isolated browser contexts and test checkpoint fixtures were used; no real player saves were changed.

The available renderer is software SwiftShader. Its FPS results are not iPad measurements. **30 FPS on physical iPad has not been established**; real-device profiling remains necessary. Adaptive resolution, bounded geometry/textures, batching and demand rendering reduce GPU work, but do not guarantee a frame rate on every device.

This is a broad practical improvement, **not complete photorealism**. Main cabins and facilities retain authored procedural interaction architecture, augmented with genuine models/materials. Not every vehicle has an imported cockpit interior; exact historic dimensions and procedures are not reproduced. Natural full-body eating, sleeping, repair and airlock choreography is not implemented throughout the game; existing interactions and animations are preserved. No new Mars/asteroid surface Commander gameplay was introduced. These remain future modeling/animation work.

### Release checks

- `npm run build` (including `tsc -b`): passed.
- `npm test`: **399 passed, zero failures/skips**.
- `git diff --check`: passed.
- Asset audit: all 13 GLBs loaded and rendered in Chromium WebGL without asset errors; checksums and mobile byte/triangle budgets verified by regression tests.
- iPad-sized menu (1024×768 touch emulation): six modes present, no horizontal overflow or page errors, buttons at least 44px high, graphics selector works.
- Browser verification included Commander cockpit and seeded lunar/orbital EVA checkpoints, Outpost interior and imported suit, historical Apollo egress with task advancement, Shuttle and Voyager control scenes, Planner model loading/component manifest/keyboard inspection and launch progression.
- Static cabin fittings batch from 158 source draws to 14. Inspected Planner science model: 3 calls / approximately 28k triangles; historical Apollo: 156 calls / 57k triangles inside and 16 calls / 37k outside. These are scene work counts, not a hardware frame-rate guarantee.

Vite reports its normal >500kB warning for the lazy shared Three.js chunk (about 622kB minified / 159kB gzip). Main-mode routing stays lazy; this warning is not a build failure.
- Final Outpost browser checks: Moon/Mars renderer captures loaded without page errors; Mars map opened and closed, then exiting/reopening retained the saved day and resources. Exterior captures used the real interactive World3D renderer with explicit test spawn fixtures rather than altering player saves.
- Final Planner browser flow: adding a component updated the mass manifest; keyboard orbit/zoom worked; launch advanced to transfer and mission-control decisions without page errors. Launch scene budget was 11 calls / 13,250 triangles and transfer was 9 calls / 16,008 triangles in this test view.
