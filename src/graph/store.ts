import { createStore, produce } from 'solid-js/store';
import { createSignal } from 'solid-js';
import type { GraphNode, Edge, NodeTemplate, PendingEdge, ModRoute } from './types';
import { NODE_WIDTH } from './types';
import type { AudioState } from '../audio';

let nextId = 1;
const genId = () => String(nextId++);

export interface GraphData {
  nodes: GraphNode[];
  edges: Edge[];
  modRoutes: ModRoute[];
}

export function createGraphStore(audio: AudioState) {
  const [graph, setGraph] = createStore<GraphData>({ nodes: [], edges: [], modRoutes: [] });
  const [selectedNodeId, setSelectedNodeId] = createSignal<string | null>(null);
  const [pendingEdge, setPendingEdge] = createSignal<PendingEdge | null>(null);

  const actions = {
    addNode(template: NodeTemplate, x: number, y: number) {
      const id = genId();

      const node: GraphNode = {
        id,
        typeId: template.typeId,
        type: template.type,
        label: template.label,
        x, y,
        width: NODE_WIDTH,
        inputs: template.inputs.map(inp => ({
          id: genId(), name: inp.name, type: 'input' as const,
          dataType: inp.dataType, index: inp.index,
        })),
        outputs: template.outputs.map(out => ({
          id: genId(), name: out.name, type: 'output' as const,
          dataType: out.dataType, index: out.index,
        })),
        color: template.color,
        data: {},
        params: template.params.map(p => ({
          paramId: p.paramId, name: p.name,
          value: p.defaultValue, min: p.min, max: p.max, step: p.step,
        })),
      };

      // Send to worklet
      audio.send({ type: 'add_node', uiId: id, typeId: template.typeId, x, y });

      for (const p of node.params) {
        audio.send({ type: 'set_param', uiId: id, paramId: p.paramId, value: p.value });
      }

      if (template.type === 'output') {
        audio.send({ type: 'set_output', uiId: id });
      }

      setGraph('nodes', n => [...n, node]);
    },

    moveNode(id: string, x: number, y: number) {
      setGraph(produce(g => {
        const node = g.nodes.find(n => n.id === id);
        if (node) { node.x = x; node.y = y; }
      }));
    },

    addEdge(fromNodeId: string, fromPortId: string, toNodeId: string, toPortId: string) {
      const duplicate = graph.edges.some(e =>
        e.from.nodeId === fromNodeId && e.from.portId === fromPortId &&
        e.to.nodeId === toNodeId && e.to.portId === toPortId
      );
      if (duplicate) return;

      const srcNode = graph.nodes.find(n => n.id === fromNodeId);
      const dstNode = graph.nodes.find(n => n.id === toNodeId);
      const srcPort = srcNode?.outputs.find(p => p.id === fromPortId);
      const dstPort = dstNode?.inputs.find(p => p.id === toPortId);
      if (!srcNode || !dstNode || !srcPort || !dstPort) return;

      audio.send({
        type: 'connect',
        srcUiId: fromNodeId, srcPort: srcPort.index,
        dstUiId: toNodeId, dstPort: dstPort.index,
      });

      setGraph('edges', e => [...e, {
        id: genId(),
        from: { nodeId: fromNodeId, portId: fromPortId },
        to: { nodeId: toNodeId, portId: toPortId },
      }]);
    },

    removeNode(id: string) {
      // Disconnect all edges touching this node
      for (const edge of graph.edges) {
        if (edge.from.nodeId === id || edge.to.nodeId === id) {
          const srcNode = graph.nodes.find(n => n.id === edge.from.nodeId);
          const dstNode = graph.nodes.find(n => n.id === edge.to.nodeId);
          const srcPort = srcNode?.outputs.find(p => p.id === edge.from.portId);
          const dstPort = dstNode?.inputs.find(p => p.id === edge.to.portId);
          if (srcNode && dstNode && srcPort && dstPort) {
            audio.send({
              type: 'disconnect',
              srcUiId: srcNode.id, srcPort: srcPort.index,
              dstUiId: dstNode.id, dstPort: dstPort.index,
            });
          }
        }
      }

      // Remove mod routes touching this node
      for (const route of graph.modRoutes) {
        if (route.sourceNodeId === id || route.destNodeId === id) {
          audio.send({ type: 'remove_mod_route', routeId: route.id });
        }
      }

      audio.send({ type: 'remove_node', uiId: id });

      setGraph(produce(g => {
        g.modRoutes = g.modRoutes.filter(m => m.sourceNodeId !== id && m.destNodeId !== id);
        g.edges = g.edges.filter(e => e.from.nodeId !== id && e.to.nodeId !== id);
        g.nodes = g.nodes.filter(n => n.id !== id);
      }));
    },

    removeEdgeByInput(toNodeId: string, toPortId: string) {
      const edge = graph.edges.find(e => e.to.nodeId === toNodeId && e.to.portId === toPortId);
      if (!edge) return;

      const srcNode = graph.nodes.find(n => n.id === edge.from.nodeId);
      const dstNode = graph.nodes.find(n => n.id === edge.to.nodeId);
      const srcPort = srcNode?.outputs.find(p => p.id === edge.from.portId);
      const dstPort = dstNode?.inputs.find(p => p.id === edge.to.portId);
      if (srcNode && dstNode && srcPort && dstPort) {
        audio.send({
          type: 'disconnect',
          srcUiId: srcNode.id, srcPort: srcPort.index,
          dstUiId: dstNode.id, dstPort: dstPort.index,
        });
      }

      setGraph('edges', e => e.filter(e => e.to.nodeId !== toNodeId || e.to.portId !== toPortId));
    },

    setParam(nodeId: string, paramId: number, value: number) {
      audio.send({ type: 'set_param', uiId: nodeId, paramId, value });
      setGraph(produce(g => {
        const n = g.nodes.find(n => n.id === nodeId);
        const p = n?.params.find(p => p.paramId === paramId);
        if (p) p.value = value;
      }));
    },

    addModRoute(sourceNodeId: string, sourcePort: number, destNodeId: string, destParam: number, depth: number) {
      const id = genId();
      audio.send({
        type: 'add_mod_route',
        routeId: id,
        srcUiId: sourceNodeId, srcPort: sourcePort,
        dstUiId: destNodeId, dstParam: destParam,
        depth,
      });
      const route: ModRoute = { id, sourceNodeId, sourcePort, destNodeId, destParam, depth };
      setGraph('modRoutes', r => [...r, route]);
      return id;
    },

    removeModRoute(routeId: string) {
      audio.send({ type: 'remove_mod_route', routeId });
      setGraph('modRoutes', r => r.filter(m => m.id !== routeId));
    },

    setModDepth(routeId: string, depth: number) {
      audio.send({ type: 'set_mod_depth', routeId, depth });
      setGraph(produce(g => {
        const r = g.modRoutes.find(m => m.id === routeId);
        if (r) r.depth = depth;
      }));
    },
  };

  return { graph, selectedNodeId, setSelectedNodeId, pendingEdge, setPendingEdge, actions };
}
