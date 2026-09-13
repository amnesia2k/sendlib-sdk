import { spawnSync } from 'node:child_process';
import { access, mkdir, mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { extname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = fileURLToPath(new URL('../', import.meta.url));
const ignoredDirectories = new Set([
  '.git',
  '.npm-cache',
  '.tmp',
  'coverage',
  'dist',
  'node_modules',
]);
const binaryExtensions = new Set([
  '.gif',
  '.ico',
  '.jpeg',
  '.jpg',
  '.pdf',
  '.png',
  '.tgz',
  '.webp',
  '.zip',
]);
const maximumTextFileBytes = 2 * 1024 * 1024;

const secretPatterns = [
  { name: 'private key', expression: /-----BEGIN (?:EC |OPENSSH |RSA )?PRIVATE KEY-----/g },
  { name: 'GitHub token', expression: /gh(?:p|o|u|s|r)_[A-Za-z0-9]{30,}/g },
  { name: 'npm access token', expression: /npm_[A-Za-z0-9]{30,}/g },
  { name: 'AWS access key', expression: /(?:AKIA|ASIA)[A-Z0-9]{16}/g },
  { name: 'SendLib API key', expression: /sl_[A-Za-z0-9_-]{24,}/g },
  {
    name: 'assigned SendLib API key',
    expression: /SENDLIB_API_KEY\s*=\s*(?!sl_your_api_key_here(?=[\s"'`]|$))["']?[^\s"'`]{12,}/g,
  },
];

function run(command, arguments_, options = {}) {
  const result = spawnSync(command, arguments_, {
    cwd: projectRoot,
    encoding: 'utf8',
    shell: process.platform === 'win32',
    ...options,
  });

  if (result.status !== 0) {
    throw new Error(
      [`Command failed: ${command} ${arguments_.join(' ')}`, result.stdout, result.stderr]
        .filter(Boolean)
        .join('\n'),
    );
  }
}

async function collectFiles(directory, exclusions) {
  const files = [];
  const entries = await readdir(directory, { withFileTypes: true });

  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      if (!exclusions.has(entry.name)) files.push(...(await collectFiles(path, exclusions)));
    } else if (!binaryExtensions.has(extname(entry.name).toLowerCase())) {
      files.push(path);
    }
  }

  return files;
}

async function scanFiles(root, files, label) {
  const findings = [];

  for (const file of files) {
    const contents = await readFile(file);
    if (contents.byteLength > maximumTextFileBytes || contents.includes(0)) continue;
    const text = contents.toString('utf8');

    for (const pattern of secretPatterns) {
      pattern.expression.lastIndex = 0;
      if (pattern.expression.test(text)) {
        findings.push(`${label}/${relative(root, file).replaceAll('\\', '/')}: ${pattern.name}`);
      }
    }
  }

  return findings;
}

const temporaryDirectory = await mkdtemp(join(tmpdir(), 'sendlib-security-scan-'));

try {
  const repositoryFiles = await collectFiles(projectRoot, ignoredDirectories);
  const findings = await scanFiles(projectRoot, repositoryFiles, 'repository');

  const packDirectory = join(temporaryDirectory, 'pack');
  const extractDirectory = join(temporaryDirectory, 'extract');
  await mkdir(packDirectory);
  await mkdir(extractDirectory);
  run('bun', ['pm', 'pack', '--destination', packDirectory, '--quiet']);

  const archives = (await readdir(packDirectory)).filter((file) => file.endsWith('.tgz'));
  if (archives.length !== 1) {
    throw new Error(`Expected one package archive, received ${archives.length}`);
  }

  const archive = join(packDirectory, archives[0]);
  await access(archive);
  run('tar', ['-xzf', archive, '-C', extractDirectory]);
  const packageRoot = join(extractDirectory, 'package');
  const packageFiles = await collectFiles(packageRoot, new Set());
  findings.push(...(await scanFiles(packageRoot, packageFiles, 'package')));

  if (findings.length > 0) {
    throw new Error(
      `Possible credentials found. Values are intentionally redacted:\n${findings
        .map((finding) => `- ${finding}`)
        .join('\n')}`,
    );
  }

  console.log(
    `No high-confidence secret patterns found in ${repositoryFiles.length} repository files or ${packageFiles.length} packed files.`,
  );
} finally {
  await rm(temporaryDirectory, { recursive: true, force: true });
}
