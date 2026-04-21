/**
 * QWERTY piano mapping — bottom row `a..k` is C4..C5.
 */
export const PIANO_KEYMAP: Readonly<Record<string, number>> = Object.freeze({
  a: 60, w: 61, s: 62, e: 63, d: 64, f: 65,
  t: 66, g: 67, y: 68, h: 69, u: 70, j: 71, k: 72,
});

export function midiForKey(key: string): number | undefined {
  return PIANO_KEYMAP[key.toLowerCase()];
}
