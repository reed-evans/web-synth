import { createMemo, For } from 'solid-js';
import type { GraphNode } from './types';

interface AdsrVizProps {
  node: GraphNode;
}

const W = 232;
const H = 92;
const PAD = 10;
const STEPS = 24;

// Matches the engine's bezier_shape() in envelope.rs
function bezierShape(t: number, start: number, end: number, curve: number): number {
  const cp = start + (end - start) * curve;
  const inv = 1.0 - t;
  return inv * inv * start + 2.0 * inv * t * cp + t * t * end;
}

function toPath(pts: ReadonlyArray<readonly [number, number]>): string {
  return 'M ' + pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' L ');
}

export default function AdsrGraph(props: AdsrVizProps) {
  const param = (name: string): number =>
    props.node.params.find(p => p.name === name)?.value ?? 0;

  const geometry = createMemo(() => {
    const attack  = param('attack');
    const decay   = param('decay');
    const sustain = param('sustain');
    const release = param('release');
    const atkCrv  = param('atk crv');
    const decCrv  = param('dec crv');
    const relCrv  = param('rel crv');

    const sustainDur = Math.max(attack, decay, release) * 0.4;
    const total = attack + decay + sustainDur + release;

    const gw = W - PAD * 2;
    const gh = H - PAD * 2;

    const x0 = PAD;
    const y0 = PAD + gh;
    const xA = x0 + (attack / total) * gw;
    const xD = xA + (decay / total) * gw;
    const xS = xD + (sustainDur / total) * gw;
    const xR = xS + (release / total) * gw;
    const yTop = PAD;
    const ySus = PAD + (1 - sustain) * gh;

    const sampleCurve = (
      fromX: number, toX: number, fromAmp: number, toAmp: number, curve: number,
    ): Array<[number, number]> => {
      const out: Array<[number, number]> = [];
      for (let i = 1; i <= STEPS; i++) {
        const t = i / STEPS;
        const amp = bezierShape(t, fromAmp, toAmp, curve);
        out.push([fromX + t * (toX - fromX), PAD + (1 - amp) * gh]);
      }
      return out;
    };

    const ad = [[x0, y0] as [number, number],
      ...sampleCurve(x0, xA, 0, 1, atkCrv),
      ...sampleCurve(xA, xD, 1, sustain, decCrv),
    ];

    const rel: Array<[number, number]> = [
      [xS, ySus],
      ...sampleCurve(xS, xR, sustain, 0, relCrv),
    ];

    const dots: Array<[number, number]> = [
      [x0, y0], [xA, yTop], [xD, ySus], [xS, ySus], [xR, y0],
    ];

    return {
      curvePath: toPath(ad),
      susPath: `M ${xD.toFixed(1)},${ySus.toFixed(1)} L ${xS.toFixed(1)},${ySus.toFixed(1)}`,
      relPath: toPath(rel),
      dots,
    };
  });

  const midY = PAD + (H - PAD * 2) / 2;

  return (
    <svg class="adsr-graph" width={W} height={H}>
      <rect
        x="0.5" y="0.5"
        width={W - 1} height={H - 1}
        rx="4"
        fill="var(--color-surface-recess)"
        stroke="var(--color-border)"
        stroke-width="1"
      />
      <line
        x1={PAD} y1={midY} x2={W - PAD} y2={midY}
        stroke="var(--color-border)" stroke-width="1" stroke-dasharray="1 3"
      />
      <path
        d={geometry().curvePath}
        fill="none" stroke="var(--cat-mod)" stroke-width="1.5"
        stroke-linejoin="round" stroke-linecap="round"
      />
      <path
        d={geometry().susPath}
        fill="none" stroke="var(--cat-mod)" stroke-width="1.5"
        stroke-dasharray="3 3" stroke-linecap="round" opacity="0.6"
      />
      <path
        d={geometry().relPath}
        fill="none" stroke="var(--cat-mod)" stroke-width="1.5"
        stroke-linejoin="round" stroke-linecap="round"
      />
      <For each={geometry().dots}>
        {([cx, cy]) => (
          <circle
            cx={cx} cy={cy} r="2.5"
            fill="var(--color-surface)" stroke="var(--cat-mod)" stroke-width="1.25"
          />
        )}
      </For>
    </svg>
  );
}
