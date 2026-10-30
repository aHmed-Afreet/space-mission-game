# Mission presentation upgrade — 2026-10-29

This implementation extends the inherited procedural scene, instancing, generated maps and quality tiers. It does not claim photorealism, geographically exact terrain, exact historical cabins or achieved physical-device frame rates.

## What changed in this build

- A typed catalog distinguishes the scientific destination from the player's surface, orbit, cruise or mission-control context. All 18 Commander and 55 Story contexts are covered. Commander 13–18 construct no landing terrain; robotic Story missions retain the mission-operator role.
- Commander missions 2, 8 and 12 have separate original satellite, telescope and communications-relay silhouettes. The worksite location, repair reach and physics remain unchanged. Indicators follow the actual repair/online flags. Source inspection identified the inherited mission-2-only visibility condition; browser acceptance is tracked separately.
- The cabin uses lighter, restrained ceramic/alloy finishes, removable insulation blankets, pressure-shell shoulders, cable trays, and physical bus indicators. Instrument screens show isolated circuits, live resource state and unresolved faults. Decorative science traces are explicitly simulated; they are not new measured results.
- Pressure-hatch seals and handles travel with the existing leaves. Station positions, hatch closure planes, targeting IDs and collision rules are unchanged.
- Camp hardware follows actual deployment flags; power cables appear only when the corresponding equipment and shelter exist. The connector indicates the saved power/fault state. The shelter is labelled unpressurized.
- Crater bowls now deform the regolith mesh. The inherited bowls were overlays beneath an unbroken terrain plane. Craters, rocks and distant relief stay clear of existing hatch, survey, sample, camp and return approaches. Lunar sky remains black; existing applicable Story Mars terrain retains its thin-atmosphere context.
- Historic exteriors have corrected compact Mercury/Gemini windows and thermal protection, Gemini adapter proportions, Apollo service-module thruster clusters and lunar-module stage/engine/foil details. Shuttle wings have a delta outline and three main engines. Dishes have concave profiles and feed supports. Existing Luna 2 and Webb constructors remain intact.
- Story pose snapshots retain the actual camera, look direction, excursion, velocity, jump and movement smoothing. Bounds and mission role are validated before restoration. These snapshots do not manufacture task progress.

## Construction budgets

Counts below were obtained from constructed Three.js geometry with a synthetic canvas, not a WebGL renderer. Triangle totals include all constructed instances, including hidden content; renderables are not measured draw calls. These numbers do not establish hardware performance. The cabin fixture uses the Mars destination, an EVA-ready training cabin and no network model.

| Layer | Battery triangles | Balanced triangles | Quality triangles |
| --- | ---: | ---: | ---: |
| Cabin | 37,402 | 319,206 | 323,910 |
| Lunar scenery including Earth | 15,264 | 31,412 | 78,572 |
| Original telescope worksite | 984 | 1,456 | 1,712 |

Cabin renderables are 257 / 282 / 290 including the star Points object. Surface scenery has 10 renderables; the telescope has 31. Battery replaces repeated microbevel geometry with shared boxes and reduces hose/circular subdivisions; functionality and interaction meshes remain. Its cabin triangle total is about 85% below the intermediate unchanged-microbevel construction (243,610). No tier adds real-time shadows or postprocessing. The existing optional Hubble model is excluded from these procedural counts and remains a separate network/GPU cost requiring browser measurement.

## Assets and rights

The executable [asset manifest](../src/presentation/assetManifest.ts) contains source, creator, usage terms, attribution, modifications, version, bytes/hash and fallback. Both loaders read their actual URLs from that manifest.

The existing optional Hubble Space Telescope (A) reference is now selected for Mission 8 and pinned to NASA-3D-Resources commit `11ebb4ee043715aefbba6aeec8a61746fad67fa7`. The downloaded GLB is 1,694,988 bytes with SHA-256 `e5ba4de15c7d359ac8fa1ab7e286aff42dec09c0fadae3db99252587f39fa384`. Preserve the **DigitalSpace / NASA** credit. The October 29 review found an upstream README statement that its assets are free and without copyright, linked NASA media usage rules allowing credited educational simulations, and no embedded GLB copyright field. This is asset-specific provenance evidence, not a blanket NASA public-domain or SPDX-license claim. NASA does not endorse this game. The externally retained review is `space-mission-audit/build-2026-10-29/asset-policy-evidence.json`.

The inherited optional Earth and Moon JPEG imagery from three.js examples remains available with procedural fallbacks. Exact imagery creator/rights and pinned versions remain unresolved in the manifest; the three.js software MIT license is not asserted to license them. No new external imagery or required model was added. All new worksite, hull, hatch, camp and historic-detail geometry and generated material maps are original procedural work.

## Lifetime and validation

Scene cleanup marks descendants before disposing resources, deduplicates shared geometry/material/maps, includes line/tether geometry, and rejects or disposes downloads that arrive after scene destruction. Invalid downloaded model extents are disposed immediately. Historic model copies own separate material instances. Procedural fallbacks remain visible when a download fails; downloaded Hubble geometry keeps the original reachable service face.

Focused validation: `node --import tsx --test src/presentation.test.ts src/history/historicVehicles.test.ts src/commander/campaign/visualUpgrade.test.ts` — **19/19 PASS**. These cover mission routing, actual orbital worksite visibility and state, camp deployment/fault appearance, terrain approach clearance, tier construction budgets, isolation readouts, historic ownership/silhouettes, role/pose validation and late-download disposal. Browser comparison, target reach, actual completion, sustained frame times, memory and physical-device behavior remain separate acceptance checks; this document does not mark them passed.
