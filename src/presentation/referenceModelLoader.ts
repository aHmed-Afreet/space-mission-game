import * as T from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";
import { assetManifest, dracoDecoder } from "./assetManifest";
import { disposeObjectResources } from "./resources";

type DecoderWorker = Worker & {
  _callbacks: Record<number, { reject(error: Error): void }>;
};
/** The pinned three r186 implementation has no cancellation guard for decoder
 * initialization or queued tasks. Keep this small adapter covered when upgrading
 * three: dispose() alone otherwise permits a late blob URL/worker to escape. */
type DecoderInternals = {
  _initDecoder(): Promise<unknown>;
  _getWorker(taskId: number, cost: number): Promise<DecoderWorker>;
  workerPool: DecoderWorker[];
  workerSourceURL: string;
};

function ownDecoder(decoder: DRACOLoader): DRACOLoader {
  const internal = decoder as unknown as DecoderInternals;
  const initialize = internal._initDecoder.bind(decoder);
  const getWorker = internal._getWorker.bind(decoder);
  const release = decoder.dispose.bind(decoder);
  const guardedWorkers = new WeakSet<Worker>();
  let disposed = false;
  const cancelled = () => Object.assign(new Error("Reference model decoder disposed"), { name: "AbortError" });
  const releaseResources = () => {
    for (const worker of internal.workerPool)
      for (const callback of Object.values(worker._callbacks)) callback.reject(cancelled());
    release();
    internal.workerSourceURL = "";
  };
  internal._initDecoder = () => {
    if (disposed) return Promise.reject(cancelled());
    return initialize().then(() => {
      if (disposed) { releaseResources(); throw cancelled(); }
    });
  };
  // GLTFLoader preloads without awaiting. Decode requests still receive failures
  // through their own promise; the speculative preload must not reject unhandled.
  decoder.preload = () => { void internal._initDecoder().catch(() => {}); return decoder; };
  internal._getWorker = (taskId, cost) => {
    if (disposed) return Promise.reject(cancelled());
    return getWorker(taskId, cost).then(worker => {
      if (disposed) { releaseResources(); throw cancelled(); }
      if (!guardedWorkers.has(worker)) {
        guardedWorkers.add(worker);
        const postMessage = worker.postMessage.bind(worker);
        worker.postMessage = (message: unknown, options: Transferable[] | StructuredSerializeOptions = []) => {
          if (disposed) throw cancelled();
          if (Array.isArray(options)) postMessage(message, options);
          else postMessage(message, options);
        };
      }
      return worker;
    });
  };
  decoder.dispose = () => { disposed = true; releaseResources(); return decoder; };
  return decoder;
}

/** Imported only by the Mission 8 telescope worksite. Relative public paths stay
 * within a deployment subpath and are also listed in the offline asset manifest. */
export function createReferenceModelLoader() {
  const manager = new T.LoadingManager();
  const decoder = ownDecoder(new DRACOLoader(manager)
    .setDecoderPath(dracoDecoder.runtimePath).setWorkerLimit(1));
  const loader = new GLTFLoader(manager).setDRACOLoader(decoder);
  let disposed = false;
  return {
    loader,
    dispose() {
      if (disposed) return;
      disposed = true;
      manager.abort();
      decoder.dispose();
    },
  };
}

/** The caller owns an accepted scene; this handle owns requests and the decoder.
 * A load finishing after disposal owns nothing and releases its scene immediately. */
export function loadReferenceModel(onLoad: (model: T.Group) => void) {
  const request = createReferenceModelLoader();
  let disposed = false;
  const dispose = () => { disposed = true; request.dispose(); };
  try {
    request.loader.load(assetManifest.hubble.runtimeUrl, gltf => {
      if (disposed) { disposeObjectResources(gltf.scene); return; }
      try { onLoad(gltf.scene); } finally { dispose(); }
    }, undefined, dispose);
  } catch { dispose(); /* A local decoder/load failure keeps the procedural worksite. */ }
  return { dispose };
}
