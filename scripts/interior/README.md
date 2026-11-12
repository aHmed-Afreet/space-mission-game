# Rebuilding the original ORBITAL cabin models

`export-models.ts` invokes the exact runtime modeling functions in `pressureShellModel.ts` and `scripts/interior/workstations.ts`, exporting GLB in metric simulator coordinates. The source retains purpose-built panel contours, shaped equipment housings, seats and other modeled fittings. These are original ORBITAL models, not NASA downloads.

From the project root, export the uncompressed models and move them to separate raw inputs before optimizing with glTF Transform **4.5.1**. The exporter writes the runtime filenames, so finish the compression and hash-update steps before building or committing:

```sh
npx tsx scripts/interior/export-models.ts
mv public/assets/interior/mission-shell.glb mission-shell.raw.glb
mv public/assets/interior/mission-workstations.glb mission-workstations.raw.glb
gltf-transform optimize mission-shell.raw.glb public/assets/interior/mission-shell.glb --compress draco --simplify false --instance false --palette false --prune-attributes false --texture-compress false
gltf-transform optimize mission-workstations.raw.glb public/assets/interior/mission-workstations.glb --compress draco --simplify false --instance false --palette false --prune-attributes false --texture-compress false
```

Use a separate input file; do not overwrite the only uncompressed source export before checking the output. Compression flattens, welds, deduplicates and joins static meshes while preserving material names and coordinate units. Mesh simplification and palette merging are disabled. Material names beginning `paint`, `fabric`, `rubber`, `metal`, `light`, and `glass` form part of the runtime PBR contract.

Regenerate the authored-model byte/hash entries in `public/assets/interior/manifest.json` after rebuilding. `src/interiorAssets.test.ts` verifies the recorded bytes, hashes, names and budgets. All runtime GLBs use the project's existing local Draco decoder; no remote codec download is required.

NASA hardware derivatives and CC0 material sources retain their separate provenance in `public/assets/interior/ATTRIBUTION.md` and the manifest. Their original source files can be downloaded from the exact pinned URLs in that manifest. The NASA hardware used ratio0.75/error0.0005 simplification plus Draco and embedded WebP1k optimization; the Quality cabin architecture is not simplified; reduced geometry tiers are described below.

**Runtime PBR maps require UVs even though the geometry GLBs have no embedded textures.** Keep `--prune-attributes false`; default optimize removes those UVs as unused, making every later runtime texture sample the same texel. Asset regression tests enforce retained TEXCOORD_0.

The committed sewn liner maps can be reproduced with `python3 scripts/interior/build-quilt-textures.py` (Pillow and NumPy are authoring dependencies only). It derives stitch relief from an original height field and neutralizes the bundled CC0 woven-cloth albedo. Ordinary game builds use the committed maps and GLBs and require none of these authoring tools.

Battery and Balanced use `*-balanced.glb`: generate these from the same raw exports with `--simplify true --simplify-ratio .6 --simplify-error .0001 --simplify-lock-border true` and the same other flags. Quality uses the unsimplified models. Locking borders protects pressure openings, seams and instrument boundaries; the tight error limit intentionally takes precedence over the requested triangle ratio. Update manifest.balancedVariant hashes after regeneration.

Remove the temporary `*.raw.glb` inputs after checking both compressed tiers; they are authoring intermediates and should not be committed.
