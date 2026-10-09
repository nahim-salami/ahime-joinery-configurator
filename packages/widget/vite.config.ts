/**
 * The build of the web component shipped in the WordPress plugin.
 *
 * - ES module output with lazy chunks: the 3D view (three.js) and each family group are only downloaded
 *   when they are used.
 * - Stable chunk names (`ahjc-<name>.js`): the plugin enqueues `ahjc-widget.js` by name.
 * - READABLE output: no minification, no identifier renaming, comments kept. Third-party libraries keep
 *   their own published production builds.
 *
 * Output: ../../ahime-joinery-configurator/assets/
 */

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

const ici = (chemin: string) => fileURLToPath(new URL(chemin, import.meta.url));

export default defineConfig({
  root: ici('.'),
  plugins: [react()],
  // In library mode Vite leaves `process.env.NODE_ENV` untouched; the plugin page has no `process`, and
  // React would otherwise ship its development build.
  define: { 'process.env.NODE_ENV': JSON.stringify('production') },
  resolve: {
    alias: [
      { find: /^@ahjc\/core$/, replacement: ici('../core/src/index.ts') },
      { find: /^@ahjc\/core\/(.*)$/, replacement: `${ici('../core')}/$1` },
    ],
  },
  build: {
    target: 'es2022',
    minify: false,
    outDir: ici('../../ahime-joinery-configurator/assets'),
    emptyOutDir: true,
    reportCompressedSize: false,
    lib: {
      entry: ici('src/index.ts'),
      formats: ['es'],
      fileName: () => 'ahjc-widget.js',
    },
    rollupOptions: {
      output: {
        chunkFileNames: (morceau) => `ahjc-${morceau.name === 'index' ? 'moteur' : morceau.name}.js`,
        assetFileNames: 'ahjc-[name][extname]',
      },
    },
  },
});
