/**
 * Validate every template JSON against the schema.
 *
 * Run: npm run breakdown:validate
 * (node --import ./scripts/node-loader.mjs scripts/validate-templates.ts)
 *
 * Zero dependencies — plain Node + the repo's own schema validator.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  validateTemplate,
  FALLBACK_TEMPLATE_ID,
} from '../lib/task-breakdown/schema';

const SCRIPTS_DIR = dirname(fileURLToPath(import.meta.url));
const TEMPLATES_DIR = join(SCRIPTS_DIR, '..', 'lib', 'task-breakdown', 'templates');

const files = readdirSync(TEMPLATES_DIR)
  .filter((f) => f.endsWith('.json'))
  .sort();

let failures = 0;
const seenIds = new Map<string, string>();

console.log(`Validating ${files.length} template file(s) in lib/task-breakdown/templates/`);

for (const file of files) {
  const raw = readFileSync(join(TEMPLATES_DIR, file), 'utf8');
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    failures += 1;
    console.error(`FAIL ${file}: not valid JSON`);
    continue;
  }
  const { valid, errors } = validateTemplate(parsed);
  const id = (parsed as { id?: unknown }).id;
  if (typeof id === 'string') {
    if (seenIds.has(id)) {
      failures += 1;
      console.error(`FAIL ${file}: duplicate id "${id}" (also in ${seenIds.get(id)})`);
    } else {
      seenIds.set(id, file);
    }
    const expectedFile = `${id.replace(/-/g, '_')}.json`;
    if (id !== FALLBACK_TEMPLATE_ID && file !== expectedFile && file !== `${id}.json`) {
      console.warn(`WARN ${file}: filename does not match id "${id}" (expected ${expectedFile})`);
    }
  }
  if (!valid) {
    failures += 1;
    console.error(`FAIL ${file}:`);
    for (const e of errors) console.error(`  - ${e}`);
  } else {
    console.log(`ok   ${file} (${(parsed as { steps: unknown[] }).steps.length} steps)`);
  }
}

if (!seenIds.has(FALLBACK_TEMPLATE_ID)) {
  failures += 1;
  console.error(`FAIL: missing fallback template "${FALLBACK_TEMPLATE_ID}"`);
}

if (failures > 0) {
  console.error(`\n${failures} problem(s) found.`);
  process.exit(1);
}
console.log(`\nAll ${files.length} templates valid.`);
