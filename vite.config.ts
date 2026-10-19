import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
function offline(): Plugin {
  return {
    name: "orbital-offline",
    generateBundle(_options, bundle) {
      const files = [
        "./",
        "./index.html",
        "./manifest.webmanifest",
        "./icons/icon-192.png",
        "./icons/icon-512.png",
        "./icons/apple-touch-icon.png",
        ...Object.keys(bundle).map((p) => "./" + p),
      ];
      this.emitFile({
        type: "asset",
        fileName: "sw.js",
        source: `const PREFIX='orbital:'+self.registration.scope;const CACHE=PREFIX+':${Date.now()}';const FILES=${JSON.stringify(files)};self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(FILES))));self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith(PREFIX)&&k!==CACHE).slice(0,-1).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));self.addEventListener('fetch',event=>{if(event.request.method!=='GET'||new URL(event.request.url).origin!==self.location.origin)return;if(event.request.mode==='navigate'){event.respondWith(fetch(event.request).catch(()=>caches.match(new URL('./index.html',self.registration.scope))));return;}event.respondWith(caches.match(event.request).then(cached=>cached||fetch(event.request)));});`,
      });
    },
  };
}
export default defineConfig({
  plugins: [react(), offline()],
  base: "./",
  build: { rollupOptions: { output: { manualChunks: { three: ["three"] } } } },
});
