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
  typeId: number; // engine type ID (for UI identification)
  type: string;
  label: string;
  x: number;
  y: number;
  width: number;
  inputs: Port[];
  outputs: Port[];
  color: [number, number, number];
  data: Record<string, unknown>;
  params: ParamDef[];
}

export interface Edge {
  id: string;
  from: { nodeId: string; portId: string };
  to: { nodeId: string; portId: string };
}

export interface NodeTemplate {
  type: string;
  label: string;
  typeId: number;
  inputs: { name: string; dataType: string; index: number }[];
  outputs: { name: string; dataType: string; index: number }[];
  color: [number, number, number];
  params: { paramId: number; name: string; defaultValue: number; min: number; max: number; step: number }[];
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

export const NODE_WIDTH = 150;
export const STRIP_HEIGHT = 8;
export const LABEL_HEIGHT = 24;
export const PORT_HEIGHT = 7;
export const PORT_RADIUS = 5;
export const NODE_HEIGHT = STRIP_HEIGHT + LABEL_HEIGHT + STRIP_HEIGHT;

export function getPortPosition(node: GraphNode, portId: string): { x: number; y: number } {
  const ii = node.inputs.findIndex(p => p.id === portId);
  if (ii >= 0) {
    const n = node.inputs.length;
    return { x: node.x + (ii + 1) * node.width / (n + 1), y: node.y };
  }
  const oi = node.outputs.findIndex(p => p.id === portId);
  const n = node.outputs.length;
  return { x: node.x + (oi + 1) * node.width / (n + 1), y: node.y + NODE_HEIGHT };
}
