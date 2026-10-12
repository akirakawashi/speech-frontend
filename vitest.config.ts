import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    // Playwright живёт в `e2e/` и запускается своим бегунком; без исключения
    // vitest подхватывает его спеки и падает на первом же `test.describe`.
    exclude: ['node_modules/**', 'e2e/**', '.next/**'],
  },
});
