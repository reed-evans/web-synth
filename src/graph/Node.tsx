import { For } from 'solid-js';
import type { GraphNode, ParamDef } from './types';
import { NODE_WIDTH, portX } from './types';
import { categoryForType } from './nodeCategory';
import './node.css';

interface NodeProps {
  node: GraphNode;
  selected: boolean;
  connectedPorts: Set<string>;
  /** Map from input portId → category CSS var of the source node feeding it. */
  inputSourceColors: Record<string, string>;
  pendingTargetPortIds?: Set<string>;
  receivable?: 'yes' | 'no' | 'none';
  onHeaderMouseDown: (nodeId: string, e: MouseEvent) => void;
  onOutputMouseDown: (nodeId: string, portId: string, e: MouseEvent) => void;
  onInputMouseUp: (nodeId: string, portId: string, e: MouseEvent) => void;
  onInputRightClick: (nodeId: string, portId: string, e: MouseEvent) => void;
  onSelect?: (nodeId: string) => void;
}

// Param names where the first-param preview should format as frequency.
const FREQ_PARAMS = new Set(['freq', 'cutoff', 'rate']);
// Param names where the preview should format as seconds.
const TIME_PARAMS = new Set(['time', 'attack', 'decay', 'release']);

function formatMagnitude(v: number): string {
  if (v >= 1000) return `${(v / 1000).toFixed(1)}k`;
  if (v >= 100) return Math.round(v).toString();
  return v.toFixed(2);
}

function paramPreview(params: ParamDef[]): string | null {
  const first = params[0];
  if (!first) return null;
  if (FREQ_PARAMS.has(first.name)) return `${formatMagnitude(first.value)} Hz`;
  if (TIME_PARAMS.has(first.name)) return `${first.value.toFixed(2)}s`;
  return `${first.name} ${formatMagnitude(first.value)}`;
}

export default function Node(props: NodeProps) {
  const n = () => props.node;
  const cat = () => categoryForType(n().type);
  const preview = () => paramPreview(n().params);

  const receivableAttr = () =>
    !props.receivable || props.receivable === 'none' ? undefined : props.receivable;

  return (
    <div
      class="node"
      role="group"
      tabindex={0}
      aria-label={`${n().label} module`}
      data-selected={props.selected ? 'true' : 'false'}
      data-receivable={receivableAttr()}
      style={{
        left: n().x + 'px',
        top: n().y + 'px',
        '--node-width': NODE_WIDTH + 'px',
        '--node-cat-color': `var(${cat().cssVar})`,
      }}
      onMouseDown={(e) => {
        e.stopPropagation();
        props.onHeaderMouseDown(n().id, e);
      }}
      onClick={() => props.onSelect?.(n().id)}
    >
      <div class="node__body">
        <div class="node__meta">
          <span class="node__cat-dot" aria-hidden="true" />
          <span class="node__cat-label">{cat().label}</span>
        </div>
        <div class="node__label">{n().label}</div>
        {preview() && <div class="node__preview">{preview()}</div>}
      </div>

      {/* Input ports — pinned to the top edge */}
      <For each={n().inputs}>
        {(inp, i) => (
          <span
            class="port port--input port-tip port-tip-top"
            role="button"
            aria-label={`input ${inp.name}`}
            tabindex={-1}
            data-tip={inp.name}
            data-connected={props.connectedPorts.has(inp.id) ? 'true' : 'false'}
            data-pending-target={props.pendingTargetPortIds?.has(inp.id) ? 'true' : 'false'}
            style={{
              left: portX(i(), n().inputs.length) + 'px',
              '--port-signal-color': props.inputSourceColors[inp.id] ?? '',
            }}
            onMouseDown={(e) => e.stopPropagation()}
            onMouseUp={(e) => {
              e.stopPropagation();
              props.onInputMouseUp(n().id, inp.id, e);
            }}
            onContextMenu={(e) => {
              e.preventDefault();
              e.stopPropagation();
              props.onInputRightClick(n().id, inp.id, e);
            }}
          />
        )}
      </For>

      {/* Output ports — pinned to the bottom edge */}
      <For each={n().outputs}>
        {(out, i) => (
          <span
            class="port port--output port-tip port-tip-bottom"
            role="button"
            aria-label={`output ${out.name}`}
            tabindex={-1}
            data-tip={out.name}
            data-connected={props.connectedPorts.has(out.id) ? 'true' : 'false'}
            style={{
              left: portX(i(), n().outputs.length) + 'px',
              '--port-signal-color': `var(${cat().cssVar})`,
            }}
            onMouseDown={(e) => {
              e.stopPropagation();
              props.onOutputMouseDown(n().id, out.id, e);
            }}
          />
        )}
      </For>
    </div>
  );
}
