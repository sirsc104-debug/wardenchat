import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';

// `npm run build` writes a normal multi-file build to dist/app.
// `npm run build:single` (mode "single") inlines everything into dist/sirsc-scroll.html,
// one self-contained file for embedding (Google Sites) or opening straight from disk.
export default defineConfig(({ mode }) => {
  const single = mode === 'single';
  return {
    base: './',
    plugins: single ? [react(), viteSingleFile({ removeViteModuleLoader: true })] : [react()],
    build: {
      outDir: single ? 'dist/single' : 'dist/app',
      emptyOutDir: true,
      target: 'es2020',
      cssCodeSplit: !single,
      assetsInlineLimit: single ? 100_000_000 : 4096,
      reportCompressedSize: false,
    },
  };
});
