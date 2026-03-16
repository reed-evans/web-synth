import init, { hyasynth_init } from 'hyasynth-engine';
// @ts-ignore – Vite resolves ?url imports to the served asset URL
import wasmUrl from 'hyasynth-engine/hyasynth_bg.wasm?url';

export interface AudioState {
  send: (cmd: Record<string, unknown>) => void;
  startAudio: () => Promise<void>;
  stopAudio: () => void;
}

export async function initAudio(): Promise<AudioState> {
  // Grab the compiled WASM Module from wasm-bindgen's internal state                                          
  // const wasmModule = (init as any).__wbindgen_wasm_module as WebAssembly.Module; 

  // Fetch and compile WASM binary (we need the Module to send to the worklet)
  const wasmResponse = await fetch(wasmUrl);
  const wasmBytes = await wasmResponse.arrayBuffer();
  const wasmModule = await WebAssembly.compile(wasmBytes);

  // Init on main thread with our compiled module
  await init(wasmModule);
  hyasynth_init();
  console.log('[audio] WASM initialized, wasmModule is Module:', wasmModule instanceof WebAssembly.Module);
  console.log(wasmModule);

  let audioCtx: AudioContext | null = null;
  let workletNode: AudioWorkletNode | null = null;
  let ready = false;
  const pendingCmds: Record<string, unknown>[] = [];

  function send(cmd: Record<string, unknown>) {
    if (ready && workletNode) {
      console.log('[audio] Sending cmd:', cmd.type, cmd);
      workletNode.port.postMessage(cmd);
    } else {
      console.log('[audio] Queuing cmd (not ready):', cmd.type, cmd);
      pendingCmds.push(cmd);
    }
  }

  async function ensureReady() {
    if (ready) return;

    audioCtx = new AudioContext();
    console.log('[audio] Adding worklet module...');
    await audioCtx.audioWorklet.addModule('/audio-processor.js');
    console.log('[audio] Worklet module added OK');

    workletNode = new AudioWorkletNode(audioCtx, 'hyasynth-processor', {
      outputChannelCount: [2],
    });
    workletNode.connect(audioCtx.destination);
    console.log('[audio] AudioWorkletNode created and connected');

    // Set up response handler BEFORE sending init (avoid race)
    const initPromise = new Promise<void>((resolve, reject) => {
      workletNode!.port.onmessage = (e) => {
        console.log('[audio] Got message from worklet:', e.data);
        if (e.data.type === 'ready') resolve();
        else if (e.data.type === 'error') reject(new Error(e.data.message));
      };
    });

    // Send compiled WASM module to worklet for instantiation
    console.log('[audio] Sending init message with wasmModule to worklet...');
    console.log('[audio] wasmModule is WebAssembly.Module?', wasmModule instanceof WebAssembly.Module);
    try {
      // For some reason passing the wasmModule doesn't work - maybe a browser issue with structured cloning
      workletNode.port.postMessage({ type: 'init', wasmBytes });
      console.log('[audio] postMessage sent OK');
    } catch (e) {
      console.error('[audio] postMessage FAILED:', e);
      throw e;
    }

    await initPromise;

    ready = true;
    console.log('[audio] Worklet ready! Flushing', pendingCmds.length, 'queued commands');

    // Flush commands that were queued before the worklet was ready
    for (const cmd of pendingCmds) {
      console.log('[audio] Flushing cmd:', cmd.type, cmd);
      workletNode.port.postMessage(cmd);
    }
    pendingCmds.length = 0;
  }

  async function startAudio() {
    await ensureReady();
    if (audioCtx?.state === 'suspended') {
      await audioCtx.resume();
    }
    send({ type: 'play' });
  }

  function stopAudio() {
    send({ type: 'stop' });
    if (audioCtx?.state === 'running') {
      audioCtx.suspend();
    }
  }

  return { send, startAudio, stopAudio };
}
