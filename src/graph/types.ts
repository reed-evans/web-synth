export interface Port {
  id: string;
  name: string;
  type: 'input' | 'output';
  dataType: string;
  index: number; // engine port index
}

export interface ParamDef {
  paramId: number; // engine param ID
  name: string;
  value: number;
  min: number;
  max: number;
  step: number;
}

export interface GraphNode {
  id: string;
  typeId: number; // engine type ID
  type: string;
  label: string;
  x: number;
  y: number;
  width: number;
  inputs: Port[];
  outputs: Port[];
  color: [number, number, number];
  params: ParamDef[];
}

export interface Edge {
  id: string;
  from: { nodeId: string; portId: string };
  to: { nodeId: string; portId: string };
}

export interface PortTemplate {
  name: string;
  dataType: string;
  index: number;
}

export interface ParamTemplate {
  paramId: number;
  name: string;
  defaultValue: number;
  min: number;
  max: number;
  step: number;
}

export interface NodeTemplate {
  type: string;
  label: string;
  typeId: number;
  inputs: PortTemplate[];
  outputs: PortTemplate[];
  color: [number, number, number];
  params: ParamTemplate[];
}

export interface ModRoute {
  id: string;
  sourceNodeId: string;
  sourcePort: number;
  destNodeId: string;
  destParam: number;
  depth: number;
}

export interface PendingEdge {
  fromNodeId: string;
  fromPortId: string;
  toX: number;
  toY: number;
}

export const NODE_WIDTH = 160;
export const NODE_HEIGHT = 64;
export const PORT_RADIUS = 4;

/** Evenly spaces ports across the full node width. */
export function portX(index: number, count: number, width = NODE_WIDTH): number {
  return (index + 1) * width / (count + 1);
}

export function getPortPosition(node: GraphNode, portId: string): { x: number; y: number } {
  const ii = node.inputs.findIndex(p => p.id === portId);
  if (ii >= 0) {
    return { x: node.x + portX(ii, node.inputs.length, node.width), y: node.y };
  }
  const oi = node.outputs.findIndex(p => p.id === portId);
  return { x: node.x + portX(oi, node.outputs.length, node.width), y: node.y + NODE_HEIGHT };
}
