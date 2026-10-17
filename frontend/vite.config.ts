import { defineConfig } from 'vitest/config';

export default defineConfig({
  server: {
    // In development, forward API calls to the Spring Boot backend.
    proxy: { '/api': process.env.BACKEND_URL ?? 'http://localhost:8080' },
  },
  build: { chunkSizeWarningLimit: 800 },
  test: {
    include: ['test/**/*.test.ts'],
  },
});
