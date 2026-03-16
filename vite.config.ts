import { defineConfig } from 'vite';
import solidPlugin from 'vite-plugin-solid';

export default defineConfig({
  plugins: [solidPlugin()],
  optimizeDeps: {
    exclude: ['hyasynth-engine'],
  },
  // To allow importing hyasynth-engine from ../hyasynth-engine
  server: {
    fs: {
      allow: ['..'],
    },
  },
  build: {
    target: 'esnext',
  },
});
