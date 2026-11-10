import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    // Process global.css so tests can read it (theme token checks)
    css: { include: [/global\.css/] },
    exclude: ['node_modules', 'e2e', 'dist', '.idea', '.git', '.cache'],
  },
});
