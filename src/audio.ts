import init, { hyasynth_init } from 'hyasynth-engine';
// @ts-ignore — Vite resolves ?url imports to the served asset URL
import wasmUrl from 'hyasynth-engine/hyasynth_bg.wasm?url';

export interface AudioState {
  /** Send a command to the audio worklet; queued until the worklet is ready. */
  send: (cmd: Record<string, unknown>) => void;
  startAudio: () => Promise<void>;
  stopAudio: () => void;
}

const WORKLET_URL = '/audio-processor.js';
const PROCESSOR_NAME = 'hyasynth-processor';

async function loadWasmBytes(): Promise<ArrayBuffer> {
  const response = await fetch(wasmUrl);
  if (!response.ok) throw new Error(`failed to fetch wasm: ${response.status}`);
  return response.arrayBuffer();
}

async function initMainThread(wasmBytes: ArrayBuffer): Promise<void> {
  // The main-thread WASM instance powers helper exports (param IDs, type IDs).
  const module = await WebAssembly.compile(wasmBytes);
  await init(module);
  hyasynth_init();
}

async function createWorklet(wasmBytes: ArrayBuffer): Promise<{ ctx: AudioContext; node: AudioWorkletNode }> {
  const ctx = new AudioContext();
  await ctx.audioWorklet.addModule(WORKLET_URL);

  const node = new AudioWorkletNode(ctx, PROCESSOR_NAME, { outputChannelCount: [2] });
  node.connect(ctx.destination);

  const ready = new Promise<void>((resolve, reject) => {
    node.port.onmessage = (e) => {
      if (e.data?.type === 'ready') resolve();
      else if (e.data?.type === 'error') reject(new Error(e.data.message));
    };
  });

  // Structured-clone of a WebAssembly.Module is unreliable across browsers,
  // so we ship the bytes and re-compile inside the worklet.
  node.port.postMessage({ type: 'init', wasmBytes });
  await ready;
  return { ctx, node };
}

export async function initAudio(): Promise<AudioState> {
  const wasmBytes = await loadWasmBytes();
  await initMainThread(wasmBytes);

  let ctx: AudioContext | null = null;
  let node: AudioWorkletNode | null = null;
  const pending: Record<string, unknown>[] = [];

  const isReady = () => ctx !== null && node !== null;

  const send = (cmd: Record<string, unknown>) => {
    if (isReady()) {
      node!.port.postMessage(cmd);
    } else {
      pending.push(cmd);
    }
  };

  const ensureReady = async () => {
    if (isReady()) return;
    const worklet = await createWorklet(wasmBytes);
    ctx = worklet.ctx;
    node = worklet.node;
    for (const cmd of pending) node.port.postMessage(cmd);
    pending.length = 0;
  };

  const startAudio = async () => {
    await ensureReady();
    if (ctx?.state === 'suspended') await ctx.resume();
    send({ type: 'play' });
  };

  const stopAudio = () => {
    send({ type: 'stop' });
    if (ctx?.state === 'running') ctx.suspend();
  };

  return { send, startAudio, stopAudio };
}
