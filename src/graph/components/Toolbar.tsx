import { createSignal, For, Show } from "solid-js";
import type { NodeTemplate } from "../types";
import type { Category } from "../nodeCategory";
import { allCategories } from "../nodeCategory";
import CategoryChip from "./CategoryChip";
import PalettePopover from "./PalettePopover";
import "./toolbar.css";

interface ToolbarProps {
  playing: boolean;
  onTogglePlay: () => void;
  theme: "light" | "dark";
  onToggleTheme: () => void;
  templatesByCategory: Record<Category, NodeTemplate[]>;
  onAddNode: (template: NodeTemplate) => void;
}

export default function Toolbar(props: ToolbarProps) {
  const [openCat, setOpenCat] = createSignal<Category | null>(null);
  const chipEls = new Map<Category, HTMLButtonElement>();

  const toggle = (cat: Category) => {
    setOpenCat((prev) => (prev === cat ? null : cat));
  };

  const pick = (t: NodeTemplate) => {
    props.onAddNode(t);
    setOpenCat(null);
  };

  return (
    <header class="toolbar" role="banner">
      <div class="toolbar__row">
        <span class="toolbar__wordmark">hyasynth</span>

        <nav class="cat-rail" aria-label="Add node">
          <For each={allCategories()}>
            {(cat) => (
              <CategoryChip
                category={cat}
                open={openCat() === cat}
                popoverId={`palette-${cat.toLowerCase()}`}
                chipRef={(el) => chipEls.set(cat, el)}
                onToggle={() => toggle(cat)}
                onClose={() => setOpenCat(null)}
              />
            )}
          </For>
        </nav>

        <div class="toolbar__spacer" />

        <div class="kb-hint" aria-hidden="true">
          <span class="kb-hint__group">
            <span class="kb-hint__keys">
              <kbd>A</kbd>
              <span class="kb-hint__sep">–</span>
              <kbd>K</kbd>
            </span>
            play
          </span>
          <span class="kb-hint__group">
            <kbd>del</kbd>
            delete
          </span>
          <span class="kb-hint__group">
            <kbd>→</kbd>
            nudge
          </span>
        </div>

        <button
          class="btn-icon"
          type="button"
          aria-label={
            props.theme === "light"
              ? "Switch to dark theme"
              : "Switch to light theme"
          }
          title={props.theme === "light" ? "Switch to dark" : "Switch to light"}
          onClick={props.onToggleTheme}
        >
          <Show
            when={props.theme === "light"}
            fallback={
              <svg
                viewBox="0 0 14 14"
                width="14"
                height="14"
                aria-hidden="true"
              >
                <circle cx="7" cy="7" r="3" fill="currentColor" />
                <g
                  stroke="currentColor"
                  stroke-width="1.1"
                  stroke-linecap="round"
                >
                  <line x1="7" y1="1.5" x2="7" y2="3" />
                  <line x1="7" y1="11" x2="7" y2="12.5" />
                  <line x1="1.5" y1="7" x2="3" y2="7" />
                  <line x1="11" y1="7" x2="12.5" y2="7" />
                  <line x1="2.9" y1="2.9" x2="3.9" y2="3.9" />
                  <line x1="10.1" y1="10.1" x2="11.1" y2="11.1" />
                  <line x1="2.9" y1="11.1" x2="3.9" y2="10.1" />
                  <line x1="10.1" y1="3.9" x2="11.1" y2="2.9" />
                </g>
              </svg>
            }
          >
            <svg viewBox="0 0 14 14" width="14" height="14" aria-hidden="true">
              <path
                d="M11.5 8.8 A5 5 0 1 1 5.2 2.5 A4 4 0 0 0 11.5 8.8 Z"
                fill="currentColor"
              />
            </svg>
          </Show>
        </button>

        <button
          class="btn-transport"
          type="button"
          aria-pressed={props.playing}
          aria-label={props.playing ? "Stop audio" : "Start audio"}
          data-playing={props.playing ? "true" : "false"}
          onClick={props.onTogglePlay}
        >
          <Show
            when={props.playing}
            fallback={
              <svg
                viewBox="0 0 10 10"
                width="10"
                height="10"
                aria-hidden="true"
              >
                <path d="M2.5 1.5 L9 5 L2.5 8.5 Z" fill="currentColor" />
              </svg>
            }
          >
            <svg viewBox="0 0 10 10" width="10" height="10" aria-hidden="true">
              <rect
                x="2"
                y="2"
                width="2.4"
                height="6"
                rx="0.5"
                fill="currentColor"
              />
              <rect
                x="5.6"
                y="2"
                width="2.4"
                height="6"
                rx="0.5"
                fill="currentColor"
              />
            </svg>
          </Show>
          <span>{props.playing ? "Stop" : "Play"}</span>
        </button>
      </div>

      <Show when={openCat()}>
        {(cat) => (
          <PalettePopover
            id={`palette-${cat().toLowerCase()}`}
            category={cat()}
            templates={props.templatesByCategory[cat()] ?? []}
            anchor={chipEls.get(cat()) ?? null}
            onPick={pick}
            onClose={() => setOpenCat(null)}
          />
        )}
      </Show>
    </header>
  );
}
