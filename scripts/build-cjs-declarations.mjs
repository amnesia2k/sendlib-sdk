import { readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const distDirectory = fileURLToPath(new URL('../dist/', import.meta.url));

async function findDeclarations(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const declarations = [];

  for (const entry of entries) {
    const path = join(directory, entry.name);

    if (entry.isDirectory()) {
      declarations.push(...(await findDeclarations(path)));
    } else if (entry.name.endsWith('.d.ts')) {
      declarations.push(path);
    }
  }

  return declarations;
}

for (const esmDeclaration of await findDeclarations(distDirectory)) {
  const cjsDeclaration = esmDeclaration.replace(/\.d\.ts$/, '.d.cts');
  const esmMap = `${esmDeclaration}.map`;
  const cjsMap = `${cjsDeclaration}.map`;
  const cjsMapName = basename(cjsMap);
  const source = await readFile(esmDeclaration, 'utf8');
  const transformedSource = source
    .replace(/(['"])(\.{1,2}\/[^'"]+)\.js\1/g, '$1$2.cjs$1')
    .replace(/sourceMappingURL=[^\s]+\.d\.ts\.map/g, `sourceMappingURL=${cjsMapName}`);

  await writeFile(cjsDeclaration, transformedSource, 'utf8');

  try {
    const sourceMap = JSON.parse(await readFile(esmMap, 'utf8'));
    sourceMap.file = basename(cjsDeclaration);
    await writeFile(cjsMap, `${JSON.stringify(sourceMap)}\n`, 'utf8');
  } catch (error) {
    if (error?.code !== 'ENOENT') {
      throw error;
    }
  }
}

// Implementation dependencies are followed by declaration emit even when no
// public declaration references them. Keep those internals out of the package.
await rm(new URL('./internal/', new URL('../dist/', import.meta.url)), {
  force: true,
  recursive: true,
});
