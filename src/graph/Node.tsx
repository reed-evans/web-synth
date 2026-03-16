import type { GraphNode } from './types';
import { NODE_WIDTH, STRIP_HEIGHT, PORT_HEIGHT, LABEL_HEIGHT, PORT_RADIUS } from './types';

interface NodeProps {
  node: GraphNode;
  selected: boolean;
  connectedPorts: Set<string>;
  onHeaderMouseDown: (nodeId: string, e: MouseEvent) => void;
  onOutputMouseDown: (nodeId: string, portId: string, e: MouseEvent) => void;
  onInputMouseUp: (nodeId: string, portId: string, e: MouseEvent) => void;
  onInputRightClick: (nodeId: string, portId: string, e: MouseEvent) => void;
}

// Inject tooltip CSS once
let styleInjected = false;
function injectTooltipStyle() {
  if (styleInjected) return;
  styleInjected = true;
  const style = document.createElement('style');
  style.textContent = `
    .port-tip { position: relative; }
    .port-tip::after {
      content: attr(data-tip);
      position: absolute;
      left: 50%;
      transform: translateX(-50%);
      padding: 2px 6px;
      background: #222;
      color: #ddd;
      font: 10px monospace;
      border-radius: 3px;
      white-space: nowrap;
      pointer-events: none;
      opacity: 0;
      transition: opacity 0.1s;
      z-index: 100;
    }
    .port-tip-top::after { bottom: 100%; margin-bottom: 2px; }
    .port-tip-bottom::after { top: 100%; margin-top: 2px; }
    .port-tip:hover::after { opacity: 1; }
  `;
  document.head.appendChild(style);
}

export default function Node(props: NodeProps) {
  injectTooltipStyle();
  const n = () => props.node;
  const labelColor = () => {
    const [r, g, b] = n().color.map(c => Math.round(c * 255));
    // return `rgb(${r},${g},${b})`;
    return `rgb(40, 40, 40)`;
  };
  const stripColor = () => {
    const [r, g, b] = n().color.map(c => Math.round(c * 160));
    // return `rgb(${r},${g},${b})`;
    return `rgb(100, 100, 100)`;
  };

  return (
    <div
      style={{
        position: 'absolute',
        left: n().x + 'px',
        top: n().y + 'px',
        width: NODE_WIDTH + 'px',
        overflow: 'visible',
        'pointer-events': 'auto',
        'user-select': 'none',
        'box-shadow': props.selected ? '0 0 0 2px #ffd700' : 'none',
      'z-index': '2',
      }}
      onMouseDown={(e: MouseEvent) => {
        e.stopPropagation();
        props.onHeaderMouseDown(n().id, e);
      }}
    >
      {/* Input strip (top) */}
      <div style={{
        height: STRIP_HEIGHT + 'px',
        background: stripColor(),
        position: 'relative',
      }}>
        {n().inputs.map((inp, i) => {
          const count = n().inputs.length;
          const x = (i + 1) * NODE_WIDTH / (count + 1);
          return (
            <span
              class="port-tip port-tip-top"
              data-tip={inp.name}
              style={{
                position: 'absolute',
                width: PORT_HEIGHT * 2 + 'px',
                height: PORT_HEIGHT + 'px',
                'border-radius': `0 0 ${PORT_HEIGHT}px ${PORT_HEIGHT}px`,
                background: props.connectedPorts.has(inp.id) ? '#FFB7A8' : '#aaa',
                left: (x - PORT_HEIGHT) + 'px',
                cursor: 'pointer',
              }}>
            <span
              style={{
                position: 'absolute',
                width: PORT_RADIUS * 2 + 'px',
                height: PORT_RADIUS + 'px',
                'border-radius': `0 0 ${PORT_RADIUS}px ${PORT_RADIUS}px`,
                background: '#000',
                left: (PORT_HEIGHT - PORT_RADIUS) + 'px',
                cursor: 'pointer',
              }}
              onMouseDown={(e: MouseEvent) => e.stopPropagation()}
              onMouseUp={(e: MouseEvent) => {
                e.stopPropagation();
                props.onInputMouseUp(n().id, inp.id, e);
              }}
              onContextMenu={(e: MouseEvent) => {
                e.stopPropagation();
                props.onInputRightClick(n().id, inp.id, e);
              }}
            />
            </span>
          );
        })}
      </div>

      {/* Label (middle) */}
      <div
        style={{
          height: LABEL_HEIGHT + 'px',
          background: labelColor(),
          display: 'flex',
          'align-items': 'center',
          'justify-content': 'center',
          color: '#fff',
          font: 'bold 12px monospace',
          cursor: 'grab',
        }}
        onMouseDown={(e: MouseEvent) => {
          e.stopPropagation();
          props.onHeaderMouseDown(n().id, e);
        }}
      >
        {n().label}
      </div>

      {/* Output strip (bottom) */}
      <div style={{
        height: STRIP_HEIGHT + 'px',
        background: stripColor(),
        position: 'relative',
      }}>
        {n().outputs.map((out, i) => {
          const count = n().outputs.length;
          const x = (i + 1) * NODE_WIDTH / (count + 1);
          return (
            <span
              class="port-tip port-tip-bottom"
              data-tip={out.name}
              style={{
                position: 'absolute',
                width: PORT_HEIGHT * 2 + 'px',
                height: PORT_HEIGHT + 'px',
                'border-radius': `${PORT_HEIGHT}px ${PORT_HEIGHT}px 0 0`,
                background: props.connectedPorts.has(out.id) ? '#DBFF83' : '#aaa',
                left: (x - PORT_HEIGHT) + 'px',
                bottom: 0 + 'px',
                cursor: 'pointer',
              }}>
            <span
              style={{
                position: 'absolute',
                width: PORT_RADIUS * 2 + 'px',
                height: PORT_RADIUS + 'px',
                'border-radius': `${PORT_RADIUS}px ${PORT_RADIUS}px 0 0`,
                background: '#000',
                left: (PORT_HEIGHT - PORT_RADIUS) + 'px',
                bottom: 0 + 'px',
                cursor: 'pointer',
              }}
              onMouseDown={(e: MouseEvent) => {
                e.stopPropagation();
                props.onOutputMouseDown(n().id, out.id, e);
              }}
            />
            </span>
          );
        })}
      </div>
    </div>
  );
}
