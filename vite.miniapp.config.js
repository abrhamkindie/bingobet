import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  root: 'src/miniapp',
  base: './',
  plugins: [react()],
  build: {
    outDir: '../../dist/miniapp',
    emptyOutDir: true,
    rollupOptions: {
      input: path.resolve('src/miniapp/index.html'),
      output: {
        // Split lucide-react (~450 kB) into its own vendor chunk so it
        // can be cached independently from app code changes.
        // Note: Vite 8 (Rolldown) expects manualChunks as a function.
        manualChunks(id) {
          if (id.includes('lucide-react')) {
            return 'vendor';
          }
        },
      },
    },
    chunkSizeWarningLimit: 600, // Bump slightly — vendor + React are unavoidably large
  },
});
