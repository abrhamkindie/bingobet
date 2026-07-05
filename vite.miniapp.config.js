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
    },
  },
});
