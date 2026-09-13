import { readFile, writeFile } from 'node:fs/promises';

const manifest = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
const changelog = await readFile(new URL('../CHANGELOG.md', import.meta.url), 'utf8');
const outputPath = process.argv[2];

if (typeof manifest.version !== 'string' || manifest.version.length === 0) {
  throw new TypeError('package.json must contain a non-empty version');
}

if (typeof outputPath !== 'string' || outputPath.length === 0) {
  throw new TypeError('Usage: node scripts/extract-release-notes.mjs <output-path>');
}

const lines = changelog.split(/\r?\n/);
const escapedVersion = manifest.version.replaceAll('.', '\\.');
const headingPattern = new RegExp(`^## ${escapedVersion} — \\d{4}-\\d{2}-\\d{2}$`);
const headingIndex = lines.findIndex((line) => headingPattern.test(line));
const nextHeadingIndex = lines.findIndex(
  (line, index) => index > headingIndex && line.startsWith('## '),
);
const notes =
  headingIndex === -1
    ? ''
    : lines
        .slice(headingIndex + 1, nextHeadingIndex === -1 ? undefined : nextHeadingIndex)
        .join('\n');

if (notes.trim().length === 0) {
  throw new Error(`CHANGELOG.md has no release notes for ${manifest.version}`);
}

await writeFile(outputPath, `${notes.trim()}\n`, 'utf8');
console.log(`Extracted GitHub release notes for ${manifest.version}.`);
