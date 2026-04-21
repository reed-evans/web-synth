import { createStore, produce } from 'solid-js/store';
import { createSignal } from 'solid-js';
import type { GraphNode, Edge, NodeTemplate, PendingEdge, ModRoute, Port } from './types';
import { NODE_WIDTH } from './types';
import type { AudioState } from '../audio';
import { sendCommand } from './commands';

export interface GraphData {
  nodes: GraphNode[];
  edges: Edge[];
  modRoutes: ModRoute[];
}

function createIdGenerator(): () => string {
  let n = 1;
  return () => String(n++);
}

function instantiate(template: NodeTemplate, id: string, genId: () => string, x: number, y: number): GraphNode {
  const mapPorts = (defs: NodeTemplate['inputs'], type: Port['type']): Port[] =>
    defs.map(p => ({ id: genId(), name: p.name, type, dataType: p.dataType, index: p.index }));

  return {
    id,
    typeId: template.typeId,
    type: template.type,
    label: template.label,
    x, y,
    width: NODE_WIDTH,
    inputs: mapPorts(template.inputs, 'input'),
    outputs: mapPorts(template.outputs, 'output'),
    color: template.color,
    params: template.params.map(p => ({
      paramId: p.paramId,
      name: p.name,
      value: p.defaultValue,
      min: p.min,
      max: p.max,
      step: p.step,
    })),
  };
}

export function createGraphStore(audio: AudioState) {
  const [graph, setGraph] = createStore<GraphData>({ nodes: [], edges: [], modRoutes: [] });
  const [selectedNodeId, setSelectedNodeId] = createSignal<string | null>(null);
  const [pendingEdge, setPendingEdge] = createSignal<PendingEdge | null>(null);

  const genId = createIdGenerator();
  const send = (cmd: Parameters<typeof sendCommand>[1]) => sendCommand(audio, cmd);

  const findEdgeEndpoints = (edge: Edge) => {
    const srcNode = graph.nodes.find(n => n.id === edge.from.nodeId);
    const dstNode = graph.nodes.find(n => n.id === edge.to.nodeId);
    const srcPort = srcNode?.outputs.find(p => p.id === edge.from.portId);
    const dstPort = dstNode?.inputs.find(p => p.id === edge.to.portId);
    if (!srcNode || !dstNode || !srcPort || !dstPort) return null;
    return { srcNode, dstNode, srcPort, dstPort };
  };

  const disconnectEdge = (edge: Edge) => {
    const ends = findEdgeEndpoints(edge);
    if (!ends) return;
    send({
      type: 'disconnect',
      srcUiId: ends.srcNode.id, srcPort: ends.srcPort.index,
      dstUiId: ends.dstNode.id, dstPort: ends.dstPort.index,
    });
  };

  const actions = {
    addNode(template: NodeTemplate, x: number, y: number) {
      const id = genId();
      const node = instantiate(template, id, genId, x, y);

      send({ type: 'add_node', uiId: id, typeId: template.typeId, x, y });
      for (const p of node.params) {
        send({ type: 'set_param', uiId: id, paramId: p.paramId, value: p.value });
      }
      if (template.type === 'output') {
        send({ type: 'set_output', uiId: id });
      }

      setGraph('nodes', ns => [...ns, node]);
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

      send({
        type: 'connect',
        srcUiId: fromNodeId, srcPort: srcPort.index,
        dstUiId: toNodeId, dstPort: dstPort.index,
      });

      setGraph('edges', es => [...es, {
        id: genId(),
        from: { nodeId: fromNodeId, portId: fromPortId },
        to: { nodeId: toNodeId, portId: toPortId },
      }]);
    },

    removeNode(id: string) {
      for (const edge of graph.edges) {
        if (edge.from.nodeId === id || edge.to.nodeId === id) disconnectEdge(edge);
      }
      for (const route of graph.modRoutes) {
        if (route.sourceNodeId === id || route.destNodeId === id) {
          send({ type: 'remove_mod_route', routeId: route.id });
        }
      }
      send({ type: 'remove_node', uiId: id });

      setGraph(produce(g => {
        g.modRoutes = g.modRoutes.filter(m => m.sourceNodeId !== id && m.destNodeId !== id);
        g.edges = g.edges.filter(e => e.from.nodeId !== id && e.to.nodeId !== id);
        g.nodes = g.nodes.filter(n => n.id !== id);
      }));
    },

    removeEdgeByInput(toNodeId: string, toPortId: string) {
      const edge = graph.edges.find(e => e.to.nodeId === toNodeId && e.to.portId === toPortId);
      if (!edge) return;
      disconnectEdge(edge);
      setGraph('edges', es => es.filter(e => e.id !== edge.id));
    },

    setParam(nodeId: string, paramId: number, value: number) {
      send({ type: 'set_param', uiId: nodeId, paramId, value });
      setGraph(produce(g => {
        const n = g.nodes.find(n => n.id === nodeId);
        const p = n?.params.find(p => p.paramId === paramId);
        if (p) p.value = value;
      }));
    },

    addModRoute(sourceNodeId: string, sourcePort: number, destNodeId: string, destParam: number, depth: number) {
      const id = genId();
      send({
        type: 'add_mod_route',
        routeId: id,
        srcUiId: sourceNodeId, srcPort: sourcePort,
        dstUiId: destNodeId, dstParam: destParam,
        depth,
      });
      const route: ModRoute = { id, sourceNodeId, sourcePort, destNodeId, destParam, depth };
      setGraph('modRoutes', rs => [...rs, route]);
      return id;
    },

    removeModRoute(routeId: string) {
      send({ type: 'remove_mod_route', routeId });
      setGraph('modRoutes', rs => rs.filter(m => m.id !== routeId));
    },

    setModDepth(routeId: string, depth: number) {
      send({ type: 'set_mod_depth', routeId, depth });
      setGraph(produce(g => {
        const r = g.modRoutes.find(m => m.id === routeId);
        if (r) r.depth = depth;
      }));
    },
  };

  return { graph, selectedNodeId, setSelectedNodeId, pendingEdge, setPendingEdge, actions };
}
