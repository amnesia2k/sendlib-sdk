import { readFile } from 'node:fs/promises';

const manifest = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
const changelog = await readFile(new URL('../CHANGELOG.md', import.meta.url), 'utf8');
const tag = process.argv[2] ?? process.env.GITHUB_REF_NAME;

if (typeof manifest.version !== 'string' || manifest.version.length === 0) {
  throw new TypeError('package.json must contain a non-empty version');
}

const expectedTag = `v${manifest.version}`;
if (tag !== expectedTag) {
  throw new Error(`Release tag must be ${expectedTag}; received ${tag ?? 'no tag'}`);
}

const escapedVersion = manifest.version.replaceAll('.', '\\.');
const datedHeading = new RegExp(`^## ${escapedVersion} — \\d{4}-\\d{2}-\\d{2}$`, 'm');
if (!datedHeading.test(changelog)) {
  throw new Error(`CHANGELOG.md must contain a dated release heading for ${manifest.version}`);
}

if (manifest.private !== false || manifest.publishConfig?.access !== 'public') {
  throw new Error('The release manifest must explicitly publish a public package');
}

console.log(`Verified release tag ${tag} for ${manifest.name}@${manifest.version}.`);
