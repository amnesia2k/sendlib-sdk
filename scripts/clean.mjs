import { rm } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = fileURLToPath(new URL('../', import.meta.url));
const generatedDirectories = ['coverage', 'dist'];

for (const directory of generatedDirectories) {
  const target = resolve(projectRoot, directory);

  if (dirname(target) !== projectRoot.slice(0, -1)) {
    throw new Error(`Refusing to clean unexpected path: ${target}`);
  }

  await rm(target, { force: true, recursive: true });
}
