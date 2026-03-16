import { onMount, onCleanup, For, Show, createSignal, createMemo } from 'solid-js';
import { unwrap } from 'solid-js/store';
import { EdgeRenderer } from './renderer';
import { createGraphStore } from './store';
import { getNodeTemplates } from './nodeTypes';
import type { NodeTemplate } from './types';
import { NODE_WIDTH, NODE_HEIGHT } from './types';
import type { AudioState } from '../audio';
import Node from './Node';
import AdsrGraph from './AdsrGraph';

// QWERTY piano: bottom row = C4..B4, top row = C5..B5
const KEY_MAP: Record<string, number> = {
  a: 60, w: 61, s: 62, e: 63, d: 64, f: 65,
  t: 66, g: 67, y: 68, h: 69, u: 70, j: 71, k: 72,
};

export default function GraphCanvas(props: { audio: AudioState }) {
  let containerRef!: HTMLDivElement;
  let canvasRef!: HTMLCanvasElement;

  const { audio } = props;
  const templates = getNodeTemplates();
  const { graph, selectedNodeId, setSelectedNodeId, pendingEdge, setPendingEdge, actions } = createGraphStore(audio);

  const [playing, setPlaying] = createSignal(false);
  let dragState: { nodeId: string; ox: number; oy: number } | null = null;
  const heldKeys = new Set<string>();

  function containerXY(e: MouseEvent) {
    const r = containerRef.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top] as const;
  }

  // --- Node interaction ---
  function onHeaderMouseDown(nodeId: string, e: MouseEvent) {
    const [mx, my] = containerXY(e);
    const node = graph.nodes.find(n => n.id === nodeId)!;
    dragState = { nodeId, ox: mx - node.x, oy: my - node.y };
    setSelectedNodeId(nodeId);
  }

  function onOutputMouseDown(nodeId: string, portId: string, e: MouseEvent) {
    const [mx, my] = containerXY(e);
    setPendingEdge({ fromNodeId: nodeId, fromPortId: portId, toX: mx, toY: my });
  }

  function onInputMouseUp(nodeId: string, portId: string) {
    const pe = pendingEdge();
    if (pe && nodeId !== pe.fromNodeId) {
      actions.addEdge(pe.fromNodeId, pe.fromPortId, nodeId, portId);
    }
    setPendingEdge(null);
    dragState = null;
  }

  function onInputRightClick(nodeId: string, portId: string, e: MouseEvent) {
    e.preventDefault();
    actions.removeEdgeByInput(nodeId, portId);
  }

  // --- Container mouse ---
  function onContainerMouseMove(e: MouseEvent) {
    const [mx, my] = containerXY(e);
    if (dragState) {
      actions.moveNode(dragState.nodeId, mx - dragState.ox, my - dragState.oy);
    }
    if (pendingEdge()) {
      setPendingEdge(pe => pe ? { ...pe, toX: mx, toY: my } : null);
    }
  }

  function onContainerMouseUp() {
    dragState = null;
    setPendingEdge(null);
  }

  function onContainerMouseDown() {
    setSelectedNodeId(null);
  }

  // --- Transport ---
  function releaseAllNotes() {
    for (const key of heldKeys) {
      const note = KEY_MAP[key.toLowerCase()];
      if (note) audio.send({ type: 'note_off', note });
    }
    heldKeys.clear();
  }

  function togglePlay() {
    if (playing()) {
      releaseAllNotes();
      audio.stopAudio();
      setPlaying(false);
    } else {
      audio.startAudio().then(() => setPlaying(true)).catch(e => console.error('[GraphCanvas] startAudio failed:', e));
    }
  }

  // --- Keyboard MIDI ---
  function onKeyDown(e: KeyboardEvent) {
    if (e.repeat) return;
    if ((e.key === 'Delete' || e.key === 'Backspace') && selectedNodeId()) {
      actions.removeNode(selectedNodeId()!);
      setSelectedNodeId(null);
      return;
    }
    const note = KEY_MAP[e.key.toLowerCase()];
    if (note && !heldKeys.has(e.key)) {
      heldKeys.add(e.key);
      audio.send({ type: 'note_on', note, velocity: 100 });
    }
  }

  function onKeyUp(e: KeyboardEvent) {
    const note = KEY_MAP[e.key.toLowerCase()];
    if (note) {
      heldKeys.delete(e.key);
      audio.send({ type: 'note_off', note });
    }
  }

  function addNodeAtCenter(template: NodeTemplate) {
    const cx = 400 + (Math.random() - 0.5) * 300;
    const cy = 400 + (Math.random() - 0.5) * 300;
    actions.addNode(template, cx, cy);
  }

  onMount(() => {
    const dpr = window.devicePixelRatio || 1;
    const size = 800;
    canvasRef.width = size * dpr;
    canvasRef.height = size * dpr;
    canvasRef.style.width = size + 'px';
    canvasRef.style.height = size + 'px';

    const renderer = new EdgeRenderer(canvasRef, dpr);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', releaseAllNotes);

    let raf: number;
    const loop = () => {
      renderer.render(unwrap(graph.nodes), unwrap(graph.edges), pendingEdge());
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    onCleanup(() => {
      cancelAnimationFrame(raf);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', releaseAllNotes);
    });
  });

  // Group templates by category for toolbar
  const oscTemplates = () => templates.filter(t => t.type.includes('osc'));
  const utilTemplates = () => templates.filter(t => ['gain', 'pan', 'mixer', 'output'].includes(t.type));
  const filterTemplates = () => templates.filter(t => ['lowpass', 'highpass', 'bandpass', 'notch'].includes(t.type));
  const modTemplates = () => templates.filter(t => ['adsr_env', 'lfo', 'transport'].includes(t.type));
  const fxTemplates = () => templates.filter(t => ['delay', 'reverb'].includes(t.type));
  const samplerTemplates = () => templates.filter(t => ['audio_player'].includes(t.type));

  const btnStyle = {
    padding: '5px 10px',
    background: '#646464',
    color: '#e0e0e0',
    cursor: 'pointer',
    'font-size': '12px',
    border: 'none',
  };

  const labelStyle = {
    color: '#7a7a9a',
    font: 'bold 10px monospace',
    'text-transform': 'uppercase' as const,
    'letter-spacing': '0.5px',
  };

  return (
    <div>
      <div style={{
        padding: '40px',
        background: '#1a1a1a',
      }}>
        {/* Toolbar */}
        <div style={{
          display: 'flex',
          gap: '16px',
          'margin-bottom': '12px',
          'align-items': 'center',
          'flex-wrap': 'wrap',
        }}>
          {/* Transport */}
          <div style={{ display: 'flex', gap: '6px', 'align-items': 'center' }}>
            <span style={labelStyle}>Transport</span>
            <button style={btnStyle} onClick={togglePlay}>
              {playing() ? 'Stop' : 'Play'}
            </button>
          </div>

          <div style={{ width: '1px', height: '24px', background: '#533483' }} />

          {/* Node categories */}
          <div style={{ display: 'flex', gap: '6px', 'align-items': 'center' }}>
            <span style={labelStyle}>Osc</span>
            {oscTemplates().map(t => (
              <button style={btnStyle} onClick={() => addNodeAtCenter(t)}>+ {t.label}</button>
            ))}
          </div>

          <div style={{ display: 'flex', gap: '6px', 'align-items': 'center' }}>
            <span style={labelStyle}>Mod</span>
            {modTemplates().map(t => (
              <button style={btnStyle} onClick={() => addNodeAtCenter(t)}>+ {t.label}</button>
            ))}
          </div>

          <div style={{ display: 'flex', gap: '6px', 'align-items': 'center' }}>
            <span style={labelStyle}>Filter</span>
            {filterTemplates().map(t => (
              <button style={btnStyle} onClick={() => addNodeAtCenter(t)}>+ {t.label}</button>
            ))}
          </div>

          <div style={{ display: 'flex', gap: '6px', 'align-items': 'center' }}>
            <span style={labelStyle}>Util</span>
            {utilTemplates().map(t => (
              <button style={btnStyle} onClick={() => addNodeAtCenter(t)}>+ {t.label}</button>
            ))}
          </div>

          <div style={{ display: 'flex', gap: '6px', 'align-items': 'center' }}>
            <span style={labelStyle}>FX</span>
            {fxTemplates().map(t => (
              <button style={btnStyle} onClick={() => addNodeAtCenter(t)}>+ {t.label}</button>
            ))}
          </div>

          <div style={{ display: 'flex', gap: '6px', 'align-items': 'center' }}>
            <span style={labelStyle}>Sampler</span>
            {samplerTemplates().map(t => (
              <button style={btnStyle} onClick={() => addNodeAtCenter(t)}>+ {t.label}</button>
            ))}
          </div>
        </div>

        {/* Keyboard hint */}
        <div style={{ color: '#556', font: '10px monospace', 'margin-bottom': '8px' }}>
          Keys A-K = piano (C4-C5) &middot; Delete = remove selected node &middot; Right-click input port = disconnect
        </div>

        {/* Graph area */}
        <div
          ref={containerRef}
          style={{
            position: 'relative',
            width: '800px',
            height: '800px',
            background: '#7c7c7c',
            'background-image': 'radial-gradient(circle, #00000022 1px, transparent 1px)',
            'background-size': '16px 16px',
            overflow: 'hidden',
          }}
          onMouseDown={onContainerMouseDown}
          onMouseMove={onContainerMouseMove}
          onMouseUp={onContainerMouseUp}
        >
          <canvas
            ref={canvasRef}
            style={{ position: 'absolute', inset: '0', 'pointer-events': 'none', 'z-index': '5' }}
          />

          <For each={graph.nodes}>
            {(node) => {
              const connected = () => {
                const s = new Set<string>();
                for (const e of graph.edges) {
                  if (e.from.nodeId === node.id) s.add(e.from.portId);
                  if (e.to.nodeId === node.id) s.add(e.to.portId);
                }
                return s;
              };
              return (
                <Node
                  node={node}
                  selected={selectedNodeId() === node.id}
                  connectedPorts={connected()}
                  onHeaderMouseDown={onHeaderMouseDown}
                  onOutputMouseDown={onOutputMouseDown}
                  onInputMouseUp={onInputMouseUp}
                  onInputRightClick={onInputRightClick}
                />
              );
            }}
          </For>

          {/* Settings panel for selected node */}
          <Show when={selectedNodeId()}>
            {(nodeId) => {
              const node = () => graph.nodes.find(n => n.id === nodeId());
              const [addingModParam, setAddingModParam] = createSignal<number | null>(null);
              const modSources = () => graph.nodes.filter(n =>
                n.id !== nodeId() && n.outputs.length > 0
              );
              return (
                <Show when={node()}>
                  {(n) => {
                    const routesForParam = (paramId: number) =>
                      graph.modRoutes.filter(r => r.destNodeId === n().id && r.destParam === paramId);
                    return (
                    <div
                      style={{
                        position: 'absolute',
                        left: (n().x + NODE_WIDTH + 12) + 'px',
                        top: n().y + 'px',
                        background: '#1c2645',
                        padding: '8px',
                        'min-width': '220px',
                        'max-height': '500px',
                        'overflow-y': 'auto',
                        'pointer-events': 'auto',
                        'z-index': '10',
                      }}
                      onMouseDown={(e: MouseEvent) => e.stopPropagation()}
                    >
                      <div style={{
                        display: 'flex',
                        'justify-content': 'space-between',
                        'align-items': 'center',
                        'margin-bottom': '6px',
                      }}>
                        <span style={{ color: '#ccc', font: 'bold 11px monospace' }}>
                          {n().label}
                        </span>
                        <span
                          style={{
                            color: '#888',
                            cursor: 'pointer',
                            font: '14px monospace',
                            'line-height': '1',
                          }}
                          onClick={() => setSelectedNodeId(null)}
                        >
                          x
                        </span>
                      </div>
                      <Show when={n().type === 'adsr_env'}>
                        <AdsrGraph node={n()} />
                      </Show>
                      <Show when={n().params.length > 0} fallback={
                        <div style={{ color: '#556', font: '10px monospace' }}>No parameters</div>
                      }>
                        {n().params.map(p => (
                          <div style={{ 'margin-bottom': '2px' }}>
                            <div style={{
                              display: 'flex',
                              'align-items': 'center',
                              gap: '4px',
                              height: '22px',
                            }}>
                              <span style={{ color: '#888', font: '9px monospace', width: '52px', 'flex-shrink': '0' }}>
                                {p.name}
                              </span>
                              <input
                                type="range"
                                min={p.min}
                                max={p.max}
                                step={p.step}
                                value={p.value}
                                style={{
                                  flex: '1',
                                  height: '4px',
                                  cursor: 'pointer',
                                  'accent-color': '#34ab7b',
                                }}
                                onInput={(e) => {
                                  actions.setParam(n().id, p.paramId, parseFloat(e.currentTarget.value));
                                }}
                              />
                              <span style={{ color: '#999', font: '9px monospace', width: '36px', 'text-align': 'right' }}>
                                {p.value >= 100 ? Math.round(p.value) : p.value.toFixed(1)}
                              </span>
                              <span
                                style={{
                                  color: '#5a7a9a',
                                  cursor: 'pointer',
                                  font: '10px monospace',
                                  'flex-shrink': '0',
                                }}
                                onClick={() => setAddingModParam(
                                  addingModParam() === p.paramId ? null : p.paramId
                                )}
                              >
                                +mod
                              </span>
                            </div>
                            {/* Existing mod routes for this param */}
                            {routesForParam(p.paramId).map(route => {
                              const srcNode = () => graph.nodes.find(nd => nd.id === route.sourceNodeId);
                              return (
                                <div style={{
                                  display: 'flex',
                                  'align-items': 'center',
                                  gap: '4px',
                                  height: '20px',
                                  'padding-left': '8px',
                                }}>
                                  <span style={{ color: '#7a9a5a', font: '8px monospace', width: '52px', 'flex-shrink': '0', overflow: 'hidden' }}>
                                    {srcNode()?.label ?? '?'}
                                  </span>
                                  <input
                                    type="range"
                                    min={-1}
                                    max={1}
                                    step={0.01}
                                    value={route.depth}
                                    style={{
                                      flex: '1',
                                      height: '3px',
                                      cursor: 'pointer',
                                      'accent-color': '#9a7a3a',
                                    }}
                                    onInput={(e) => {
                                      actions.setModDepth(route.id, parseFloat(e.currentTarget.value));
                                    }}
                                  />
                                  <span style={{ color: '#9a9a6a', font: '8px monospace', width: '30px', 'text-align': 'right' }}>
                                    {route.depth.toFixed(2)}
                                  </span>
                                  <span
                                    style={{
                                      color: '#885555',
                                      cursor: 'pointer',
                                      font: '10px monospace',
                                    }}
                                    onClick={() => actions.removeModRoute(route.id)}
                                  >
                                    x
                                  </span>
                                </div>
                              );
                            })}
                            {/* Source picker dropdown */}
                            <Show when={addingModParam() === p.paramId}>
                              <div style={{
                                'padding-left': '8px',
                                'margin-top': '2px',
                                'margin-bottom': '2px',
                              }}>
                                <Show when={modSources().length > 0} fallback={
                                  <span style={{ color: '#556', font: '8px monospace' }}>No sources available</span>
                                }>
                                  <div style={{
                                    display: 'flex',
                                    'flex-wrap': 'wrap',
                                    gap: '2px',
                                  }}>
                                    {modSources().map(src => (
                                      <span
                                        style={{
                                          padding: '1px 5px',
                                          background: '#2a3a5a',
                                          color: '#aac',
                                          font: '8px monospace',
                                          cursor: 'pointer',
                                          border: '1px solid #3a4a6a',
                                        }}
                                        onClick={() => {
                                          actions.addModRoute(src.id, 0, n().id, p.paramId, 0.5);
                                          setAddingModParam(null);
                                        }}
                                      >
                                        {src.label}
                                      </span>
                                    ))}
                                  </div>
                                </Show>
                              </div>
                            </Show>
                          </div>
                        ))}
                      </Show>
                    </div>
                  );}}
                </Show>
              );
            }}
          </Show>
        </div>
      </div>
    </div>
  );
}
