import { readFile, writeFile } from 'node:fs/promises';

const manifest = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
const changelogUrl = new URL('../CHANGELOG.md', import.meta.url);
const changelog = await readFile(changelogUrl, 'utf8');

if (typeof manifest.version !== 'string' || manifest.version.length === 0) {
  throw new TypeError('package.json must contain a non-empty version');
}

const escapedVersion = manifest.version.replaceAll('.', '\\.');
const undatedHeading = new RegExp(`^## ${escapedVersion}$`, 'm');
const datedHeading = new RegExp(`^## ${escapedVersion} — \\d{4}-\\d{2}-\\d{2}$`, 'm');

if (datedHeading.test(changelog)) {
  console.log(`CHANGELOG.md already dates ${manifest.version}.`);
  process.exit(0);
}

if (!undatedHeading.test(changelog)) {
  throw new Error(`CHANGELOG.md has no generated heading for ${manifest.version}`);
}

const releaseDate = new Date().toISOString().slice(0, 10);
await writeFile(
  changelogUrl,
  changelog.replace(undatedHeading, `## ${manifest.version} — ${releaseDate}`),
  'utf8',
);
console.log(`Dated CHANGELOG.md entry for ${manifest.version} as ${releaseDate}.`);
