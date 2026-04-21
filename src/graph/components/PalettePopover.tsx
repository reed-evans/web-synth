import { For, onMount, onCleanup } from 'solid-js';
import type { NodeTemplate } from '../types';
import { categoryInfo, type Category } from '../nodeCategory';

interface PalettePopoverProps {
  id: string;
  category: Category;
  templates: NodeTemplate[];
  anchor: HTMLElement | null;
  onPick: (template: NodeTemplate) => void;
  onClose: () => void;
}

export default function PalettePopover(props: PalettePopoverProps) {
  let ref: HTMLDivElement | undefined;

  const positionStyle = () => {
    const a = props.anchor;
    if (!a) return { display: 'none' } as const;
    const r = a.getBoundingClientRect();
    return {
      left: r.left + 'px',
      top: (r.bottom + 6) + 'px',
    } as const;
  };

  onMount(() => {
    const onDocClick = (e: MouseEvent) => {
      if (!ref) return;
      if (props.anchor?.contains(e.target as Node)) return;
      if (!ref.contains(e.target as Node)) props.onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') props.onClose();
    };
    // next tick — don't close on the same click that opened us
    const t = setTimeout(() => {
      document.addEventListener('mousedown', onDocClick);
    }, 0);
    document.addEventListener('keydown', onKey);
    onCleanup(() => {
      clearTimeout(t);
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
    });
  });

  const info = categoryInfo(props.category);

  return (
    <div
      ref={el => (ref = el)}
      id={props.id}
      class="palette-popover"
      role="menu"
      style={{
        position: 'fixed',
        ...positionStyle(),
      }}
    >
      <div class="palette-heading">{info.label}</div>
      <For each={props.templates}>
        {(t) => (
          <button
            class="palette-row"
            type="button"
            role="menuitem"
            onClick={() => props.onPick(t)}
          >
            <span
              class="palette-row__dot"
              style={{ '--cat-color': `var(${info.cssVar})` }}
            />
            <span class="palette-row__name">{t.label}</span>
          </button>
        )}
      </For>
    </div>
  );
}
