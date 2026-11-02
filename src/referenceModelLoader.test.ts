import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import * as T from "three";
import { GLTFLoader, type GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";
import { assetManifest, dracoDecoder, referenceAssetFiles } from "./presentation/assetManifest";
import { createReferenceModelLoader, loadReferenceModel } from "./presentation/referenceModelLoader";
import { disposeObjectResources } from "./presentation/resources";
import { offline } from "../vite.config";

const originalHash = "e5ba4de15c7d359ac8fa1ab7e286aff42dec09c0fadae3db99252587f39fa384";
const original = () => readFileSync(resolve("public", assetManifest.hubble.runtimeUrl));
const arrayBuffer = (bytes: Buffer) => new Uint8Array(bytes).buffer;
const sha256 = (bytes: Buffer) => createHash("sha256").update(bytes).digest("hex");

test("the exact reviewed Hubble GLB retains its required Draco extension and embedded image fallbacks", () => {
  const bytes = original();
  assert.equal(bytes.length, 1694988); assert.equal(sha256(bytes), originalHash);
  assert.equal(assetManifest.hubble.sha256, originalHash);
  assert.equal(bytes.subarray(0, 4).toString(), "glTF");
  assert.equal(bytes.readUInt32LE(4), 2); assert.equal(bytes.readUInt32LE(8), bytes.length);
  assert.equal(bytes.subarray(16, 20).toString(), "JSON");
  const json = JSON.parse(bytes.subarray(20, 20 + bytes.readUInt32LE(12)).toString()) as {
    asset: { version: string }; extensionsRequired: string[]; extensionsUsed: string[];
    images: { uri?: string; bufferView: number; mimeType: string }[];
    meshes: { primitives: { indices: number; extensions: Record<string, unknown> }[] }[];
    accessors: { count: number }[]; materials: unknown[];
  };
  assert.equal(json.asset.version, "2.0");
  assert.deepEqual(json.extensionsRequired, ["KHR_draco_mesh_compression"]);
  assert.ok(json.extensionsUsed.includes("EXT_texture_webp"));
  assert.equal(json.materials.length, 5);
  assert.equal(json.meshes.flatMap(mesh => mesh.primitives).reduce((sum, primitive) => {
    assert.ok(primitive.extensions.KHR_draco_mesh_compression);
    return sum + json.accessors[primitive.indices].count / 3;
  }, 0), 7672);
  assert.ok(json.images.every(image => image.uri === undefined && Number.isInteger(image.bufferView)));
  assert.equal(json.images.filter(image => image.mimeType === "image/png").length, 5);
  assert.equal(json.images.filter(image => image.mimeType === "image/webp").length, 5);
  assert.match(assetManifest.hubble.sourceUrl, new RegExp(assetManifest.hubble.version));
});

test("the actual original GLB rejects the old bare GLTFLoader configuration", () => {
  assert.throws(() => new GLTFLoader().parse(arrayBuffer(original()), "", () => {
    assert.fail("A Draco-required GLB cannot succeed without a configured decoder");
  }, error => { throw error; }), /No DRACOLoader instance provided/);
});

test("local Draco files retain the installed r186 distribution bytes and complete license evidence", () => {
  const installed = JSON.parse(readFileSync("node_modules/three/package.json", "utf8"));
  assert.equal(installed.version, "0.186.1");
  const expected = [
    ["draco_wasm_wrapper.js", 58456, "8bb2952d2ba7d67e1414f8df819410cb0434a666be53f671fff75f68843d76f6"],
    ["draco_decoder.wasm", 192420, "a680d927bed9cb864ddbd63521868891af2bfbe755092761b4837487618df8ac"],
    ["draco_decoder.js", 512465, "8625489da79a805f4f2a7d511c3e52d8b4085608a9d2a4d5f4f9de5db0aea04f"],
  ] as const;
  for (const [name, bytes, hash] of expected) {
    const local = readFileSync(resolve("public", dracoDecoder.runtimePath, name));
    assert.equal(local.length, bytes); assert.equal(sha256(local), hash);
    assert.deepEqual(local, readFileSync(resolve("node_modules/three/examples/jsm/libs/draco/gltf", name)));
    assert.deepEqual(dracoDecoder.files[name], { bytes, sha256: hash });
  }
  for (const [name, hash] of [
    ["LICENSE", "d3709b0fb4b8a94bbb1d02b8a2e484f258b0d9c5c5a01f940391f3fe662cd1a4"],
    ["AUTHORS", "7399754545fa82fbf402e3e91d50de0b63772870fd807c48dd9af25c042efb10"],
    ["decode.h.copyright-source", "ea23e1dfabf34d11260f51f4f4e160f89480b2ac53d919e354a12266a05c00c1"],
    ["README.upstream.md", "839850a67c93f6b26d3cc038a45bd8289e3cfdf15531e69339e8eb1282b4eb76"],
  ]) assert.equal(sha256(readFileSync(resolve("public", dracoDecoder.runtimePath, name))), hash);
  assert.match(dracoDecoder.license, /Apache-2.0/);
});

type RuntimeDecoder = DRACOLoader & {
  decoderPaths: { js: string; wasm: string; dep_js: string };
  workerLimit: number; workerSourceURL: string; workerPool: Worker[];
  _loadLibrary(url: string, responseType: string): Promise<unknown>;
  _initDecoder(): Promise<void>;
  _getWorker(taskId: number, cost: number): Promise<Worker>;
  decodeGeometry(buffer: ArrayBuffer, taskConfig: object): Promise<T.BufferGeometry>;
};
const runtimeDecoder = (request: ReturnType<typeof createReferenceModelLoader>) => request.loader.dracoLoader as RuntimeDecoder;

test("the real GLTFLoader receives the local glTF Draco decoder and a one-worker limit", () => {
  const request = createReferenceModelLoader(), decoder = runtimeDecoder(request);
  try {
    assert.ok(request.loader instanceof GLTFLoader); assert.ok(decoder instanceof DRACOLoader);
    assert.equal(decoder.workerLimit, 1);
    assert.deepEqual(decoder.decoderPaths, {
      js: dracoDecoder.runtimePath + "draco_wasm_wrapper.js",
      wasm: dracoDecoder.runtimePath + "draco_decoder.wasm",
      dep_js: dracoDecoder.runtimePath + "draco_decoder.js",
    });
    for (const path of [assetManifest.hubble.runtimeUrl, ...Object.values(decoder.decoderPaths)])
      assert.equal(new URL(path, "https://example.test/game/").pathname, "/game/" + path.slice(2));
  } finally { request.dispose(); }
});

test("success, errors and disposal release the owned decoder; late models release their own resources", () => {
  const load = GLTFLoader.prototype.load, dispose = DRACOLoader.prototype.dispose;
  let complete: Parameters<GLTFLoader["load"]>[1], fail: Parameters<GLTFLoader["load"]>[3];
  let decoderReleases = 0;
  GLTFLoader.prototype.load = function(url, onLoad, _progress, onError) {
    assert.equal(url, assetManifest.hubble.runtimeUrl); assert.ok(this.dracoLoader instanceof DRACOLoader);
    complete = onLoad; fail = onError;
  };
  DRACOLoader.prototype.dispose = function() { decoderReleases++; return dispose.call(this); };
  try {
    for (const outcome of ["success", "error", "disposed"] as const) {
      decoderReleases = 0;
      let accepted = 0, released = 0;
      const model = new T.Group(), geometry = new T.BoxGeometry();
      model.add(new T.Mesh(geometry, new T.MeshBasicMaterial()));
      geometry.addEventListener("dispose", () => released++);
      const handle = loadReferenceModel(scene => { assert.equal(scene, model); accepted++; });
      if (outcome === "disposed") handle.dispose();
      if (outcome === "error") fail!(Error("Declared load failure"));
      complete!({ scene: model } as GLTF);
      assert.equal(accepted, outcome === "success" ? 1 : 0);
      assert.equal(released, outcome === "success" ? 0 : 1);
      handle.dispose(); handle.dispose(); assert.equal(decoderReleases, 1);
      if (outcome === "success") disposeObjectResources(model);
      assert.equal(released, 1);
    }
    GLTFLoader.prototype.load = function() { throw Error("Declared synchronous load failure"); };
    decoderReleases = 0; loadReferenceModel(() => assert.fail("failed load"));
    assert.equal(decoderReleases, 1);
  } finally { GLTFLoader.prototype.load = load; DRACOLoader.prototype.dispose = dispose; }
});

test("disposal during real decoder initialization revokes the late blob and refuses queued workers", async () => {
  const request = createReferenceModelLoader(), decoder = runtimeDecoder(request);
  const create = URL.createObjectURL, revoke = URL.revokeObjectURL;
  const completeLibraries: (() => void)[] = [], revoked: string[] = [];
  let created = 0;
  decoder._loadLibrary = (_url, type) => new Promise(resolve => completeLibraries.push(() =>
    resolve(type === "text" ? "/* declared decoder fixture */" : new ArrayBuffer(0))));
  URL.createObjectURL = () => `blob:decoder-test-${++created}`;
  URL.revokeObjectURL = url => { revoked.push(url); };
  try {
    decoder.preload();
    const initialization = assert.rejects(decoder._initDecoder(), { name: "AbortError" });
    request.dispose(); completeLibraries.forEach(complete => complete());
    await initialization;
    assert.equal(created, 1); assert.deepEqual(revoked, ["blob:decoder-test-1"]);
    assert.equal(decoder.workerSourceURL, ""); assert.equal(decoder.workerPool.length, 0);
    await assert.rejects(decoder._getWorker(1, 1), { name: "AbortError" });
    request.dispose(); assert.equal(revoked.length, 1);
  } finally { request.dispose(); URL.createObjectURL = create; URL.revokeObjectURL = revoke; }
});

test("the actual installed decoder selects the local JavaScript fallback when WebAssembly is absent", async () => {
  const previous = globalThis.WebAssembly;
  const request = createReferenceModelLoader(), decoder = runtimeDecoder(request), requests: string[] = [];
  decoder._loadLibrary = async (url, type) => { requests.push(url); assert.equal(type, "text"); return "/* declared JS decoder fixture */"; };
  Object.defineProperty(globalThis, "WebAssembly", { value: undefined, configurable: true, writable: true });
  try {
    await decoder._initDecoder();
    assert.deepEqual(requests, [dracoDecoder.runtimePath + "draco_decoder.js"]);
    assert.ok(decoder.workerSourceURL.startsWith("blob:"));
  } finally {
    request.dispose();
    Object.defineProperty(globalThis, "WebAssembly", { value: previous, configurable: true, writable: true });
  }
});

test("disposal rejects an active decode, terminates its worker and guards a previously queued worker post", async () => {
  const previousWorker = globalThis.Worker;
  const workers: { terminated: number; messages: unknown[] }[] = [];
  class FixtureWorker {
    terminated = 0; messages: unknown[] = [];
    constructor() { workers.push(this); }
    postMessage(message: unknown) { this.messages.push(message); }
    terminate() { this.terminated++; }
  }
  globalThis.Worker = FixtureWorker as unknown as typeof Worker;
  const request = createReferenceModelLoader(), decoder = runtimeDecoder(request);
  decoder._loadLibrary = async (_url, type) => type === "text" ? "/* declared decoder fixture */" : new ArrayBuffer(0);
  try {
    const result = assert.rejects(decoder.decodeGeometry(new ArrayBuffer(4), {}), { name: "AbortError" });
    for (let i = 0; !workers[0]?.messages.some(message => (message as { type: string }).type === "decode") && i < 20; i++)
      await new Promise<void>(resolve => setImmediate(resolve));
    assert.ok(workers[0]?.messages.some(message => (message as { type: string }).type === "decode"));
    const queuedWorker = await decoder._getWorker(2, 1);
    assert.equal(workers.length, 1, "One decoder worker serves all geometry requests");
    request.dispose(); await result;
    assert.equal(workers[0].terminated, 1); assert.equal(decoder.workerPool.length, 0);
    assert.throws(() => queuedWorker.postMessage({ type: "decode" }), { name: "AbortError" });
    request.dispose(); assert.equal(workers[0].terminated, 1);
  } finally {
    request.dispose();
    if (previousWorker === undefined) delete (globalThis as { Worker?: typeof Worker }).Worker;
    else globalThis.Worker = previousWorker;
  }
});

test("the generated offline worker retains model, decoders, notices, privacy and lazy app entries", async () => {
  const emitted: { source?: string | Uint8Array }[] = [], hook = offline().generateBundle;
  if (typeof hook !== "function") throw Error("Expected callable offline generation hook");
  await hook.call({ emitFile(asset: typeof emitted[number]) { emitted.push(asset); return "sw.js"; } } as never,
    {} as never, { "assets/Commander.js": {}, "assets/HistoryHub.js": {} } as never, false);
  const source = String(emitted[0].source), start = source.indexOf("const FILES=") + "const FILES=".length;
  const files = JSON.parse(source.slice(start, source.indexOf(";const STATIC", start))) as string[];
  for (const path of [...referenceAssetFiles, "./privacy.html", "./assets/Commander.js", "./assets/HistoryHub.js"])
    assert.ok(files.includes(path), `Actual generated worker includes ${path}`);
  for (const path of referenceAssetFiles) assert.ok(readFileSync(resolve("public", path)).length > 0);
  const credits = readFileSync("public/assets/models/ATTRIBUTION.txt", "utf8");
  for (const fact of ["DigitalSpace / NASA", originalHash, "not a blanket NASA public-domain", "No NASA endorsement"])
    assert.ok(credits.includes(fact));
});
