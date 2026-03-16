import { render } from 'solid-js/web';
import { createSignal, Show } from 'solid-js';
import { initAudio, type AudioState } from './audio';
import GraphCanvas from './graph/GraphCanvas';

function App() {
  const [audio, setAudio] = createSignal<AudioState | null>(null);
  const [error, setError] = createSignal<string | null>(null);

  initAudio()
    .then(a => setAudio(a))
    .catch(e => setError(String(e)));

  return (
    <Show
      when={audio()}
      fallback={
        <div style={{ color: '#e0e0e0', font: '14px monospace' }}>
          {error() ? `Error: ${error()}` : 'Loading audio engine...'}
        </div>
      }
    >
      {(a) => <GraphCanvas audio={a()} />}
    </Show>
  );
}

render(() => <App />, document.getElementById('app')!);
