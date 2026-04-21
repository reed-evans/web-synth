import type { GraphNode, Edge, PendingEdge } from './types';
import { getPortPosition } from './types';
import { categoryForType } from './nodeCategory';

const VERT = `
  attribute vec2 a_pos;
  attribute vec4 a_col;
  attribute float a_side;
  uniform vec2 u_res;
  varying vec4 v_col;
  varying float v_side;
  void main() {
    vec2 c = (a_pos / u_res) * 2.0 - 1.0;
    gl_Position = vec4(c.x, -c.y, 0.0, 1.0);
    v_col = a_col;
    v_side = a_side;
  }
`;

const FRAG = `
  #extension GL_OES_standard_derivatives : enable
  precision mediump float;
  varying vec4 v_col;
  varying float v_side;
  void main() {
    float d = abs(v_side);
    float aa = fwidth(d);
    float alpha = (1.0 - smoothstep(1.0 - aa, 1.0, d)) * v_col.a;
    if (alpha <= 0.0) discard;
    gl_FragColor = vec4(v_col.rgb * alpha, alpha);
  }
`;

// Per-vertex layout: x, y, r, g, b, a, side (-1 or +1 across cord width)
const FLOATS_PER_VERT = 7;
const STRIDE = FLOATS_PER_VERT * 4;
const BEZIER_SEGS = 48;
const CORD_THICKNESS = 3.5;
const PENDING_ALPHA = 0.6;

interface BezierOpts {
  x1: number; y1: number; x2: number; y2: number;
  r: number; g: number; b: number; a: number;
  thickness: number;
}

function pushBezier(v: number[], opts: BezierOpts) {
  const { x1, y1, x2, y2, r, g, b, a, thickness } = opts;
  const off = Math.max(Math.abs(y2 - y1) * 0.5, 40);
  const cp1x = x1, cp1y = y1 + off;
  const cp2x = x2, cp2y = y2 - off;
  const half = thickness * 0.5;

  const lx: number[] = [], ly: number[] = [];
  const rx: number[] = [], ry: number[] = [];

  for (let i = 0; i <= BEZIER_SEGS; i++) {
    const t = i / BEZIER_SEGS, mt = 1 - t;
    const mt2 = mt * mt, t2 = t * t;
    const px = mt2 * mt * x1 + 3 * mt2 * t * cp1x + 3 * mt * t2 * cp2x + t2 * t * x2;
    const py = mt2 * mt * y1 + 3 * mt2 * t * cp1y + 3 * mt * t2 * cp2y + t2 * t * y2;
    const dx = 3 * mt2 * (cp1x - x1) + 6 * mt * t * (cp2x - cp1x) + 3 * t2 * (x2 - cp2x);
    const dy = 3 * mt2 * (cp1y - y1) + 6 * mt * t * (cp2y - cp1y) + 3 * t2 * (y2 - cp2y);
    const len = Math.sqrt(dx * dx + dy * dy) || 1;
    const nx = -dy / len, ny = dx / len;
    lx.push(px + nx * half); ly.push(py + ny * half);
    rx.push(px - nx * half); ry.push(py - ny * half);
  }

  for (let i = 0; i < BEZIER_SEGS; i++) {
    const plx = lx[i], ply = ly[i], prx = rx[i], pry = ry[i];
    const qlx = lx[i + 1], qly = ly[i + 1], qrx = rx[i + 1], qry = ry[i + 1];
    v.push(
      plx, ply, r, g, b, a,  1,
      prx, pry, r, g, b, a, -1,
      qlx, qly, r, g, b, a,  1,
      qlx, qly, r, g, b, a,  1,
      prx, pry, r, g, b, a, -1,
      qrx, qry, r, g, b, a, -1,
    );
  }
}

function compileShader(gl: WebGLRenderingContext, type: number, source: string): WebGLShader {
  const sh = gl.createShader(type)!;
  gl.shaderSource(sh, source);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(sh);
    gl.deleteShader(sh);
    throw new Error(`shader compile failed: ${log}`);
  }
  return sh;
}

function linkProgram(gl: WebGLRenderingContext, vs: WebGLShader, fs: WebGLShader): WebGLProgram {
  const p = gl.createProgram()!;
  gl.attachShader(p, vs);
  gl.attachShader(p, fs);
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
    const log = gl.getProgramInfoLog(p);
    gl.deleteProgram(p);
    throw new Error(`program link failed: ${log}`);
  }
  return p;
}

export interface RendererOptions {
  /** Kept for API compatibility; no motion is currently emitted. */
  reducedMotion?: boolean;
}

export class EdgeRenderer {
  private gl: WebGLRenderingContext;
  private program: WebGLProgram;
  private buffer: WebGLBuffer;
  private posLoc: number;
  private colLoc: number;
  private sideLoc: number;
  private resLoc: WebGLUniformLocation;
  private dpr: number;

  constructor(canvas: HTMLCanvasElement, dpr = 1, _options: RendererOptions = {}) {
    const gl = canvas.getContext('webgl', { antialias: true, alpha: true, premultipliedAlpha: true });
    if (!gl) throw new Error('WebGL is not available in this browser');
    this.gl = gl;
    this.dpr = dpr;

    gl.getExtension('OES_standard_derivatives');

    const vs = compileShader(gl, gl.VERTEX_SHADER, VERT);
    const fs = compileShader(gl, gl.FRAGMENT_SHADER, FRAG);
    this.program = linkProgram(gl, vs, fs);

    this.posLoc = gl.getAttribLocation(this.program, 'a_pos');
    this.colLoc = gl.getAttribLocation(this.program, 'a_col');
    this.sideLoc = gl.getAttribLocation(this.program, 'a_side');
    this.resLoc = gl.getUniformLocation(this.program, 'u_res')!;
    this.buffer = gl.createBuffer()!;

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
  }

  // No-op, retained for API compatibility with the canvas' media-query listener.
  setReducedMotion(_value: boolean) { /* intentionally empty */ }

  render(nodes: GraphNode[], edges: Edge[], pendingEdge: PendingEdge | null) {
    const gl = this.gl;
    const w = gl.canvas.width, h = gl.canvas.height;
    gl.viewport(0, 0, w, h);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(this.program);
    gl.uniform2f(this.resLoc, w / this.dpr, h / this.dpr);

    const nodeById = new Map(nodes.map(n => [n.id, n]));
    const v: number[] = [];

    for (const edge of edges) {
      const fn = nodeById.get(edge.from.nodeId);
      const tn = nodeById.get(edge.to.nodeId);
      if (!fn || !tn) continue;
      const fp = getPortPosition(fn, edge.from.portId);
      const tp = getPortPosition(tn, edge.to.portId);
      const [r, g, b] = categoryForType(fn.type).rgb;
      pushBezier(v, { x1: fp.x, y1: fp.y, x2: tp.x, y2: tp.y, r, g, b, a: 1.0, thickness: CORD_THICKNESS });
    }

    if (pendingEdge) {
      const fn = nodeById.get(pendingEdge.fromNodeId);
      if (fn) {
        const fp = getPortPosition(fn, pendingEdge.fromPortId);
        const [r, g, b] = categoryForType(fn.type).rgb;
        pushBezier(v, {
          x1: fp.x, y1: fp.y, x2: pendingEdge.toX, y2: pendingEdge.toY,
          r, g, b, a: PENDING_ALPHA, thickness: CORD_THICKNESS,
        });
      }
    }

    if (v.length === 0) return;

    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(v), gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(this.posLoc);
    gl.vertexAttribPointer(this.posLoc, 2, gl.FLOAT, false, STRIDE, 0);
    gl.enableVertexAttribArray(this.colLoc);
    gl.vertexAttribPointer(this.colLoc, 4, gl.FLOAT, false, STRIDE, 8);
    gl.enableVertexAttribArray(this.sideLoc);
    gl.vertexAttribPointer(this.sideLoc, 1, gl.FLOAT, false, STRIDE, 24);
    gl.drawArrays(gl.TRIANGLES, 0, v.length / FLOATS_PER_VERT);
  }
}
