# Planetary visualization assets

The game packages four unchanged original NASA Scientific Visualization Studio (SVS) images. [The executable manifest](../src/presentation/assetManifest.ts) records their sources, creators, versions, sizes, hashes, usage evidence and fallback. [Distributed credits](../public/assets/planetary/ATTRIBUTION.txt) are also cached for offline access. No NASA endorsement is implied.

## Sources and usage

The [SVS usage statement](https://svs.gsfc.nasa.gov/help/) releases its content to the public domain unless an item says otherwise. The reviewed [Earth item 2915](https://svs.gsfc.nasa.gov/2915/) and [Moon item 4720](https://svs.gsfc.nasa.gov/4720/) publish these map downloads and credits without a contrary exception. [NASA media guidelines](https://www.nasa.gov/nasa-brand-center/images-and-media/) and agency-mark restrictions remain applicable; this is an asset-specific review, not a license for every NASA-hosted third-party work.

- Earth: NASA/Goddard Space Flight Center Scientific Visualization Studio; Reto Stockli (NASA/GSFC) and NASA Earth Observatory. Visualization by Eric Sokolowsky.
- Moon: NASA Scientific Visualization Studio / Ernie Wright (USRA). LROC source data: NASA/GSFC/Arizona State University. The SVS item links the normalized WAC mosaic's PDS record; the [LROC terms](https://www.lroc.im-ldi.com/about/terms) distinguish public-domain PDS products from separately copyrighted curated website imagery.

Review date: November 1, 2026. The original downloads have not been resized, cropped, re-encoded or otherwise edited. Their filenames include content-hash prefixes; full hashes remain below. Self-hosting avoids mutable remote image dependencies and observed upstream CORS restrictions. It does not change image ownership or scientific meaning.

| File | Raster | Encoded bytes | SHA-256 |
|---|---:|---:|---|
| earth-bluemarble-svs2915-1024-d1d3cb36ae6a.png | 1024×512 | 444,710 | `d1d3cb36ae6ae452c43cdf7ae0ffc13a959e8a5a2358f58b05e5f623c15119f9` |
| earth-bluemarble-svs2915-2048-ae6214b078ed.png | 2048×1024 | 1,511,379 | `ae6214b078ed0864c96f74bcb10ae3021f6eb116f8059797efe0fa9ea8b89d35` |
| moon-lroc-svs4720-2019-1024-b246064f217f.jpg | 1024×512 | 139,068 | `b246064f217f8d479df78c49c7c8595a8f5fbda008a72fd539978d2e121e0109` |
| moon-lroc-svs4720-2025-2048-f7130a182268.jpg | 2048×1024 | 457,942 | `f7130a1822681fa7512d7dcfd40db8c10b9ba4f06777910348698260ed7a2170` |

## Quality and offline behavior

Battery, Balanced and default Story select 1024×512 images. Commander Quality selects 2048×1024 images, including the orbital Earth, cabin destination and lunar horizon. The 2019 standard Moon map and revised December 2025 Quality map differ in color processing and polar detail; they are explicitly versioned rather than described as one image at two resolutions.

Default image storage is approximately 2 MiB per map in conservative RGBA8 format before mipmaps, versus 8 MiB for a 2048×1024 map. This reduces the default Earth texture's pixel budget relative to the inherited 2k image; it is not a measured whole-scene GPU-memory or frame-rate result. The service worker precaches all four files (2,553,099 encoded bytes, plus credits) so either tier remains available offline. Cached bytes are not automatically decoded into GPU textures.

The existing generated map appears first and remains if loading fails. Accepted images retain the existing paused redraw notification and late-download disposal guards. Runtime URLs are relative to the deployment base. Photo availability is independent of mission objectives, saves and engineering calculations.

## Scientific limits

Earth is a cloud-free global geographic composite with baked USGS GTOPO30 topographic shading, suitable beneath the separate generated cloud layer. It is not pure quantitative albedo, a real-time weather observation or an exact historic-date reconstruction. Its source page contains a 2001 compositing description and a 2004 dataset entry; the game does not assign a more precise observation epoch to these bytes.

Moon is a global, photometrically normalized, human-vision-adjusted color visualization, with polar albedo fill. NASA describes these maps as optimized for aesthetics rather than scientific measurement. Both are centered on 0° longitude without a baked spherical phase terminator. They neither geolocate the fictional walking terrain nor feed numeric experiment results. The 2025 JPEG's retained EXIF describes its larger source; actual PNG IHDR/JPEG SOF raster dimensions are tested instead.

## Preserved inherited provenance

The former three.js Earth and Moon JPEGs remain identified in `inheritedPlanetaryImages` in the manifest, including their verified commit, hashes and sizes. Their original creators and image-specific rights remain unresolved, and the software MIT license is not assigned to them. Active loaders no longer request them. Their source history and prior audit artifacts are preserved; this change replaces their photographic role with reviewed images while retaining the procedural fallback and every mission, objective and save.

## Validation scope

Regression tests verify exact packaged bytes, real raster dimensions, relative paths, tier selection through actual texture-loader calls, cabin/field forwarding, fallback/disposal behavior and the generated service worker's map/credit file list. Browser image decoding, before/after rendering, actual offline cache fetches and physical-device performance require separate native acceptance; compilation or geometry tests do not certify them.
