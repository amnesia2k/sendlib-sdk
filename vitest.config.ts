import { readFileSync } from 'node:fs';

import { defineConfig } from 'vitest/config';

interface PackageManifest {
  version?: unknown;
}

const manifest = JSON.parse(
  readFileSync(new URL('./package.json', import.meta.url), 'utf8'),
) as PackageManifest;

if (typeof manifest.version !== 'string' || manifest.version.length === 0) {
  throw new TypeError('package.json must contain a non-empty version');
}

export default defineConfig({
  define: {
    __SENDLIB_NODE_VERSION__: JSON.stringify(manifest.version),
  },
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts'],
    passWithNoTests: true,
    clearMocks: true,
    restoreMocks: true,
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      reporter: ['text', 'json', 'html', 'lcov'],
      reportsDirectory: 'coverage',
      thresholds: {
        branches: 100,
        functions: 100,
        lines: 100,
        statements: 100,
      },
    },
  },
});
