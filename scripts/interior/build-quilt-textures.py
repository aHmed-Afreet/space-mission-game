"""Original stitched liner maps derived from the bundled CC0 Fabric030 scan.
Requires Pillow and NumPy for authoring only; committed WebP files run in game.
"""
from pathlib import Path
import hashlib
import json
import numpy as np
from PIL import Image

assets = Path('public/assets/interior')
source = np.asarray(Image.open(assets / 'fabric-base.webp').convert('RGB').resize((512, 512)), dtype=float)
y, x = np.mgrid[0:512, 0:512]
u, v = x / 512, y / 512
a, b = (u + v) * 2, (u - v) * 2
seam_distance = np.minimum(np.abs(a - np.round(a)), np.abs(b - np.round(b)))
height = .5 * (1 - np.exp(-(seam_distance / .14) ** 2))
gy, gx = np.gradient(height)
normal = np.stack([-gx * 60, gy * 60, np.ones_like(gx)], axis=2)
normal /= np.linalg.norm(normal, axis=2, keepdims=True)
Image.fromarray(np.uint8(np.clip((normal * .5 + .5) * 255, 0, 255))).save(assets / 'quilt-normal.webp', lossless=True)
grain = (source.mean(axis=2) - source.mean()) * .22
seam = np.exp(-(seam_distance / .012) ** 2) * 23
shade = np.clip(226 + grain - seam, 160, 245)
Image.fromarray(np.uint8(np.stack([shade, shade, shade * .985], axis=2))).save(assets / 'quilt-base.webp', quality=88)
manifest = json.loads((assets / 'manifest.json').read_text())
for item in manifest['authoredTextures']:
    data = (assets / item['file']).read_bytes()
    item['runtimeBytes'] = len(data)
    item['runtimeSha256'] = hashlib.sha256(data).hexdigest()
(assets / 'manifest.json').write_text(json.dumps(manifest, indent=2) + '\n')
