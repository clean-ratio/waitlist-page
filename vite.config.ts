import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { HERO } from './src/lib/content';

const escapeHtml = (text: string) =>
  text.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** The meta and share descriptions in index.html read the hero line, so it is written once. */
function heroMeta(): Plugin {
  return {
    name: 'hero-meta',
    transformIndexHtml: (html) => html.replaceAll('%HERO_DESCRIPTION%', escapeHtml(HERO.description)),
  };
}

export default defineConfig({
  plugins: [react(), heroMeta()],
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
