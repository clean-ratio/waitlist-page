// Builds the app as one classic IIFE so jsdom (which cannot run ES modules)
// can execute it. Used only for the smoke test; never shipped.
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const PROJECT = 'C:/Users/Public/Clean_Ratio/Waitlist';
const OUT =
  'C:/Users/khala/AppData/Local/Temp/claude/C--Users-Public-Clean-Ratio-Waitlist/e414ff9c-37e5-42b5-96dd-70c06567d98e/scratchpad/smoke-dist';

export default defineConfig({
  root: PROJECT,
  plugins: [react()],
  define: { 'process.env.NODE_ENV': '"production"' },
  build: {
    outDir: OUT,
    emptyOutDir: true,
    target: 'es2019',
    minify: false,
    lib: {
      entry: `${PROJECT}/src/main.tsx`,
      name: 'App',
      formats: ['iife'],
      fileName: () => 'app.js',
    },
  },
});
