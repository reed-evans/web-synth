export type Category = 'OSC' | 'MOD' | 'FILTER' | 'UTIL' | 'FX' | 'SAMPLER';

export interface CategoryInfo {
  category: Category;
  cssVar: string;
  /** Linear 0–1 sRGB triplet, used by the WebGL edge renderer. */
  rgb: [number, number, number];
  label: string;
}

/**
 * Category definitions — single source of truth for palette + labels.
 *
 * `rgb` tuples MUST track the `--cat-*` oklch values in `src/styles/tokens.css`.
 * Light and dark themes currently share one palette, so there is only one
 * tuple per category. If the themes diverge, add a second map and swap based
 * on the current `data-theme` attribute.
 */
const CATEGORIES: Record<Category, CategoryInfo> = {
  OSC:     { category: 'OSC',     cssVar: '--cat-osc',     label: 'OSC',     rgb: [0.57, 0.77, 0.65] },
  MOD:     { category: 'MOD',     cssVar: '--cat-mod',     label: 'MOD',     rgb: [0.82, 0.77, 0.56] },
  FILTER:  { category: 'FILTER',  cssVar: '--cat-filter',  label: 'FILTER',  rgb: [0.72, 0.71, 0.92] },
  UTIL:    { category: 'UTIL',    cssVar: '--cat-util',    label: 'UTIL',    rgb: [0.58, 0.72, 0.92] },
  FX:      { category: 'FX',      cssVar: '--cat-fx',      label: 'FX',      rgb: [0.55, 0.81, 0.88] },
  SAMPLER: { category: 'SAMPLER', cssVar: '--cat-sampler', label: 'SAMPLER', rgb: [0.91, 0.73, 0.58] },
};

const TYPE_TO_CATEGORY: Record<string, Category> = {
  sine_osc: 'OSC',
  saw_osc: 'OSC',
  square_osc: 'OSC',
  triangle_osc: 'OSC',
  phase_osc: 'OSC',

  adsr_env: 'MOD',
  lfo: 'MOD',
  transport: 'MOD',

  lowpass: 'FILTER',
  highpass: 'FILTER',
  bandpass: 'FILTER',
  notch: 'FILTER',

  gain: 'UTIL',
  pan: 'UTIL',
  mixer: 'UTIL',
  output: 'UTIL',

  delay: 'FX',
  reverb: 'FX',

  audio_player: 'SAMPLER',
};

export function categoryForType(type: string): CategoryInfo {
  return CATEGORIES[TYPE_TO_CATEGORY[type] ?? 'UTIL'];
}

export function categoryInfo(cat: Category): CategoryInfo {
  return CATEGORIES[cat];
}

export function allCategories(): Category[] {
  return Object.keys(CATEGORIES) as Category[];
}
