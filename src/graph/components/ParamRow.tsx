import type { ParamDef } from '../types';

interface ParamRowProps {
  param: ParamDef;
  modulated: boolean;
  modActive: boolean;
  onInput: (value: number) => void;
  onToggleAddMod: () => void;
}

function formatValue(p: ParamDef): string {
  const v = p.value;
  if (p.step >= 1) return Math.round(v).toString();
  if (Math.abs(v) >= 100) return v.toFixed(0);
  if (Math.abs(v) >= 10) return v.toFixed(1);
  return v.toFixed(2);
}

export default function ParamRow(props: ParamRowProps) {
  return (
    <div class="param-row">
      <span class="param-row__label">{props.param.name}</span>
      <input
        class="param-slider"
        type="range"
        min={props.param.min}
        max={props.param.max}
        step={props.param.step}
        value={props.param.value}
        data-modulated={props.modulated ? 'true' : 'false'}
        aria-label={`${props.param.name} parameter`}
        onInput={(e) => props.onInput(parseFloat(e.currentTarget.value))}
      />
      <span class="param-row__value">{formatValue(props.param)}</span>
      <button
        type="button"
        class="param-row__mod-btn"
        data-active={props.modActive ? 'true' : 'false'}
        aria-pressed={props.modActive}
        onClick={props.onToggleAddMod}
      >
        +mod
      </button>
    </div>
  );
}
