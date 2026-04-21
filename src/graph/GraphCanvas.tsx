import { onMount, onCleanup, For, Show, createSignal, createMemo } from 'solid-js';
import { unwrap } from 'solid-js/store';
import { EdgeRenderer } from './renderer';
import { createGraphStore } from './store';
import { getNodeTemplates } from './nodeTypes';
import type { NodeTemplate, GraphNode } from './types';
import type { AudioState } from '../audio';
import Node from './Node';
import Toolbar from './components/Toolbar';
import Inspector from './components/Inspector';
import { allCategories, categoryForType, type Category } from './nodeCategory';
import { getTheme, toggleTheme } from '../theme';
import { midiForKey } from './pianoKeys';
import { prefersReducedMotion, onReducedMotionChange } from './reducedMotion';
import './graph-canvas.css';

const WORKSPACE_SIZE = 800;
const NOTE_VELOCITY = 100;
const NUDGE_STEP = 8;
const NUDGE_STEP_FINE = 1;
const SPAWN_JITTER = 300;
const WORKSPACE_CENTER = WORKSPACE_SIZE / 2;

function groupTemplatesByCategory(templates: NodeTemplate[]): Record<Category, NodeTemplate[]> {
  const groups = Object.fromEntries(allCategories().map(c => [c, [] as NodeTemplate[]])) as Record<Category, NodeTemplate[]>;
  for (const t of templates) {
    groups[categoryForType(t.type).category].push(t);
  }
  return groups;
}

function isFormTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.tagName === 'INPUT' || target.tagName === 'TEXTAREA';
}

export default function GraphCanvas(props: { audio: AudioState }) {
  let containerRef!: HTMLDivElement;
  let canvasRef!: HTMLCanvasElement;

  const { audio } = props;
  const templates = getNodeTemplates();
  const templatesByCategory = groupTemplatesByCategory(templates);
  const {
    graph, selectedNodeId, setSelectedNodeId,
    pendingEdge, setPendingEdge, actions,
  } = createGraphStore(audio);

  const [playing, setPlaying] = createSignal(false);
  let dragState: { nodeId: string; ox: number; oy: number; moved: boolean } | null = null;
  const heldKeys = new Set<string>();

  const containerXY = (e: MouseEvent): [number, number] => {
    const r = containerRef.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top];
  };

  // --- Drag + pending-edge handlers ---

  const onHeaderMouseDown = (nodeId: string, e: MouseEvent) => {
    const [mx, my] = containerXY(e);
    const node = graph.nodes.find(n => n.id === nodeId);
    if (!node) return;
    dragState = { nodeId, ox: mx - node.x, oy: my - node.y, moved: false };
    setSelectedNodeId(nodeId);
  };

  const onOutputMouseDown = (nodeId: string, portId: string, e: MouseEvent) => {
    const [mx, my] = containerXY(e);
    setPendingEdge({ fromNodeId: nodeId, fromPortId: portId, toX: mx, toY: my });
  };

  const onInputMouseUp = (nodeId: string, portId: string) => {
    const pe = pendingEdge();
    if (pe && nodeId !== pe.fromNodeId) {
      actions.addEdge(pe.fromNodeId, pe.fromPortId, nodeId, portId);
    }
    setPendingEdge(null);
    dragState = null;
  };

  const onInputRightClick = (nodeId: string, portId: string, e: MouseEvent) => {
    e.preventDefault();
    actions.removeEdgeByInput(nodeId, portId);
  };

  const onContainerMouseMove = (e: MouseEvent) => {
    const [mx, my] = containerXY(e);
    if (dragState) {
      dragState.moved = true;
      actions.moveNode(dragState.nodeId, mx - dragState.ox, my - dragState.oy);
    }
    if (pendingEdge()) {
      setPendingEdge(pe => pe ? { ...pe, toX: mx, toY: my } : null);
    }
  };

  const onContainerMouseUp = () => {
    dragState = null;
    setPendingEdge(null);
  };

  const onContainerMouseDown = () => setSelectedNodeId(null);

  // --- Transport + MIDI ---

  const releaseAllNotes = () => {
    for (const key of heldKeys) {
      const note = midiForKey(key);
      if (note !== undefined) audio.send({ type: 'note_off', note });
    }
    heldKeys.clear();
  };

  const togglePlay = () => {
    if (playing()) {
      releaseAllNotes();
      audio.stopAudio();
      setPlaying(false);
      return;
    }
    audio.startAudio()
      .then(() => setPlaying(true))
      .catch(e => console.error('[GraphCanvas] startAudio failed:', e));
  };

  // --- Keyboard handlers ---

  const nudgeSelectedNode = (dx: number, dy: number) => {
    const id = selectedNodeId();
    if (!id) return;
    const n = graph.nodes.find(g => g.id === id);
    if (!n) return;
    actions.moveNode(id, n.x + dx, n.y + dy);
  };

  const ARROW_DIRS: Record<string, [number, number]> = {
    ArrowUp: [0, -1], ArrowDown: [0, 1],
    ArrowLeft: [-1, 0], ArrowRight: [1, 0],
  };

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.repeat) return;
    const isForm = isFormTarget(e.target);
    const id = selectedNodeId();

    if ((e.key === 'Delete' || e.key === 'Backspace') && id && !isForm) {
      actions.removeNode(id);
      setSelectedNodeId(null);
      return;
    }

    const arrow = ARROW_DIRS[e.key];
    if (arrow && id && !isForm) {
      e.preventDefault();
      const step = e.shiftKey ? NUDGE_STEP_FINE : NUDGE_STEP;
      nudgeSelectedNode(arrow[0] * step, arrow[1] * step);
      return;
    }

    const note = midiForKey(e.key);
    if (note !== undefined && !heldKeys.has(e.key) && !isForm) {
      heldKeys.add(e.key);
      audio.send({ type: 'note_on', note, velocity: NOTE_VELOCITY });
    }
  };

  const onKeyUp = (e: KeyboardEvent) => {
    const note = midiForKey(e.key);
    if (note !== undefined) {
      heldKeys.delete(e.key);
      audio.send({ type: 'note_off', note });
    }
  };

  const addNodeAtCenter = (template: NodeTemplate) => {
    const cx = WORKSPACE_CENTER + (Math.random() - 0.5) * SPAWN_JITTER;
    const cy = WORKSPACE_CENTER + (Math.random() - 0.5) * SPAWN_JITTER;
    actions.addNode(template, cx, cy);
  };

  // --- Derived visuals ---

  const inputSourceTintsByNode = createMemo(() => {
    const map = new Map<string, Record<string, string>>();
    for (const edge of graph.edges) {
      const srcNode = graph.nodes.find(n => n.id === edge.from.nodeId);
      if (!srcNode) continue;
      const cssVar = `var(${categoryForType(srcNode.type).cssVar})`;
      const existing = map.get(edge.to.nodeId) ?? {};
      existing[edge.to.portId] = cssVar;
      map.set(edge.to.nodeId, existing);
    }
    return map;
  });

  const pendingReceivable = createMemo(() => {
    const pe = pendingEdge();
    if (!pe) return null;
    const result = new Map<string, 'yes' | 'no'>();
    for (const n of graph.nodes) {
      if (n.id === pe.fromNodeId) continue;
      result.set(n.id, n.inputs.length > 0 ? 'yes' : 'no');
    }
    return result;
  });

  const pendingTargets = createMemo(() => {
    const pe = pendingEdge();
    if (!pe) return null;
    const result = new Map<string, Set<string>>();
    for (const n of graph.nodes) {
      if (n.id === pe.fromNodeId || n.inputs.length === 0) continue;
      result.set(n.id, new Set(n.inputs.map(p => p.id)));
    }
    return result;
  });

  onMount(() => {
    const dpr = window.devicePixelRatio || 1;
    canvasRef.width = WORKSPACE_SIZE * dpr;
    canvasRef.height = WORKSPACE_SIZE * dpr;
    canvasRef.style.width = WORKSPACE_SIZE + 'px';
    canvasRef.style.height = WORKSPACE_SIZE + 'px';

    const renderer = new EdgeRenderer(canvasRef, dpr, { reducedMotion: prefersReducedMotion() });
    const unsubMotion = onReducedMotionChange(v => renderer.setReducedMotion(v));

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', releaseAllNotes);

    let raf = 0;
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
      unsubMotion();
    });
  });

  const selectedNode = () => {
    const id = selectedNodeId();
    return id ? graph.nodes.find(n => n.id === id) ?? null : null;
  };

  const routesForSelected = () => {
    const n = selectedNode();
    return n ? graph.modRoutes.filter(r => r.destNodeId === n.id) : [];
  };

  const modSources = (): GraphNode[] => {
    const n = selectedNode();
    if (!n) return [];
    return graph.nodes.filter(other => other.id !== n.id && other.outputs.length > 0);
  };

  return (
    <div class="graph-shell">
      <Toolbar
        playing={playing()}
        onTogglePlay={togglePlay}
        theme={getTheme()()}
        onToggleTheme={toggleTheme}
        templatesByCategory={templatesByCategory}
        onAddNode={addNodeAtCenter}
      />

      <div class="graph-stage">
        <div
          ref={containerRef}
          class="workspace"
          onMouseDown={onContainerMouseDown}
          onMouseMove={onContainerMouseMove}
          onMouseUp={onContainerMouseUp}
        >
          <canvas ref={canvasRef} class="workspace__canvas" />

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
              const tints = () => inputSourceTintsByNode().get(node.id) ?? {};
              const recv = () => pendingReceivable()?.get(node.id) ?? 'none';
              const pendTargets = () => pendingTargets()?.get(node.id);
              return (
                <Node
                  node={node}
                  selected={selectedNodeId() === node.id}
                  connectedPorts={connected()}
                  inputSourceColors={tints()}
                  pendingTargetPortIds={pendTargets()}
                  receivable={recv()}
                  onHeaderMouseDown={onHeaderMouseDown}
                  onOutputMouseDown={onOutputMouseDown}
                  onInputMouseUp={onInputMouseUp}
                  onInputRightClick={onInputRightClick}
                  onSelect={setSelectedNodeId}
                />
              );
            }}
          </For>

          <Show when={selectedNode()}>
            {(n) => (
              <Inspector
                node={n()}
                routes={routesForSelected()}
                modSources={modSources()}
                workspaceWidth={WORKSPACE_SIZE}
                onClose={() => setSelectedNodeId(null)}
                onSetParam={(paramId, value) => actions.setParam(n().id, paramId, value)}
                onAddModRoute={(sourceNodeId, paramId) =>
                  actions.addModRoute(sourceNodeId, 0, n().id, paramId, 0.5)
                }
                onRemoveModRoute={(routeId) => actions.removeModRoute(routeId)}
                onSetModDepth={(routeId, depth) => actions.setModDepth(routeId, depth)}
              />
            )}
          </Show>
        </div>
      </div>
    </div>
  );
}
