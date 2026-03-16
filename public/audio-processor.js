// ── AudioWorklet polyfills (TextDecoder/TextEncoder unavailable here) ─
if (typeof TextDecoder === 'undefined') {
  globalThis.TextDecoder = class TextDecoder {
    decode(bytes) {
      if (!bytes || bytes.length === 0) return '';
      const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
      let str = '';
      let i = 0;
      while (i < u8.length) {
        const b = u8[i];
        if (b < 0x80) { str += String.fromCharCode(b); i++; }
        else if ((b & 0xE0) === 0xC0) { str += String.fromCharCode(((b & 0x1F) << 6) | (u8[i+1] & 0x3F)); i += 2; }
        else if ((b & 0xF0) === 0xE0) { str += String.fromCharCode(((b & 0x0F) << 12) | ((u8[i+1] & 0x3F) << 6) | (u8[i+2] & 0x3F)); i += 3; }
        else { const cp = ((b & 0x07) << 18) | ((u8[i+1] & 0x3F) << 12) | ((u8[i+2] & 0x3F) << 6) | (u8[i+3] & 0x3F);
          str += String.fromCharCode(0xD800 + ((cp - 0x10000) >> 10), 0xDC00 + ((cp - 0x10000) & 0x3FF)); i += 4; }
      }
      return str;
    }
  };
}
if (typeof TextEncoder === 'undefined') {
  globalThis.TextEncoder = class TextEncoder {
    encode(str) {
      const buf = [];
      for (let i = 0; i < str.length; i++) {
        let cp = str.charCodeAt(i);
        if (cp >= 0xD800 && cp <= 0xDBFF && i + 1 < str.length) {
          const lo = str.charCodeAt(i + 1);
          if (lo >= 0xDC00 && lo <= 0xDFFF) { cp = 0x10000 + ((cp - 0xD800) << 10) + (lo - 0xDC00); i++; }
        }
        if (cp < 0x80) buf.push(cp);
        else if (cp < 0x800) { buf.push(0xC0 | (cp >> 6), 0x80 | (cp & 0x3F)); }
        else if (cp < 0x10000) { buf.push(0xE0 | (cp >> 12), 0x80 | ((cp >> 6) & 0x3F), 0x80 | (cp & 0x3F)); }
        else { buf.push(0xF0 | (cp >> 18), 0x80 | ((cp >> 12) & 0x3F), 0x80 | ((cp >> 6) & 0x3F), 0x80 | (cp & 0x3F)); }
      }
      return new Uint8Array(buf);
    }
    encodeInto(str, dest) {
      const encoded = this.encode(str);
      const len = Math.min(encoded.length, dest.length);
      dest.set(encoded.subarray(0, len));
      return { read: str.length, written: len };
    }
  };
}

console.log('[worklet] audio-processor.js loaded');

// Self-contained AudioWorklet processor with wasm-bindgen glue code.
// Receives a compiled WebAssembly.Module from the main thread,
// instantiates it, and handles audio rendering + command processing.

let wasm = null;
let sessionPtr = 0;
let enginePtr = 0;
let registryPtr = 0;
let renderBuf = null;
let WASM_VECTOR_LEN = 0;

// UI node ID → engine node ID mapping
const nodeMap = new Map();
// UI mod route ID → engine mod route ID mapping
const modRouteMap = new Map();

// ── Soft clipper (linear below ±1, smooth saturation above) ─────────
// Passes signal through unchanged when |x| ≤ 1.
// Above that, cubic soft-knee compresses toward ±1.5 ceiling.
function softClip(x) {
  if (x <= -1.0) {
    // Mirror of positive branch
    x = -x;
    const overshoot = x - 1.0;
    const knee = overshoot / (1.0 + overshoot);  // asymptote at 1.0
    return -(1.0 + knee * 0.5);                   // ceiling at -1.5
  }
  if (x >= 1.0) {
    const overshoot = x - 1.0;
    const knee = overshoot / (1.0 + overshoot);
    return 1.0 + knee * 0.5;                      // ceiling at 1.5
  }
  return x;  // linear passthrough
}

// ── WASM memory helpers ──────────────────────────────────────────────

let cachedUint8 = null;
function getUint8() {
  if (!cachedUint8 || cachedUint8.byteLength === 0)
    cachedUint8 = new Uint8Array(wasm.memory.buffer);
  return cachedUint8;
}

let cachedFloat32 = null;
function getFloat32() {
  if (!cachedFloat32 || cachedFloat32.byteLength === 0)
    cachedFloat32 = new Float32Array(wasm.memory.buffer);
  return cachedFloat32;
}

let cachedDataView = null;
function getDataView() {
  if (!cachedDataView || cachedDataView.buffer !== wasm.memory.buffer)
    cachedDataView = new DataView(wasm.memory.buffer);
  return cachedDataView;
}

function getArrayU8(ptr, len) {
  return getUint8().subarray(ptr >>> 0, (ptr >>> 0) + len);
}

const textDecoder = new TextDecoder('utf-8', { ignoreBOM: true, fatal: true });
textDecoder.decode();

function getStringFromWasm(ptr, len) {
  return textDecoder.decode(getUint8().subarray(ptr >>> 0, (ptr >>> 0) + len));
}

const textEncoder = new TextEncoder();

function passStringToWasm(arg, malloc, realloc) {
  let len = arg.length;
  let ptr = malloc(len, 1) >>> 0;
  const mem = getUint8();
  let offset = 0;
  for (; offset < len; offset++) {
    const code = arg.charCodeAt(offset);
    if (code > 0x7F) break;
    mem[ptr + offset] = code;
  }
  if (offset !== len) {
    if (offset !== 0) arg = arg.slice(offset);
    ptr = realloc(ptr, len, len = offset + arg.length * 3, 1) >>> 0;
    const view = getUint8().subarray(ptr + offset, ptr + len);
    const ret = textEncoder.encodeInto(arg, view);
    offset += ret.written;
    ptr = realloc(ptr, len, offset, 1) >>> 0;
  }
  WASM_VECTOR_LEN = offset;
  return ptr;
}

function passArrayF32ToWasm(arg, malloc) {
  const ptr = malloc(arg.length * 4, 4) >>> 0;
  getFloat32().set(arg, ptr / 4);
  WASM_VECTOR_LEN = arg.length;
  return ptr;
}

// ── WASM import resolution ───────────────────────────────────────────
// Dynamically matches import names by stripping __wbg_ prefix and hash suffixes,
// so this processor works across wasm-bindgen rebuilds.

function resolveImport(base) {
  switch (base) {
    case '__wbindgen_copy_to_typed_array':
      return (ptr, len, arr) => {
        new Uint8Array(arr.buffer, arr.byteOffset, arr.byteLength).set(getArrayU8(ptr, len));
      };
    case '__wbindgen_throw':
      return (ptr, len) => { throw new Error(getStringFromWasm(ptr, len)); };
    case 'debug':
      return (arg) => console.debug(arg);
    case 'error':
      return (...args) => {
        if (args.length >= 2 && typeof args[0] === 'number' && typeof args[1] === 'number') {
          try { console.error(getStringFromWasm(args[0], args[1])); }
          finally { if (wasm) wasm.__wbindgen_free(args[0], args[1], 1); }
        } else {
          console.error(args[0]);
        }
      };
    case 'info':
      return (arg) => console.info(arg);
    case 'log':
      return (arg) => console.log(arg);
    case 'new':
      return () => new Error();
    case 'stack':
      return (arg0, arg1) => {
        const ret = arg1.stack;
        const ptr = passStringToWasm(ret, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len = WASM_VECTOR_LEN;
        getDataView().setInt32(arg0 + 4, len, true);
        getDataView().setInt32(arg0, ptr, true);
      };
    case 'warn':
      return (arg) => console.warn(arg);
    case '__wbindgen_cast':
      return (ptr, len) => getStringFromWasm(ptr, len);
    case '__wbindgen_init_externref_table':
      return () => {
        const table = wasm.__wbindgen_externrefs;
        const offset = table.grow(4);
        table.set(0, undefined);
        table.set(offset + 0, undefined);
        table.set(offset + 1, null);
        table.set(offset + 2, true);
        table.set(offset + 3, false);
      };
    default:
      console.warn('[audio-processor] Unknown WASM import:', base);
      return () => {};
  }
}

function buildImports(wasmModule) {
  const imports = {};
  for (const { module: mod, name } of WebAssembly.Module.imports(wasmModule)) {
    if (!imports[mod]) imports[mod] = {};
    // Strip __wbg_ prefix, then strip _<16 hex chars> hash suffix
    let base = name;
    if (base.startsWith('__wbg_')) base = base.slice(6);
    base = base.replace(/_[0-9a-f]{16}$/, '');
    imports[mod][name] = resolveImport(base);
  }
  return imports;
}

// ── WASM instantiation ───────────────────────────────────────────────

function initWasm(wasmModule) {
  const imports = buildImports(wasmModule);
  const instance = new WebAssembly.Instance(wasmModule, imports);
  wasm = instance.exports;
  wasm.__wbindgen_start();
  wasm.hyasynth_init();

  // Create session "default"
  const namePtr = passStringToWasm('default', wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
  const nameLen = WASM_VECTOR_LEN;
  sessionPtr = wasm.hyasynthsession_new(namePtr, nameLen);

  enginePtr = wasm.hyasynthsession_create_engine(sessionPtr);
  registryPtr = wasm.hyasynthregistry_new();

  renderBuf = new Float32Array(128 * 2);
}

// ── Command handling ─────────────────────────────────────────────────

function handleCommand(cmd) {
  if (!wasm) return;
  switch (cmd.type) {
    case 'add_node': {
      const eid = wasm.hyasynthsession_add_node(sessionPtr, cmd.typeId, cmd.x, cmd.y);
      nodeMap.set(cmd.uiId, eid);
      break;
    }
    case 'remove_node': {
      const eid = nodeMap.get(cmd.uiId);
      if (eid !== undefined) {
        wasm.hyasynthsession_remove_node(sessionPtr, eid);
        nodeMap.delete(cmd.uiId);
      }
      break;
    }
    case 'connect': {
      const src = nodeMap.get(cmd.srcUiId);
      const dst = nodeMap.get(cmd.dstUiId);
      if (src !== undefined && dst !== undefined)
        wasm.hyasynthsession_connect(sessionPtr, src, cmd.srcPort, dst, cmd.dstPort);
      break;
    }
    case 'disconnect': {
      const src = nodeMap.get(cmd.srcUiId);
      const dst = nodeMap.get(cmd.dstUiId);
      if (src !== undefined && dst !== undefined)
        wasm.hyasynthsession_disconnect(sessionPtr, src, cmd.srcPort, dst, cmd.dstPort);
      break;
    }
    case 'set_output': {
      const eid = nodeMap.get(cmd.uiId);
      if (eid !== undefined) wasm.hyasynthsession_set_output(sessionPtr, eid);
      break;
    }
    case 'set_param': {
      const eid = nodeMap.get(cmd.uiId);
      if (eid !== undefined) wasm.hyasynthsession_set_param(sessionPtr, eid, cmd.paramId, cmd.value);
      break;
    }
    case 'play':
      wasm.hyasynthsession_play(sessionPtr);
      break;
    case 'stop':
      wasm.hyasynthsession_stop(sessionPtr);
      break;
    case 'note_on':
      wasm.hyasynthsession_note_on(sessionPtr, cmd.note, cmd.velocity);
      break;
    case 'note_off':
      wasm.hyasynthsession_note_off(sessionPtr, cmd.note);
      break;
    case 'add_mod_route': {
      const src = nodeMap.get(cmd.srcUiId);
      const dst = nodeMap.get(cmd.dstUiId);
      if (src !== undefined && dst !== undefined) {
        const engineId = wasm.hyasynthsession_add_mod_route(sessionPtr, src, cmd.srcPort, dst, cmd.dstParam, cmd.depth);
        modRouteMap.set(cmd.routeId, engineId);
      }
      break;
    }
    case 'remove_mod_route': {
      const engineId = modRouteMap.get(cmd.routeId);
      if (engineId !== undefined) {
        wasm.hyasynthsession_remove_mod_route(sessionPtr, engineId);
        modRouteMap.delete(cmd.routeId);
      }
      break;
    }
    case 'set_mod_depth': {
      const engineId = modRouteMap.get(cmd.routeId);
      if (engineId !== undefined) {
        wasm.hyasynthsession_set_mod_depth(sessionPtr, engineId, cmd.depth);
      }
      break;
    }
  }
}

// ── AudioWorklet Processor ───────────────────────────────────────────

class HyasynthProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    console.log('[worklet] Being constructed')
    this.ready = false;

    // Test: send a message TO main thread from constructor
    // this.port.postMessage({ type: 'ping', msg: 'worklet constructor reached' });

    this.port.onmessage = (e) => {
      const msg = e.data;
      if (msg.type === 'init') {
        try {
          console.log('[worklet] Received init, compiling WASM from bytes...');
          const wasmModule = new WebAssembly.Module(msg.wasmBytes);
          initWasm(wasmModule);
          this.ready = true;
          console.log('[worklet] WASM initialized OK. sessionPtr:', sessionPtr, 'enginePtr:', enginePtr);
          this.port.postMessage({ type: 'ready' });
        } catch (err) {
          console.error('[worklet] Init failed:', err);
          this.port.postMessage({ type: 'error', message: String(err) });
        }
      } else {
        console.log('[worklet] Command:', msg.type, msg); 
        handleCommand(msg);
      }
    };
  }

  process(_inputs, outputs) {
    if (!this.ready || !wasm) return true;

    const output = outputs[0];
    if (!output || !output.length) return true;

    const frames = output[0].length;

    // Process pending session commands
    const needsRecompile = wasm.hyasynthengine_process_commands(enginePtr);
    if (needsRecompile !== 0) {
      console.log('[worklet] Recompiling graph...');
      wasm.hyasynthengine_compile_graph(enginePtr, sessionPtr, registryPtr, sampleRate);
      wasm.hyasynthengine_prepare(enginePtr, sampleRate);
    }

    // Ensure render buffer fits
    if (!renderBuf || renderBuf.length < frames * 2) {
      renderBuf = new Float32Array(frames * 2);
    }

    // Zero before render (engine may accumulate into the buffer)
    renderBuf.fill(0);

    // Render: pass buffer into WASM, engine writes back via externref copy
    const ptr = passArrayF32ToWasm(renderBuf, wasm.__wbindgen_malloc);
    const len = WASM_VECTOR_LEN;
    wasm.hyasynthengine_render(enginePtr, frames, ptr, len, renderBuf);

    // Deinterleave to output channels with soft clipping.
    // Linear below ±1.0 so clean signals pass through undistorted;
    // smoothly compresses toward ±1.0 above that to avoid hard clipping.
    const L = output[0];
    const R = output.length > 1 ? output[1] : null;
    for (let i = 0; i < frames; i++) {
      // Can also use Math.tanh(), mix / (1.0 + mix.abs());
      L[i] = Math.tanh(renderBuf[i * 2] * 0.5);
      if (R) R[i] = Math.tanh(renderBuf[i * 2 + 1] * 0.5);
    }

    // Log sample values periodically (every ~1 second)
    if (!this._logCount) this._logCount = 0;
    this._logCount++;
    if (this._logCount % 375 === 1) {
      const maxVal = Math.max(...L.map(Math.abs));
      console.log('[worklet] render tick', this._logCount, '| max sample:', maxVal, '| first 4:', L[0], L[1], L[2], L[3]);
    }

    return true;
  }
}

console.log('[worklet] Registering processor...');
registerProcessor('hyasynth-processor', HyasynthProcessor);
console.log('[worklet] Processor registered OK');
