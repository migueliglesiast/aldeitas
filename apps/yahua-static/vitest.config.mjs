import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.js'],
    coverage: {
      provider: 'v8',
      all: true,
      include: ['build.js', 'sync-ical.js', 'lib/**/*.js', 'assets/**/*.js'],
      reporter: ['text', 'lcov'],
      reportsDirectory: 'coverage',
    },
  },
});
