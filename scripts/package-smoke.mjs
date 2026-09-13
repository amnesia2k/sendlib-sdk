import assert from 'node:assert/strict';
import { access, mkdir, mkdtemp, readdir, rm, writeFile } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const projectRoot = fileURLToPath(new URL('../', import.meta.url));
const temporaryRoot = join(projectRoot, '.tmp');
const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const useShell = process.platform === 'win32';

function run(command, arguments_, options = {}) {
  const result = spawnSync(command, arguments_, {
    cwd: projectRoot,
    encoding: 'utf8',
    shell: useShell,
    ...options,
  });

  if (result.status !== 0) {
    throw new Error(
      [`Command failed: ${command} ${arguments_.join(' ')}`, result.stdout, result.stderr]
        .filter(Boolean)
        .join('\n'),
    );
  }

  return result.stdout.trim();
}

async function listFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const path = join(directory, entry.name);

    if (entry.isDirectory()) {
      files.push(...(await listFiles(path)));
    } else {
      files.push(path);
    }
  }

  return files;
}

async function createConsumer(directory, type, runtimeFile, runtimeSource, typeSource) {
  await mkdir(directory, { recursive: true });
  await writeFile(
    join(directory, 'package.json'),
    `${JSON.stringify({ private: true, type }, null, 2)}\n`,
    'utf8',
  );
  await writeFile(join(directory, runtimeFile), runtimeSource, 'utf8');
  await writeFile(join(directory, 'index.ts'), typeSource, 'utf8');
  await writeFile(
    join(directory, 'tsconfig.json'),
    `${JSON.stringify(
      {
        compilerOptions: {
          exactOptionalPropertyTypes: true,
          module: 'NodeNext',
          moduleResolution: 'NodeNext',
          noEmit: true,
          strict: true,
          target: 'ES2022',
        },
        include: ['index.ts'],
      },
      null,
      2,
    )}\n`,
    'utf8',
  );
}

await mkdir(temporaryRoot, { recursive: true });
const workspace = await mkdtemp(join(temporaryRoot, 'package-smoke-'));

try {
  const esmConsumer = join(workspace, 'esm-consumer');
  const commonjsConsumer = join(workspace, 'commonjs-consumer');
  const npmCache = join(workspace, 'npm-cache');

  run('bun', ['pm', 'pack', '--destination', workspace, '--quiet']);
  const archives = (await readdir(workspace)).filter((entry) => entry.endsWith('.tgz')).sort();

  assert.equal(archives.length, 1, 'Expected Bun to create exactly one package tarball');

  const archive = join(workspace, archives[0]);
  await access(archive);

  await createConsumer(
    esmConsumer,
    'module',
    'runtime.mjs',
    [
      "import { VERSION, analyzeDeliverability, Sendlib, SendlibError } from '@sendlib/node-sdk';",
      "if (VERSION !== '0.1.0') throw new Error(`Unexpected ESM version: ${VERSION}`);",
      "const report = analyzeDeliverability({ to: 'test@example.test', subject: 'Test', html: '<p>Test</p>', text: 'Test' });",
      "if (!report.passedAutomatedChecks) throw new Error('Unexpected ESM deliverability warning');",
      "if (!(new SendlibError('Smoke test') instanceof Error)) throw new Error('Unexpected ESM error export');",
      "const client = new Sendlib({ apiKey: 'package-smoke-key' });",
      "if (typeof client.emails.send !== 'function' || typeof client.templates.welcome !== 'function' || typeof client.batches.wait !== 'function') throw new Error('Unexpected ESM client surface');",
      '',
    ].join('\n'),
    [
      "import { VERSION, analyzeDeliverability, Sendlib } from '@sendlib/node-sdk';",
      "import type { DeliverabilityReport, SendlibApiErrorOptions, SendlibBatches, SendlibCallOptions, TemplateSendInput } from '@sendlib/node-sdk';",
      'const version: string = VERSION;',
      "const report: DeliverabilityReport = analyzeDeliverability({ to: 'test@example.test', subject: 'Test', html: '<p>Test</p>', text: 'Test' });",
      'const callOptions: SendlibCallOptions = { timeoutMs: 5000 };',
      'const errorOptions: SendlibApiErrorOptions = { body: null };',
      "const client = new Sendlib({ apiKey: 'package-smoke-key' });",
      "const templateInput: TemplateSendInput = { to: 'test@example.test', data: { name: 'Test' } };",
      'const batches: SendlibBatches = client.batches;',
      'void version;',
      'void report;',
      'void callOptions;',
      'void errorOptions;',
      'void client;',
      'void templateInput;',
      'void batches;',
      '',
    ].join('\n'),
  );

  await createConsumer(
    commonjsConsumer,
    'commonjs',
    'runtime.cjs',
    [
      "const { VERSION, analyzeDeliverability, Sendlib, SendlibError } = require('@sendlib/node-sdk');",
      "if (VERSION !== '0.1.0') throw new Error(`Unexpected CommonJS version: ${VERSION}`);",
      "const report = analyzeDeliverability({ to: 'test@example.test', subject: 'Test', html: '<p>Test</p>', text: 'Test' });",
      "if (!report.passedAutomatedChecks) throw new Error('Unexpected CommonJS deliverability warning');",
      "if (!(new SendlibError('Smoke test') instanceof Error)) throw new Error('Unexpected CommonJS error export');",
      "const client = new Sendlib({ apiKey: 'package-smoke-key' });",
      "if (typeof client.emails.send !== 'function' || typeof client.templates.welcome !== 'function' || typeof client.batches.wait !== 'function') throw new Error('Unexpected CommonJS client surface');",
      '',
    ].join('\n'),
    [
      "import sdk = require('@sendlib/node-sdk');",
      'const version: string = sdk.VERSION;',
      "const report: sdk.DeliverabilityReport = sdk.analyzeDeliverability({ to: 'test@example.test', subject: 'Test', html: '<p>Test</p>', text: 'Test' });",
      'const callOptions: sdk.SendlibCallOptions = { timeoutMs: 5000 };',
      'const errorOptions: sdk.SendlibApiErrorOptions = { body: null };',
      "const client = new sdk.Sendlib({ apiKey: 'package-smoke-key' });",
      "const templateInput: sdk.TemplateSendInput = { to: 'test@example.test', data: { name: 'Test' } };",
      'const batches: sdk.SendlibBatches = client.batches;',
      'void version;',
      'void report;',
      'void callOptions;',
      'void errorOptions;',
      'void client;',
      'void templateInput;',
      'void batches;',
      '',
    ].join('\n'),
  );

  for (const consumer of [esmConsumer, commonjsConsumer]) {
    run(
      npmCommand,
      ['install', archive, '--ignore-scripts', '--no-audit', '--no-fund', '--package-lock=false'],
      {
        cwd: consumer,
        env: { ...process.env, npm_config_cache: npmCache },
      },
    );
  }

  run(process.execPath, ['runtime.mjs'], { cwd: esmConsumer, shell: false });
  run(process.execPath, ['runtime.cjs'], { cwd: commonjsConsumer, shell: false });

  const typescriptCli = join(projectRoot, 'node_modules', 'typescript', 'bin', 'tsc');
  run(process.execPath, [typescriptCli, '--project', join(esmConsumer, 'tsconfig.json')], {
    shell: false,
  });
  run(process.execPath, [typescriptCli, '--project', join(commonjsConsumer, 'tsconfig.json')], {
    shell: false,
  });

  const installedPackage = join(esmConsumer, 'node_modules', '@sendlib', 'node-sdk');
  const installedFiles = (await listFiles(installedPackage))
    .map((path) => relative(installedPackage, path).split(sep).join('/'))
    .sort();
  const topLevelEntries = new Set(installedFiles.map((path) => path.split('/')[0]));
  const expectedTopLevelEntries = new Set([
    'CHANGELOG.md',
    'LICENSE',
    'README.md',
    'dist',
    'package.json',
  ]);

  assert.deepEqual(topLevelEntries, expectedTopLevelEntries);

  for (const requiredFile of [
    'dist/index.js',
    'dist/index.cjs',
    'dist/index.d.ts',
    'dist/index.d.cts',
  ]) {
    assert(installedFiles.includes(requiredFile), `Missing packaged file: ${requiredFile}`);
  }

  console.log(`Verified tarball contents (${installedFiles.length} files):`);
  console.log(installedFiles.map((path) => `- ${path}`).join('\n'));
  console.log(
    'Verified clean npm installs, runtime imports, and type resolution for ESM and CommonJS.',
  );
} finally {
  await rm(workspace, { force: true, recursive: true });
}
