import { createSignal, For, Show } from 'solid-js';
import type { GraphNode, ModRoute } from '../types';
import { NODE_WIDTH } from '../types';
import { categoryForType } from '../nodeCategory';
import AdsrGraph from '../AdsrGraph';
import ParamRow from './ParamRow';
import ModRouteRow from './ModRouteRow';
import './inspector.css';

const INSPECTOR_WIDTH = 304;

interface InspectorProps {
  node: GraphNode;
  routes: ModRoute[];
  modSources: GraphNode[];
  workspaceWidth: number;
  onClose: () => void;
  onSetParam: (paramId: number, value: number) => void;
  onAddModRoute: (sourceNodeId: string, paramId: number) => void;
  onRemoveModRoute: (routeId: string) => void;
  onSetModDepth: (routeId: string, value: number) => void;
}

export default function Inspector(props: InspectorProps) {
  const [addingModParam, setAddingModParam] = createSignal<number | null>(null);

  const cat = () => categoryForType(props.node.type);

  const positionStyle = () => {
    const rightEdge = props.node.x + NODE_WIDTH + 12 + INSPECTOR_WIDTH;
    const flip = rightEdge > props.workspaceWidth;
    const left = flip
      ? Math.max(8, props.node.x - INSPECTOR_WIDTH - 12)
      : props.node.x + NODE_WIDTH + 12;
    return {
      left: left + 'px',
      top: props.node.y + 'px',
    };
  };

  const routesForParam = (paramId: number): ModRoute[] =>
    props.routes.filter(r => r.destParam === paramId);

  return (
    <div
      class="inspector"
      role="dialog"
      aria-label={`${props.node.label} parameters`}
      style={{
        ...positionStyle(),
        '--node-cat-color': `var(${cat().cssVar})`,
      }}
      onMouseDown={(e: MouseEvent) => e.stopPropagation()}
    >
      <header class="inspector__header">
        <div class="inspector__meta">
          <span class="inspector__cat-dot" aria-hidden="true" />
          <span class="inspector__cat-label">{cat().label}</span>
        </div>
        <span class="inspector__title">{props.node.label}</span>
        <button
          type="button"
          class="inspector__close"
          aria-label="close inspector"
          onClick={props.onClose}
        >
          <svg viewBox="0 0 12 12" width="10" height="10" aria-hidden="true">
            <path
              d="M2.5 2.5 L9.5 9.5 M9.5 2.5 L2.5 9.5"
              stroke="currentColor"
              stroke-width="1.2"
              stroke-linecap="round"
            />
          </svg>
        </button>
      </header>

      <div class="inspector__body">
        <Show when={props.node.type === 'adsr_env'}>
          <div class="inspector__adsr">
            <AdsrGraph node={props.node} />
          </div>
        </Show>

        <Show
          when={props.node.params.length > 0}
          fallback={<div class="inspector__empty">No parameters</div>}
        >
          <For each={props.node.params}>
            {(p) => {
              const paramRoutes = () => routesForParam(p.paramId);
              const isActive = () => addingModParam() === p.paramId;
              const modulated = () => paramRoutes().length > 0;
              return (
                <>
                  <ParamRow
                    param={p}
                    modulated={modulated()}
                    modActive={isActive()}
                    onInput={(v) => props.onSetParam(p.paramId, v)}
                    onToggleAddMod={() => setAddingModParam(isActive() ? null : p.paramId)}
                  />
                  <For each={paramRoutes()}>
                    {(route) => (
                      <ModRouteRow
                        route={route}
                        sourceNode={props.modSources.find(n => n.id === route.sourceNodeId)
                          ?? undefined}
                        onDepth={(v) => props.onSetModDepth(route.id, v)}
                        onRemove={() => props.onRemoveModRoute(route.id)}
                      />
                    )}
                  </For>
                  <Show when={isActive()}>
                    <div class="modpicker">
                      <Show
                        when={props.modSources.length > 0}
                        fallback={<div class="modpicker__empty">No sources available</div>}
                      >
                        <div class="modpicker__list">
                          <For each={props.modSources}>
                            {(src) => {
                              const srcCat = categoryForType(src.type);
                              return (
                                <button
                                  type="button"
                                  class="modpicker__item"
                                  style={{ '--cat-color': `var(${srcCat.cssVar})` }}
                                  onClick={() => {
                                    props.onAddModRoute(src.id, p.paramId);
                                    setAddingModParam(null);
                                  }}
                                >
                                  <span class="modpicker__item__dot" aria-hidden="true" />
                                  <span class="modpicker__item__name">{src.label}</span>
                                </button>
                              );
                            }}
                          </For>
                        </div>
                      </Show>
                    </div>
                  </Show>
                </>
              );
            }}
          </For>
        </Show>
      </div>
    </div>
  );
}
