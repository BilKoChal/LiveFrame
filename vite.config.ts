import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory.
  const env = loadEnv(mode, process.cwd(), '');

  return {
    plugins: [react(), tailwindcss()],
    base: env.VITE_BASE_PATH || '/',
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
    build: {
      outDir: 'dist',
      // Generate source maps so browser DevTools can map back to original TS source
      sourcemap: true,
      // Disable minification — preserve original variable/function names for debugging
      minify: false,
      // Preserve module structure as close to source as possible
      rollupOptions: {
        output: {
          // Keep readable, predictable file names based on the source module
          chunkFileNames: 'assets/[name]-[hash].js',
          entryFileNames: 'assets/[name]-[hash].js',
          assetFileNames: 'assets/[name]-[hash][extname]',
          // Split vendor chunks for better debuggability — each major lib gets its own chunk
          manualChunks: {
            'vendor-react': ['react', 'react-dom', 'react-router-dom'],
            'vendor-codemirror': [
              '@uiw/react-codemirror',
              '@codemirror/lang-html',
              '@codemirror/lang-css',
              '@codemirror/lang-javascript',
              '@codemirror/lang-json',
              '@codemirror/theme-one-dark',
              '@codemirror/autocomplete',
              '@codemirror/lint',
              '@codemirror/search',
              '@emmetio/codemirror6-plugin',
            ],
            'vendor-dnd': ['@dnd-kit/core', '@dnd-kit/sortable', '@dnd-kit/utilities'],
            'vendor-utils': ['zustand', 'idb', 'react-resizable-panels', '@tanstack/react-virtual'],
          },
        },
      },
    },
  };
});
