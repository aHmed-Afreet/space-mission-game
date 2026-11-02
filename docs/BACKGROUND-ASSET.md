# Shared interface photograph

The shared photographic backdrop now uses NASA/JSC **iss049e004248**, “Solar
array”, photographed by Kate Rubins during Expedition 49 on 17 September 2016.
It replaces the inherited external Unsplash CDN URL. The original backdrop and
source remain in the preserved baseline; no inference about its license was made
when the exact Unsplash photo and license pages returned HTTP401 during review.

The local 1920×1277, 259,633-byte file is the unchanged NASA-provided large JPEG.
Its SHA-256, source, creator, item metadata and permission scope are recorded in
`src/presentation/assetManifest.ts` and the offline-readable
`public/assets/backgrounds/ATTRIBUTION.txt`. The home footer links that credit.
The service worker includes both files. Existing cover crops, overlays and home
color adjustments remain; no image bytes were edited.

NASA's media guidelines permit credited educational/informational use including
web pages and graphical simulations, subject to identified third-party rights
and no implied endorsement. The item identifies JSC and Kate Rubins as
photographer/creator; no photo-specific third-party restriction was found.
The metadata's HP1998 copyright is explicitly the embedded sRGB color profile,
not the photograph. This is an item-specific provenance review, not a blanket
NASA public-domain/SPDX license claim. Source metadata and policy responses were
retained externally on 2 November 2026.

The image is decorative interface context, not the player's current position,
live imagery or the reconstructed date of a historical mission. The dark
interface remains usable if the image is unavailable. Commander reports also
have an opaque reading surface so text contrast does not depend on photography.
Asset-byte/offline and rendered contrast checks are separate from mission play.
