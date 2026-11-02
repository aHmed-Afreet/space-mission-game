/** Asset-level provenance; repository software licenses do not automatically
 * license imagery or agency marks. Original procedural assets need no download. */
export type PlanetMapQuality = "battery" | "balanced" | "quality";
const background = {
  id: "nasa-iss049e004248-backdrop",
  runtimeUrl: "./assets/backgrounds/iss049e004248-1920-357943e89d20.jpg",
  canonicalSource: "https://images.nasa.gov/details/iss049e004248",
  sourceUrl: "https://images-assets.nasa.gov/image/iss049e004248/iss049e004248~large.jpg",
  metadataSource: "https://images-assets.nasa.gov/image/iss049e004248/metadata.json",
  creator: "NASA/JSC / Kate Rubins; Expedition 49, 2016-09-17",
  attribution: "Background photograph: NASA/JSC / Kate Rubins, iss049e004248 (Solar array). No NASA endorsement implied.",
  policy: "https://www.nasa.gov/nasa-brand-center/images-and-media/",
  terms: "NASA media guidelines permit credited educational/informational use, including graphical simulations and web pages, subject to identified third-party restrictions and no endorsement. JSC item metadata identifies Kate Rubins as photographer/creator; no photo-specific third-party restriction was found. The embedded HP sRGB profile copyright concerns the color profile, not photo authorship. This is an item-specific provenance review, not a blanket NASA or SPDX license claim.",
  sha256: "357943e89d200bca5ff9f95983e1e94f58a49fa58fa7493c698f48ee02a60e4a",
  bytes: 259633, dimensions: [1920, 1277],
  version: "NASA Image and Video Library large derivative, retrieved 2026-11-02",
  modifications: "None to JPEG bytes. Existing CSS cover crops, overlays and home saturation/contrast remain presentation effects.",
  use: "Decorative shared interface backdrop showing an ISS solar array and Earth; not the player's location, a historical reconstruction or live imagery.",
  fallback: "Existing dark interface background; mission functionality is independent of the photograph.",
  reviewed: "2026-11-02 exact item metadata, creator/date, media guidelines, JPEG dimensions and hash",
} as const;
export const backgroundAssetFiles = [background.runtimeUrl, "./assets/backgrounds/ATTRIBUTION.txt"] as const;
const earthMaps = {
  standard: {
    runtimeUrl: "./assets/planetary/earth-bluemarble-svs2915-1024-d1d3cb36ae6a.png",
    sourceUrl: "https://svs.gsfc.nasa.gov/vis/a000000/a002900/a002915/bluemarble-1024.png",
    version: "SVS 2915, published 2004; 1024-pixel original",
    sha256: "d1d3cb36ae6ae452c43cdf7ae0ffc13a959e8a5a2358f58b05e5f623c15119f9",
    bytes: 444710, dimensions: [1024, 512],
  },
  quality: {
    runtimeUrl: "./assets/planetary/earth-bluemarble-svs2915-2048-ae6214b078ed.png",
    sourceUrl: "https://svs.gsfc.nasa.gov/vis/a000000/a002900/a002915/bluemarble-2048.png",
    version: "SVS 2915, published 2004; 2048-pixel original",
    sha256: "ae6214b078ed0864c96f74bcb10ae3021f6eb116f8059797efe0fa9ea8b89d35",
    bytes: 1511379, dimensions: [2048, 1024],
  },
} as const;
const moonMaps = {
  standard: {
    runtimeUrl: "./assets/planetary/moon-lroc-svs4720-2019-1024-b246064f217f.jpg",
    sourceUrl: "https://svs.gsfc.nasa.gov/vis/a000000/a004700/a004720/lroc_color_poles_1k.jpg",
    version: "SVS 4720, original 2019 color map; 1024 pixels",
    sha256: "b246064f217f8d479df78c49c7c8595a8f5fbda008a72fd539978d2e121e0109",
    bytes: 139068, dimensions: [1024, 512],
  },
  quality: {
    runtimeUrl: "./assets/planetary/moon-lroc-svs4720-2025-2048-f7130a182268.jpg",
    sourceUrl: "https://svs.gsfc.nasa.gov/vis/a000000/a004700/a004720/lroc_color_2k.jpg",
    version: "SVS 4720, December 2025 revised color map; 2048 pixels",
    sha256: "f7130a1822681fa7512d7dcfd40db8c10b9ba4f06777910348698260ed7a2170",
    bytes: 457942, dimensions: [2048, 1024],
  },
} as const;

/** Public-directory assets are not Rollup bundle entries. Include every tier
 * and its credit file explicitly so photographic visuals remain available offline. */
export const planetaryAssetFiles = [
  earthMaps.standard.runtimeUrl, earthMaps.quality.runtimeUrl,
  moonMaps.standard.runtimeUrl, moonMaps.quality.runtimeUrl,
  "./assets/planetary/ATTRIBUTION.txt",
] as const;

const hubbleRuntimeUrl = "./assets/models/hubble-11ebb4ee-e5ba4de15c7d.glb";
/** Version identifies the installed distribution, not an inferred Draco release.
 * All three decoder hashes also match the independently fetched upstream commit. */
export const dracoDecoder = {
  runtimePath: "./assets/draco/three-0.186.1-gltf/",
  version: "three 0.186.1, examples/jsm/libs/draco/gltf",
  packageSource: "https://registry.npmjs.org/three/-/three-0.186.1.tgz",
  source: "https://github.com/mrdoob/three.js/tree/9b4a2ac29c63ccb43fd51c5661f2f873ac2c39b8/examples/jsm/libs/draco/gltf",
  upstreamCommit: "9b4a2ac29c63ccb43fd51c5661f2f873ac2c39b8",
  license: "Apache-2.0 (Draco); complete upstream LICENSE also retains third-party notices",
  licenseSource: "https://github.com/google/draco/blob/2225d05ba6ce1a8d161d0b85146fa784bf3d78e9/LICENSE",
  copyright: "Copyright 2016 The Draco Authors; AUTHORS: Google Inc. and other contributors",
  files: {
    "draco_wasm_wrapper.js": { bytes: 58456, sha256: "8bb2952d2ba7d67e1414f8df819410cb0434a666be53f671fff75f68843d76f6" },
    "draco_decoder.wasm": { bytes: 192420, sha256: "a680d927bed9cb864ddbd63521868891af2bfbe755092761b4837487618df8ac" },
    "draco_decoder.js": { bytes: 512465, sha256: "8625489da79a805f4f2a7d511c3e52d8b4085608a9d2a4d5f4f9de5db0aea04f" },
  },
  modifications: "None to decoder bytes; local paths, one worker, and owned cancellation in the loader adapter.",
} as const;

/** Pure public-asset list: importing this into Vite must not import three or a
 * runtime loader. Precache both WASM and the installed loader's JS fallback. */
export const referenceAssetFiles = [
  hubbleRuntimeUrl, "./assets/models/ATTRIBUTION.txt",
  ...Object.keys(dracoDecoder.files).map(name => dracoDecoder.runtimePath + name),
  ...["README.upstream.md", "LICENSE", "AUTHORS", "decode.h.copyright-source", "NOTICE.txt"]
    .map(name => dracoDecoder.runtimePath + name),
] as const;

export const assetManifest = {
  background,
  hubble: {
    id: "hubble-reference-a",
    canonicalSource: "https://github.com/nasa/NASA-3D-Resources/tree/11ebb4ee043715aefbba6aeec8a61746fad67fa7/3D%20Models/Hubble%20Space%20Telescope%20(A)",
    runtimeUrl: hubbleRuntimeUrl,
    sourceUrl: "https://raw.githubusercontent.com/nasa/NASA-3D-Resources/11ebb4ee043715aefbba6aeec8a61746fad67fa7/3D%20Models/Hubble%20Space%20Telescope%20(A)/Hubble%20Space%20Telescope%20(A).glb",
    creator: "DigitalSpace / NASA (upstream credit)",
    attribution: "Hubble reference model: DigitalSpace / NASA. No NASA endorsement implied.",
    terms: "Upstream README states assets are free and without copyright and links NASA media usage guidelines. NASA policy permits educational computer graphics simulations with credit, subject to marked third-party restrictions. No asset-embedded copyright field was found; this is a provenance review, not an SPDX license assignment.",
    policy: "https://www.nasa.gov/nasa-brand-center/images-and-media/",
    version: "11ebb4ee043715aefbba6aeec8a61746fad67fa7",
    sha256: "e5ba4de15c7d359ac8fa1ab7e286aff42dec09c0fadae3db99252587f39fa384",
    bytes: 1694988,
    modifications: "Original GLB self-hosted without byte changes. Runtime maximum-axis extent normalized to 3.1 world units, centred, and translated by y=1.35,z=1.4 relative to worksite (2.4,0,15), behind original procedural service hardware. No physical Hubble dimensions or source orientation correction claimed.",
    use: "Optional visual reference for Mission 8 telescope servicing; not a claim that the fictional training vehicle is Hubble.",
    fallback: "Original procedural telescope with live service indication",
    format: "glTF 2.0; required KHR_draco_mesh_compression; optional EXT_texture_webp with embedded PNG fallbacks; 7,672 triangles before node instances and five materials",
    reviewed: "2026-10-29 policy; 2026-11-01 exact original format/hash and local decoder distribution",
  },
  earth: {
    ...earthMaps.standard,
    id: "nasa-svs-2915-earth-composite",
    canonicalSource: "https://svs.gsfc.nasa.gov/2915/",
    creator: "NASA/Goddard Space Flight Center Scientific Visualization Studio; Reto Stockli (NASA/GSFC) and NASA Earth Observatory; visualization by Eric Sokolowsky",
    attribution: "Earth mosaic: NASA/Goddard Space Flight Center Scientific Visualization Studio; Reto Stockli (NASA/GSFC) and NASA Earth Observatory. No NASA endorsement implied.",
    terms: "NASA SVS explicitly releases its content to the public domain unless otherwise noted; no contrary exception was found on item 2915. NASA media usage and agency-mark restrictions still apply. This review does not license unrelated NASA or third-party assets.",
    policy: "https://svs.gsfc.nasa.gov/help/",
    modifications: "None to image bytes. Original downloads are self-hosted with version/hash filenames; runtime sRGB material mapping only.",
    use: "Static geographic photographic composite with baked topographic shading; not pure quantitative albedo, live weather, a date-specific historic view, or experiment ground truth.",
    fallback: "Original deterministic synthetic Earth albedo and cloud maps",
    variants: earthMaps,
    reviewed: "2026-11-01: exact SVS originals, item credits, public-domain release and dimensions/hashes reviewed",
  },
  moon: {
    ...moonMaps.standard,
    id: "nasa-svs-4720-moon-color",
    canonicalSource: "https://svs.gsfc.nasa.gov/4720/",
    creator: "NASA Scientific Visualization Studio; Ernie Wright (USRA); LROC/LOLA instrument teams",
    attribution: "Moon color visualization: NASA Scientific Visualization Studio / Ernie Wright. LROC source data: NASA/GSFC/Arizona State University. No NASA endorsement implied.",
    terms: "NASA SVS explicitly releases its content to the public domain unless otherwise noted; no contrary exception was found on item 4720. Its linked LROC PDS source data is public domain, distinct from separately copyrighted curated LROC website images.",
    policy: "https://svs.gsfc.nasa.gov/help/",
    sourceDataPolicy: "https://www.lroc.im-ldi.com/about/terms",
    modifications: "None to image bytes. Original downloads are self-hosted with version/hash filenames; runtime sRGB material mapping only.",
    use: "Normalized, vision-adjusted global color visualization with polar fill; optimized for aesthetics rather than quantitative science. Standard uses 2019 and Quality uses the revised 2025 map, not identical pixels at different resolutions. Does not geolocate terrain or supply experiment values.",
    fallback: "Original deterministic synthetic lunar albedo map",
    variants: moonMaps,
    reviewed: "2026-11-01: exact SVS originals, item credits, PDS provenance, public-domain release and dimensions/hashes reviewed",
  },
} as const;

/** One selection policy for callers: Story/default and Battery/Balanced stay at
 * 1024 pixels; Commander Quality explicitly requests the 2048-pixel originals. */
export function selectPlanetMap(body: "earth" | "moon", quality: PlanetMapQuality = "balanced") {
  return assetManifest[body].variants[quality === "quality" ? "quality" : "standard"];
}

/** Historical evidence only. No active loader reads these unresolved images;
 * retain the prior bytes/version record without inferring image rights from MIT. */
export const inheritedPlanetaryImages = {
  earth: {
    sourceUrl: "https://raw.githubusercontent.com/mrdoob/three.js/9b4a2ac29c63ccb43fd51c5661f2f873ac2c39b8/examples/textures/planets/earth_atmos_2048.jpg",
    version: "9b4a2ac29c63ccb43fd51c5661f2f873ac2c39b8",
    sha256: "2faa400d1eade3bc44caf6750d1b772bd9bbb6d87362c02bc7c3304e78fa0a9d", bytes: 512606,
    rights: "Original creator and image-specific rights unresolved; no longer requested at runtime.",
  },
  moon: {
    sourceUrl: "https://raw.githubusercontent.com/mrdoob/three.js/9b4a2ac29c63ccb43fd51c5661f2f873ac2c39b8/examples/textures/planets/moon_1024.jpg",
    version: "9b4a2ac29c63ccb43fd51c5661f2f873ac2c39b8",
    sha256: "fcb0f1f5548e6e18d40063dd55c6aacd3daedf2407b181dab85b61e22bf9fe57", bytes: 238093,
    rights: "Original creator and image-specific rights unresolved; no longer requested at runtime.",
  },
} as const;
