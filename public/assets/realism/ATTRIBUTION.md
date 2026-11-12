# ORBITAL Mission Lab — 3D and material credits

ORBITAL is an independent educational simulation. It is not an official NASA product and is not endorsed by NASA, Poly Haven, or any vehicle manufacturer. The models are visual references; their appearance does not validate a fictional vehicle design or reproduce exact flight procedures.

## NASA 3D reference models

Source collection: [NASA 3D Resources](https://github.com/nasa/NASA-3D-Resources/tree/11ebb4ee043715aefbba6aeec8a61746fad67fa7), pinned revision **11ebb4ee043715aefbba6aeec8a61746fad67fa7**. Retrieved 11 November 2026.

The upstream [README](https://github.com/nasa/NASA-3D-Resources/blob/11ebb4ee043715aefbba6aeec8a61746fad67fa7/README.md) states: “These assets are free and without copyright.” It links to the [NASA images and media guidelines](https://www.nasa.gov/nasa-brand-center/images-and-media/), which permit credited educational/informational computer graphics simulations subject to third-party restrictions and no implied endorsement. Exact GLB metadata contains no separate creator/copyright field. This is a source-specific provenance assessment, not a blanket SPDX license for all NASA material. Agency marks appearing as part of historical hardware are depictions of that hardware, not ORBITAL branding.

Credit: NASA 3D Resources and the collection's [contributors](https://github.com/nasa/NASA-3D-Resources/blob/11ebb4ee043715aefbba6aeec8a61746fad67fa7/README.md#contributors). The repository does not identify individual authors for these particular GLBs.

| Local model | Original source model | Intended reference |
| --- | --- | --- |
| lander.glb | Apollo Lunar Module | Apollo lunar hardware and fictional training lander reference |
| astronaut.glb | Astronaut | EVA suit geometry; original ORBITAL locomotion rig |
| capsule.glb | Gemini | Gemini historical capsule / labeled engineering reference |
| shuttle.glb | Space Shuttle (A) | Historical orbiter family |
| station.glb | International Space Station (ISS) (B) | ISS historical external architecture |
| probe.glb | Voyager Probe (A) | Voyager mission hardware |
| rover.glb | Mars Exploration Rover - Opportunity (MER-B) | Uncrewed outpost research rover reference |
| rocket.glb | Saturn V | Labeled engineering reference and launch visualization |
| habitat.glb | Habitat Demonstration Unit (part 1) | Research prototype reference, not a generic fictional facility skin |
| habitatInterior.glb | Habitat Demonstration Unit (part 2) | Research hardware reference |
| equipment.glb | Orbital Replacement Unit | Life-support and service equipment reference |
| controlRoom.glb | JSC Mission Control Room | Historical mission-control architecture reference |
| apolloSoyuz.glb | Apollo Soyuz | Apollo-Soyuz joint mission only |

**Modifications:** Static export animation tracks removed; unused attributes/materials pruned; meshes flattened/joined; material palettes consolidated where possible; meshoptimizer simplification requested with ratio 0.35 and maximum error 0.003; textures limited to 1024 pixels and encoded as WebP; geometry Draco compressed. Original source topology limits simplification, so actual triangle reduction varies. Processed with glTF Transform CLI 4.5.1. Runtime models total 1,185,912 bytes and range from 1 to 8 material primitives per asset. No source animation is represented as recorded astronaut motion. The astronaut rig and gait are original ORBITAL approximations.

Exact source URLs, original and derivative SHA-256 hashes, sizes, triangle counts and required extensions are recorded in [manifest.json](./manifest.json). Draco decoder licenses remain at [../draco/three-0.186.1-gltf/LICENSE](../draco/three-0.186.1-gltf/LICENSE), Apache-2.0 with upstream notices. Embedded WebP is supported by current iPad browsers.

## Scanned rock PBR textures

Asset: [Rocky Terrain 02](https://polyhaven.com/a/rocky_terrain_02), Poly Haven.
License: [CC0 1.0 Universal](https://creativecommons.org/publicdomain/zero/1.0/), see [Poly Haven license](https://polyhaven.com/license).

Unmodified 1k JPEG derivatives from Poly Haven's public texture CDN:

- `terrain-base.jpg`: `https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/rocky_terrain_02/rocky_terrain_02_diff_1k.jpg`
- `terrain-normal.jpg`: `https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/rocky_terrain_02/rocky_terrain_02_nor_gl_1k.jpg`
- `terrain-roughness.jpg`: `https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/rocky_terrain_02/rocky_terrain_02_rough_1k.jpg`

This is a terrestrial rock scan used as an artistic lunar/Martian regolith analogue. It is not measured lunar or Martian surface data. Runtime UV repetition, lunar desaturation and Martian color tint are presentation changes. No photographic terrain image is used as experiment ground truth.

## Original technical materials

Panel, woven fabric and foil microstructure maps are original ORBITAL generated textures. They add material response to authored interaction geometry and require no external images. Existing planetary photographs and the Hubble model retain their own credits in the parent `planetary`, `backgrounds` and `models` directories.

All assets are self-hosted. Models load on scene entry and terrain maps load only when used. They are not mandatory service-worker installation downloads. Visual asset failure preserves the original authored mission systems and interaction geometry.

## Additional spacecraft interior assets

The newer pressure-module models, interior hardware and fabric/metal PBR maps have their own [complete credits and provenance](../interior/ATTRIBUTION.md). The pressure shell and workstation GLBs are original ORBITAL modeled architecture, not NASA cabin downloads.
