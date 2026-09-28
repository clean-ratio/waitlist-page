import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import devApi from './scripts/dev-api';

export default defineConfig({
  plugins: [react(), devApi()],
  build: {
    target: 'es2022',
    // The three chunk is knowingly large and knowingly lazy: it is not on the
    // first-load path, so the default 500 kB warning is just noise here.
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        // Keep the first load small: the WebGL scene is lazy-imported after
        // first paint, so it must not sit in the entry chunk.
        manualChunks: {
          three: ['three', '@react-three/fiber'],
          gsap: ['gsap', '@gsap/react'],
        },
      },
    },
  },
});
