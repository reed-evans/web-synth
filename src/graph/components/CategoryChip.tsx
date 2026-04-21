import { onMount, onCleanup, type JSX } from 'solid-js';
import { categoryInfo, type Category } from '../nodeCategory';

interface CategoryChipProps {
  category: Category;
  open: boolean;
  onToggle: (e: MouseEvent | KeyboardEvent) => void;
  onClose: () => void;
  popoverId: string;
  chipRef?: (el: HTMLButtonElement) => void;
  children?: JSX.Element;
}

export default function CategoryChip(props: CategoryChipProps) {
  const info = categoryInfo(props.category);
  let btn: HTMLButtonElement | undefined;

  onMount(() => {
    if (btn && props.chipRef) props.chipRef(btn);
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && props.open) {
        props.onClose();
      }
    };
    window.addEventListener('keydown', handleKey);
    onCleanup(() => window.removeEventListener('keydown', handleKey));
  });

  return (
    <button
      ref={el => (btn = el)}
      class="cat-chip"
      type="button"
      aria-expanded={props.open}
      aria-controls={props.popoverId}
      data-open={props.open ? 'true' : 'false'}
      style={{ '--cat-color': `var(${info.cssVar})` }}
      onClick={(e) => {
        e.stopPropagation();
        props.onToggle(e);
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          props.onToggle(e);
        }
      }}
    >
      {info.label}
      {props.children}
    </button>
  );
}
