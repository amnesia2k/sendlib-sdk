import { readFileSync } from 'node:fs';

import { defineConfig } from 'tsup';

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
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  target: 'node22',
  platform: 'node',
  outDir: 'dist',
  outExtension({ format }) {
    return {
      js: format === 'cjs' ? '.cjs' : '.js',
    };
  },
  clean: true,
  // TypeScript emits declarations via tsconfig.build.json. tsup's bundled
  // declaration plugin is not compatible with the project's TypeScript 7.
  dts: false,
  sourcemap: true,
  splitting: false,
  treeshake: true,
  minify: false,
  define: {
    __SENDLIB_NODE_VERSION__: JSON.stringify(manifest.version),
  },
});
