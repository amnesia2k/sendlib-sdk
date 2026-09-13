import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const run = (command, args, options = {}) =>
  execFileSync(command, args, {
    cwd: new URL('..', import.meta.url),
    encoding: 'utf8',
    stdio: options.capture ? ['ignore', 'pipe', 'inherit'] : 'inherit',
  });

const output = (command, args) => run(command, args, { capture: true }).trim();
const manifest = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const tag = `v${manifest.version}`;

if (output('git', ['branch', '--show-current']) !== 'master') {
  throw new Error('Run releases from the master branch.');
}

if (output('git', ['status', '--porcelain']) !== '') {
  throw new Error('Commit or stash local changes before releasing.');
}

run('git', ['fetch', 'origin', 'master', '--tags']);

const head = output('git', ['rev-parse', 'HEAD']);
const remoteMaster = output('git', ['rev-parse', 'origin/master']);
if (head !== remoteMaster) {
  throw new Error('Local master must exactly match origin/master. Run git pull first.');
}

const existingTag = output('git', ['tag', '--list', tag]);
if (existingTag !== '') {
  throw new Error(`${tag} already exists. Published versions and tags are immutable.`);
}

run('node', ['./scripts/verify-release-tag.mjs', tag]);
run('bun', ['run', 'prepublishOnly']);
run('git', ['tag', '--annotate', tag, '--message', `Release ${tag}`]);

try {
  run('git', ['push', 'origin', `refs/tags/${tag}`]);
} catch (error) {
  run('git', ['tag', '--delete', tag]);
  throw error;
}

console.log(
  `\nPushed ${tag}. GitHub Actions will now publish ${manifest.name}@${manifest.version}.`,
);
