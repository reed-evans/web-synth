export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
}

export function onReducedMotionChange(cb: (value: boolean) => void): () => void {
  if (typeof window === 'undefined') return () => { /* noop */ };
  const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
  const listener = (e: MediaQueryListEvent) => cb(e.matches);
  mq.addEventListener?.('change', listener);
  return () => mq.removeEventListener?.('change', listener);
}
