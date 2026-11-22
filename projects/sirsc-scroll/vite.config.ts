import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';

// `npm run build`          multi-file build in dist/app.
// `npm run build:single`   (mode "single") everything inlined into one file, for embeds or file://.
// `npm run build:artifact` (mode "artifact") the single file with an in-memory router, reshaped by
//                          scripts/build-artifact.mjs for publishing as a claude.ai Artifact. It signs in
//                          against a pretend Warden Chat (src/lib/demoBackend.ts), because it runs sandboxed.
// `vite build --mode demo` the multi-file app with the same pretend Warden Chat, in dist/demo (for tests).
export default defineConfig(({ mode }) => {
  const single = mode === 'single' || mode === 'artifact';
  return {
    base: './',
    define: { __MEMORY_ROUTER__: JSON.stringify(mode === 'artifact'), __DEMO_BACKEND__: JSON.stringify(mode === 'artifact' || mode === 'demo') },
    plugins: single ? [react(), viteSingleFile({ removeViteModuleLoader: true })] : [react()],
    build: {
      outDir: mode === 'artifact' ? 'dist/artifact' : single ? 'dist/single' : mode === 'demo' ? 'dist/demo' : 'dist/app',
      emptyOutDir: true,
      target: 'es2020',
      cssCodeSplit: !single,
      assetsInlineLimit: single ? 100_000_000 : 4096,
      reportCompressedSize: false,
    },
  };
});
