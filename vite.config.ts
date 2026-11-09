import { defineConfig } from 'vitest/config';

export default defineConfig({
  base: './',
  server: { port: 5173, strictPort: true },
  build: {
    rollupOptions: {
      output: {
        manualChunks: (id) =>
          id.includes('node_modules/phaser') ? 'phaser' : undefined,
      },
    },
    chunkSizeWarningLimit: 1600,
  },
  test: { include: ['src/**/*.test.ts'], environment: 'node' },
});
