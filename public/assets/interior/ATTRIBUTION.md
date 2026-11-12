# ORBITAL Mission Lab — interior hardware and PBR material credits

ORBITAL is an independent educational simulation, not an official NASA product. Historical reference hardware is not a claim that the fictional training spacecraft duplicates an actual flight vehicle, layout or procedure. No agency endorsement is implied.

## Genuine NASA reference hardware

All five models below come from NASA's [NASA 3D Resources](https://github.com/nasa/NASA-3D-Resources/tree/11ebb4ee043715aefbba6aeec8a61746fad67fa7) collection, pinned to revision `11ebb4ee043715aefbba6aeec8a61746fad67fa7`, retrieved 11 November 2026.

| Local file | Exact source model | Purpose |
| --- | --- | --- |
| `crew-lock-bag.glb` | Crew Lock Bag | Textile EVA cargo bag with integral straps and closure geometry |
| `pistol-grip-tool.glb` | Pistol Grip Tool | Recognizable powered EVA servicing tool |
| `infrared-camera.glb` | Infrared Camera | Scientific inspection instrument |
| `docking-system.glb` | Space Shuttle Parts / Orbiter Docking System | Historical docking/airlock hardware reference |
| `flight-support.glb` | Flight System Support | Servicing carrier and retention hardware reference |

NASA's upstream README states “These assets are free and without copyright” and links its [Images and Media Guidelines](https://www.nasa.gov/nasa-brand-center/images-and-media/). The guidelines permit credited educational and informational computer graphics simulations, subject to identified third-party restrictions and no implied endorsement. The exact source GLBs contain no separate creator/copyright field. This is a source-specific provenance review rather than an SPDX claim for unrelated NASA material. Agency labels that are part of physical historical equipment are depicted as hardware markings, not ORBITAL branding.

Credit: NASA 3D Resources and the collection's upstream contributors. Individual authors for these specific GLBs are not separately identified in their metadata.

**Modifications:** Runtime models were flattened, joined, deduplicated and mesh-simplified at requested ratio 0.75/error0.0005, Draco-compressed and encoded with embedded WebP textures capped at1024 pixels using glTF Transform4.5.1. Actual reduction varies with source topology. Exact original URLs, original/runtime SHA-256 hashes, byte counts, triangle counts and material-primitive counts are recorded in [manifest.json](./manifest.json). Existing self-hosted Draco decoder retains its Apache-2.0 license and notices at `../draco/three-0.186.1-gltf/`.

## Physically based surface maps — CC0

- **[Fabric030](https://ambientcg.com/a/Fabric030)**, ambientCG: gray woven textile color, OpenGL normal, and roughness maps.
- **[Metal038](https://ambientcg.com/a/Metal038)**, ambientCG: lightly scratched galvanized steel color, OpenGL normal, roughness and metalness maps.

Both assets are released under [CC0 1.0 Universal](https://creativecommons.org/publicdomain/zero/1.0/); see [ambientCG's license](https://docs.ambientcg.com/license/). Original1k JPEG archive maps are re-encoded as WebP (quality95 for normals,86 for other maps), without content or color edits. Runtime repetition, tinting and material factors are rendering effects. Source archive URLs/hashes, individual source hashes, dimensions and derivative hashes are in the manifest.

These material maps describe textile and steel finishes, not instrument readings, engineering predictions, or exact historical spacecraft materials.

## Original ORBITAL interior architecture

The new `mission-shell.glb` and `mission-workstations.glb`, when present, are original purpose-built ORBITAL geometry authored for this game. They are not downloaded NASA interiors and do not inherit NASA media terms. Their source authoring scripts are retained with the project. The authentic hardware references above supplement that original architecture.

## Practical asset limits

The reviewed pinned NASA collection does not supply a ready, high-quality spacecraft cockpit or equipment-rack interior with astronaut seats. The existing Habitat Demonstration Unit reference is not an entire usable cabin. No unrelated exterior model is presented as an interior replacement. Purpose-built architecture, functional panels and seats therefore require original modeling.

All runtime downloads are local to this deployment. Models load only when their scene uses them. Architecture PBR normals are omitted in Battery mode (small stowage fittings retain their cloth normal); original untextured material properties remain as a loading/error fallback. No commercial-game assets were used.

## Original sewn liner maps

`quilt-base.webp` recolors the CC0 ambientCG Fabric030 scan to neutral beta-cloth with original ORBITAL diamond stitching; `quilt-normal.webp` is an original height-derived tangent normal field for padded lining. Both 512px maps are artistic material work, not agency measurements. Source hashes and modifications are recorded in manifest.authoredTextures. The original scan remains CC0; these original patterns add no third-party restrictions.
