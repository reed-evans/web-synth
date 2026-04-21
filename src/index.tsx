import './styles/reset.css';
import './styles/tokens.css';
import './styles/global.css';

import { render } from 'solid-js/web';
import { createSignal, onMount, Show } from 'solid-js';
import { initAudio, type AudioState } from './audio';
import GraphCanvas from './graph/GraphCanvas';

function App() {
  const [audio, setAudio] = createSignal<AudioState | null>(null);
  const [error, setError] = createSignal<string | null>(null);

  onMount(() => {
    initAudio()
      .then(setAudio)
      .catch(e => setError(e instanceof Error ? e.message : String(e)));
  });

  return (
    <Show
      when={audio()}
      fallback={
        <div class="boot-status">
          {error() ? `Error: ${error()}` : 'Loading audio engine…'}
        </div>
      }
    >
      {(a) => <GraphCanvas audio={a()} />}
    </Show>
  );
}

const mount = document.getElementById('app');
if (!mount) throw new Error('#app mount point missing from index.html');
render(() => <App />, mount);
