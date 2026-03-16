import type { GraphNode } from './types';

interface AdsrVizProps {
  node: GraphNode;
}

// Matches the engine's bezier_shape() in envelope.rs
function bezierShape(t: number, start: number, end: number, curve: number): number {
  const cp = start + (end - start) * curve;
  const inv = 1.0 - t;
  return inv * inv * start + 2.0 * inv * t * cp + t * t * end;
}

export default function AdsrGraph(props: AdsrVizProps) {
  const W = 180;
  const H = 80;
  const PAD = 8;

  const param = (name: string) => {
    const p = props.node.params.find(p => p.name === name);
    return p ? p.value : 0;
  };

  const points = () => {
    const attack = param('attack');
    const decay = param('decay');
    const sustain = param('sustain');
    const release = param('release');
    const atkCrv = param('atk crv');
    const decCrv = param('dec crv');
    const relCrv = param('rel crv');

    // Normalize time segments to fit the width
    const sustainDur = Math.max(attack, decay, release) * 0.4;
    const total = attack + decay + sustainDur + release;

    const gw = W - PAD * 2;
    const gh = H - PAD * 2;

    const x0 = PAD;
    const y0 = PAD + gh; // bottom (amplitude 0)

    const xA = x0 + (attack / total) * gw;
    const xD = xA + (decay / total) * gw;
    const xS = xD + (sustainDur / total) * gw;
    const xR = xS + (release / total) * gw;

    const yTop = PAD;           // amplitude 1
    const ySus = PAD + (1 - sustain) * gh;

    // Generate path segments with bezier curves
    const steps = 24;
    const pts: [number, number][] = [[x0, y0]];

    // Attack: 0 -> 1
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      const amp = bezierShape(t, 0, 1, atkCrv);
      pts.push([x0 + t * (xA - x0), PAD + (1 - amp) * gh]);
    }

    // Decay: 1 -> sustain
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      const amp = bezierShape(t, 1, sustain, decCrv);
      pts.push([xA + t * (xD - xA), PAD + (1 - amp) * gh]);
    }

    // Release: sustain -> 0
    const relPts: [number, number][] = [];
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      const amp = bezierShape(t, sustain, 0, relCrv);
      relPts.push([xS + t * (xR - xS), PAD + (1 - amp) * gh]);
    }

    // Build SVG path
    const curvePath = 'M ' + pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' L ');
    // Sustain dashed segment
    const susStart: [number, number] = [xD, ySus];
    const susEnd: [number, number] = [xS, ySus];
    const susPath = `M ${susStart[0].toFixed(1)},${susStart[1].toFixed(1)} L ${susEnd[0].toFixed(1)},${susEnd[1].toFixed(1)}`;
    // Release path
    const relPath = `M ${xS.toFixed(1)},${ySus.toFixed(1)} L ` + relPts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' L ');

    // Key dots: start, peak, sustain start, sustain end, end
    const dots: [number, number][] = [
      [x0, y0],
      [xA, yTop],
      [xD, ySus],
      [xS, ySus],
      [xR, y0],
    ];

    return { curvePath, susPath, relPath, dots };
  };

  return (
    <svg
      width={W}
      height={H}
      style={{ display: 'block', 'margin-bottom': '4px', 'pointer-events': 'none' }}
    >
      {/* Background */}
      <rect x="0" y="0" width={W} height={H} rx="3" fill="#0d1525" />
      {/* Grid lines */}
      <line x1={PAD} y1={PAD} x2={W - PAD} y2={PAD} stroke="#1a2a44" stroke-width="0.5" />
      <line x1={PAD} y1={PAD + (H - PAD * 2) / 2} x2={W - PAD} y2={PAD + (H - PAD * 2) / 2} stroke="#1a2a44" stroke-width="0.5" />
      <line x1={PAD} y1={H - PAD} x2={W - PAD} y2={H - PAD} stroke="#1a2a44" stroke-width="0.5" />

      {/* Attack + Decay curve */}
      <path d={points().curvePath} fill="none" stroke="#5ba4cf" stroke-width="1.5" stroke-linejoin="round" />
      {/* Sustain dashed */}
      <path d={points().susPath} fill="none" stroke="#5ba4cf" stroke-width="1.5" stroke-dasharray="4,3" />
      {/* Release curve */}
      <path d={points().relPath} fill="none" stroke="#5ba4cf" stroke-width="1.5" stroke-linejoin="round" />

      {/* Dots at key points */}
      {points().dots.map(([cx, cy]) => (
        <circle cx={cx} cy={cy} r="3" fill="#5ba4cf" />
      ))}
    </svg>
  );
}
