import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  root: resolve(__dirname, 'src/admin'),
  base: '/admin/',
  plugins: [react()],
  build: {
    outDir: resolve(__dirname, 'dist/admin'),
    emptyOutDir: true,
    rollupOptions: {
      input: resolve(__dirname, 'src/admin/index.html'),
    },
  },
});
