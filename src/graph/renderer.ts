import type { GraphNode, Edge, PendingEdge } from './types';
import { getPortPosition } from './types';

const VERT = `
  attribute vec2 a_pos;
  attribute vec4 a_col;
  attribute float a_dist;
  uniform vec2 u_res;
  varying vec4 v_col;
  varying float v_dist;
  void main() {
    vec2 c = (a_pos / u_res) * 2.0 - 1.0;
    gl_Position = vec4(c.x, -c.y, 0.0, 1.0);
    v_col = a_col;
    v_dist = a_dist;
  }
`;

const FRAG = `
  precision mediump float;
  varying vec4 v_col;
  varying float v_dist;
  uniform float u_time;
  void main() {
    float wave = sin(v_dist * 0.35 - u_time * 3.5);
    float stripe = smoothstep(-0.15, 0.15, wave);
    gl_FragColor = mix(v_col * 0.55, v_col, stripe);
  }
`;

// 7 floats per vertex: x, y, r, g, b, a, dist
const FLOATS_PER_VERT = 7;
const STRIDE = FLOATS_PER_VERT * 4; // 28 bytes

function pushLine(
  v: number[],
  x1: number, y1: number, x2: number, y2: number,
  thick: number,
  r: number, g: number, b: number, a: number,
  d1: number, d2: number,
) {
  const dx = x2 - x1, dy = y2 - y1;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len === 0) return;
  const nx = (-dy / len) * thick * 0.5, ny = (dx / len) * thick * 0.5;
  v.push(
    x1 + nx, y1 + ny, r, g, b, a, d1,
    x1 - nx, y1 - ny, r, g, b, a, d1,
    x2 + nx, y2 + ny, r, g, b, a, d2,
    x2 + nx, y2 + ny, r, g, b, a, d2,
    x1 - nx, y1 - ny, r, g, b, a, d1,
    x2 - nx, y2 - ny, r, g, b, a, d2,
  );
}

function pushBezier(
  v: number[],
  x1: number, y1: number, x2: number, y2: number,
  thick: number,
  r: number, g: number, b: number, a: number,
) {
  const segs = 24;
  const off = Math.max(Math.abs(y2 - y1) * 0.5, 50);
  const cp1x = x1, cp1y = y1 + off, cp2x = x2, cp2y = y2 - off;
  let px = x1, py = y1;
  let dist = 0;
  for (let i = 1; i <= segs; i++) {
    const t = i / segs, mt = 1 - t;
    const mt2 = mt * mt, mt3 = mt2 * mt, t2 = t * t, t3 = t2 * t;
    const nx = mt3 * x1 + 3 * mt2 * t * cp1x + 3 * mt * t2 * cp2x + t3 * x2;
    const ny = mt3 * y1 + 3 * mt2 * t * cp1y + 3 * mt * t2 * cp2y + t3 * y2;
    const segLen = Math.sqrt((nx - px) ** 2 + (ny - py) ** 2);
    pushLine(v, px, py, nx, ny, thick, r, g, b, a, dist, dist + segLen);
    dist += segLen;
    px = nx; py = ny;
  }
}

export class EdgeRenderer {
  private gl: WebGLRenderingContext;
  private program: WebGLProgram;
  private buffer: WebGLBuffer;
  private posLoc: number;
  private colLoc: number;
  private distLoc: number;
  private resLoc: WebGLUniformLocation;
  private timeLoc: WebGLUniformLocation;
  private dpr: number;

  constructor(canvas: HTMLCanvasElement, dpr = 1) {
    const gl = canvas.getContext('webgl', { antialias: true, alpha: true })!;
    this.gl = gl;
    this.dpr = dpr;

    const vs = gl.createShader(gl.VERTEX_SHADER)!;
    gl.shaderSource(vs, VERT);
    gl.compileShader(vs);

    const fs = gl.createShader(gl.FRAGMENT_SHADER)!;
    gl.shaderSource(fs, FRAG);
    gl.compileShader(fs);

    this.program = gl.createProgram()!;
    gl.attachShader(this.program, vs);
    gl.attachShader(this.program, fs);
    gl.linkProgram(this.program);

    this.posLoc = gl.getAttribLocation(this.program, 'a_pos');
    this.colLoc = gl.getAttribLocation(this.program, 'a_col');
    this.distLoc = gl.getAttribLocation(this.program, 'a_dist');
    this.resLoc = gl.getUniformLocation(this.program, 'u_res')!;
    this.timeLoc = gl.getUniformLocation(this.program, 'u_time')!;
    this.buffer = gl.createBuffer()!;

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  }

  render(nodes: GraphNode[], edges: Edge[], pendingEdge: PendingEdge | null) {
    const gl = this.gl;
    const w = gl.canvas.width, h = gl.canvas.height;
    gl.viewport(0, 0, w, h);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(this.program);
    gl.uniform2f(this.resLoc, w / this.dpr, h / this.dpr);
    gl.uniform1f(this.timeLoc, performance.now() / 1000);

    const v: number[] = [];

    for (const edge of edges) {
      const fn = nodes.find(n => n.id === edge.from.nodeId);
      const tn = nodes.find(n => n.id === edge.to.nodeId);
      if (!fn || !tn) continue;
      const fp = getPortPosition(fn, edge.from.portId);
      const tp = getPortPosition(tn, edge.to.portId);
      pushBezier(v, fp.x, fp.y, tp.x, tp.y, 2.5, 0.7, 0.75, 0.85, 0.85);
    }

    if (pendingEdge) {
      const fn = nodes.find(n => n.id === pendingEdge.fromNodeId);
      if (fn) {
        const fp = getPortPosition(fn, pendingEdge.fromPortId);
        pushBezier(v, fp.x, fp.y, pendingEdge.toX, pendingEdge.toY, 2, 0.7, 0.75, 0.85, 0.4);
      }
    }

    if (v.length === 0) return;

    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(v), gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(this.posLoc);
    gl.vertexAttribPointer(this.posLoc, 2, gl.FLOAT, false, STRIDE, 0);
    gl.enableVertexAttribArray(this.colLoc);
    gl.vertexAttribPointer(this.colLoc, 4, gl.FLOAT, false, STRIDE, 8);
    gl.enableVertexAttribArray(this.distLoc);
    gl.vertexAttribPointer(this.distLoc, 1, gl.FLOAT, false, STRIDE, 24);
    gl.drawArrays(gl.TRIANGLES, 0, v.length / FLOATS_PER_VERT);
  }
}
