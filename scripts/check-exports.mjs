import { access, readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';

const manifestUrl = new URL('../package.json', import.meta.url);
const manifest = JSON.parse(await readFile(manifestUrl, 'utf8'));
const projectRoot = new URL('../', import.meta.url);
const expectedFiles = [
  manifest.main,
  manifest.module,
  manifest.types,
  manifest.exports?.['.']?.import?.types,
  manifest.exports?.['.']?.require?.types,
];

for (const relativePath of expectedFiles) {
  if (typeof relativePath !== 'string' || relativePath.length === 0) {
    throw new TypeError('main, module, and types must be non-empty package paths');
  }

  await access(new URL(relativePath, projectRoot));
}

const esm = await import(manifest.name);
const require = createRequire(import.meta.url);
const commonjs = require(manifest.name);

for (const [format, module] of [
  ['ESM', esm],
  ['CommonJS', commonjs],
]) {
  if (module.VERSION !== manifest.version) {
    throw new Error(
      `${format} exported VERSION ${String(module.VERSION)} instead of ${manifest.version}`,
    );
  }

  if (typeof module.analyzeDeliverability !== 'function') {
    throw new TypeError(`${format} must export analyzeDeliverability as a function`);
  }

  if (typeof module.SendlibError !== 'function') {
    throw new TypeError(`${format} must export SendlibError as a class`);
  }

  if (typeof module.Sendlib !== 'function') {
    throw new TypeError(`${format} must export Sendlib as a class`);
  }

  if (typeof module.SendlibBatchFailedError !== 'function') {
    throw new TypeError(`${format} must export SendlibBatchFailedError as a class`);
  }

  if ('default' in module) {
    throw new TypeError(`${format} must not expose a default export`);
  }
}

console.log(`Verified ESM, CommonJS, and types exports for ${manifest.name}@${manifest.version}.`);
