/**
 * Validates the built extension before it is loaded into Chrome.
 * Catches the mistakes that otherwise only show up as a silent failure in
 * chrome://extensions: a manifest pointing at a file that was never emitted,
 * or a dynamic import() reachable from the MV3 service worker.
 *
 * Run: node scripts/check-build.mjs
 */
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const DIST = 'dist';
const problems = [];
const check = (condition, message) => {
  if (!condition) problems.push(message);
};

check(existsSync(DIST), `${DIST}/ does not exist -- run the build first`);
if (problems.length) {
  console.error(problems.join('\n'));
  process.exit(1);
}

const manifestPath = join(DIST, 'manifest.json');
check(existsSync(manifestPath), 'manifest.json was not copied into dist/');

const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));

check(manifest.manifest_version === 3, 'manifest_version must be 3');

// Every path the manifest names must actually exist in the bundle.
const referenced = [
  manifest.action?.default_popup,
  manifest.options_page,
  manifest.background?.service_worker,
  ...Object.values(manifest.icons ?? {}),
].filter(Boolean);

for (const file of referenced) {
  check(existsSync(join(DIST, file)), `manifest references a missing file: ${file}`);
}

// Pages opened by code rather than by the manifest.
for (const file of ['stats.html', 'editor.html']) {
  check(existsSync(join(DIST, file)), `missing page: ${file}`);
}

check(
  manifest.background?.type === 'module',
  'the service worker must be declared with "type": "module"',
);

// A module service worker cannot dynamic-import. Two kinds of import() are
// expected in the bundle and are NOT call sites that can run here:
//   - the provider SDKs' Node-only credential fallbacks, guarded by a
//     `typeof process` check that is false in a service worker;
//   - the literal `import('node:buffer')` inside an SDK error message string.
// Anything else would be a real dynamic import and must fail the build.
const worker = readFileSync(join(DIST, manifest.background.service_worker), 'utf8');
const allowed = [
  /import\(`\.\/assets\/node\.browser-[^`]*`\)/g,
  /import\('node:buffer'\)/g,
];
const allowedCount = allowed.reduce((sum, re) => sum + [...worker.matchAll(re)].length, 0);
const unexpected = [...worker.matchAll(/import\(/g)].length - allowedCount;
check(
  unexpected === 0,
  `service worker contains ${unexpected} unexpected dynamic import(s); MV3 forbids dynamic import in a service worker`,
);

// Chrome rejects a manifest whose name or description exceeds these limits.
check(manifest.name.length <= 45, `manifest name is ${manifest.name.length} chars (max 45)`);
check(
  (manifest.description ?? '').length <= 132,
  `manifest description is ${manifest.description.length} chars (max 132)`,
);

// Declaring default_locale without a _locales/ directory makes Chrome refuse
// to load the extension outright.
check(
  !manifest.default_locale || existsSync(join(DIST, '_locales', manifest.default_locale)),
  `manifest declares default_locale "${manifest.default_locale}" but dist/_locales/${manifest.default_locale} does not exist`,
);

const hostPermissions = manifest.host_permissions ?? [];
for (const host of ['api.openai.com', 'api.anthropic.com', 'generativelanguage.googleapis.com']) {
  check(
    hostPermissions.some((p) => p.includes(host)),
    `host_permissions is missing ${host}; requests to it would be blocked`,
  );
}

// The key must never be baked into the bundle.
for (const page of ['popup.js', 'options.js', 'background.js']) {
  const source = readFileSync(join(DIST, page), 'utf8');
  check(!/sk-ant-[A-Za-z0-9]/.test(source), `${page} appears to contain a hard-coded API key`);
}

if (problems.length) {
  console.error('Build check failed:\n' + problems.map((p) => `  - ${p}`).join('\n'));
  process.exit(1);
}

console.log('Build check passed: manifest, pages, worker and permissions are consistent.');
