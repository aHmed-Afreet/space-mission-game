import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { backgroundAssetFiles, planetaryAssetFiles, referenceAssetFiles } from "./src/presentation/assetManifest";
export function offline(): Plugin {
  return {
    name: "orbital-offline",
    generateBundle(_options, bundle) {
      const files = [
        "./",
        "./index.html",
        "./privacy.html",
        "./manifest.webmanifest",
        "./icons/icon-192.png",
        "./icons/icon-512.png",
        "./icons/apple-touch-icon.png",
        ...backgroundAssetFiles,
        ...planetaryAssetFiles,
        ...referenceAssetFiles,
        ...Object.keys(bundle).map((p) => "./" + p),
      ];
      this.emitFile({
        type: "asset",
        fileName: "sw.js",
        source: `const PREFIX='orbital:'+self.registration.scope;const CACHE=PREFIX+':${Date.now()}';const FILES=${JSON.stringify(files)};const STATIC=new Set(FILES.map(p=>new URL(p,self.registration.scope).href));const cached=request=>caches.match(request,{ignoreVary:STATIC.has(request.url||request.href)});self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(FILES))));self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith(PREFIX)&&k!==CACHE).slice(0,-1).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));self.addEventListener('fetch',event=>{if(event.request.method!=='GET'||new URL(event.request.url).origin!==self.location.origin)return;if(event.request.mode==='navigate'){event.respondWith(fetch(event.request).catch(async()=>await cached(event.request)||await cached(new URL('./index.html',self.registration.scope))));return;}const assetRoot=new URL('./assets/realism/',self.registration.scope);const optional=new URL(event.request.url).pathname.startsWith(assetRoot.pathname);if(optional){event.respondWith(caches.open(CACHE).then(async cache=>{const hit=await cache.match(event.request);if(hit)return hit;const response=await fetch(event.request);if(response.ok){try{await cache.put(event.request,response.clone());}catch{/* Storage pressure must never block gameplay. */}}return response;}));return;}event.respondWith(cached(event.request).then(cached=>cached||fetch(event.request)));});`,
      });
    },
  };
}
export default defineConfig({
  plugins: [react(), offline()],
  base: "./",
  build: { rollupOptions: { output: { manualChunks: { three: ["three"] } } } },
});
