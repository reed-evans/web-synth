import type { ModRoute, GraphNode } from '../types';

interface ModRouteRowProps {
  route: ModRoute;
  sourceNode: GraphNode | undefined;
  onDepth: (value: number) => void;
  onRemove: () => void;
}

export default function ModRouteRow(props: ModRouteRowProps) {
  return (
    <div class="modroute-row">
      <span class="modroute-row__hook" aria-hidden="true">↳</span>
      <span class="modroute-row__src" title={props.sourceNode?.label ?? ''}>
        {props.sourceNode?.label ?? '?'}
      </span>
      <input
        class="modroute-row__slider"
        type="range"
        min={-1}
        max={1}
        step={0.01}
        value={props.route.depth}
        aria-label="modulation depth"
        onInput={(e) => props.onDepth(parseFloat(e.currentTarget.value))}
      />
      <span class="modroute-row__depth">{props.route.depth.toFixed(2)}</span>
      <button
        type="button"
        class="modroute-row__remove"
        aria-label="remove modulation"
        onClick={props.onRemove}
      >
        ×
      </button>
    </div>
  );
}
