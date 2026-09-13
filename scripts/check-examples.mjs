import assert from 'node:assert/strict';
import { readdir } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const projectRoot = fileURLToPath(new URL('../', import.meta.url));
const examplesDirectory = fileURLToPath(new URL('../examples/', import.meta.url));
const expectedGuard = 'Set SENDLIB_RUN_EXAMPLE=true only when you intend to send a real';
const examples = (await readdir(examplesDirectory)).filter((entry) => entry.endsWith('.ts')).sort();

assert.deepEqual(examples, ['attachment.ts', 'basic-send.ts', 'batch-send.ts', 'template-send.ts']);

for (const example of examples) {
  const result = spawnSync('bun', [`./examples/${example}`], {
    cwd: projectRoot,
    encoding: 'utf8',
    env: {
      ...process.env,
      SENDLIB_API_KEY: '',
      SENDLIB_RUN_EXAMPLE: 'false',
    },
    shell: process.platform === 'win32',
  });
  const output = `${result.stdout ?? ''}\n${result.stderr ?? ''}`;

  assert.notEqual(result.status, 0, `${example} must refuse to run without explicit opt-in`);
  assert.match(output, new RegExp(expectedGuard), `${example} must fail at its real-send guard`);
}

console.log(
  `Verified compile-time and default-run safety for ${String(examples.length)} examples.`,
);
