#!/usr/bin/env node
/**
 * Scaffold a new template JSON in the repo's schema format.
 *
 * Repeatable authoring flow (AI may help write the content at dev time,
 * but nothing here calls any network/API):
 *   1. node scripts/new-template-stub.mjs --id my-task --category "Work"
 *   2. Fill in signals / placeholders / steps in the generated JSON
 *      (tip: ask any AI assistant to draft it, then review by hand).
 *   3. npm run breakdown:validate
 *   4. Register the import in lib/task-breakdown/templates/index.ts
 *   5. npm run breakdown:test
 *
 * Zero dependencies — plain Node only.
 */
import { writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const args = process.argv.slice(2);
function flag(name) {
  const i = args.indexOf(name);
  return i >= 0 && i + 1 < args.length ? args[i + 1] : null;
}

if (args.includes('--help') || args.includes('-h')) {
  console.log(`Usage: node scripts/new-template-stub.mjs --id <kebab-id> --category "<Name>" [--title "<Step>"]`);
  process.exit(0);
}

const id = flag('--id');
const category = flag('--category') ?? 'General';

if (!id || !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(id)) {
  console.error('Error: --id must be kebab-case, e.g. --id study-group-plan');
  process.exit(1);
}

const dir = join(dirname(fileURLToPath(import.meta.url)), '..', 'lib', 'task-breakdown', 'templates');
const fileName = `${id.replace(/-/g, '_')}.json`;
const filePath = join(dir, fileName);

if (existsSync(filePath)) {
  console.error(`Error: ${fileName} already exists — edit it instead.`);
  process.exit(1);
}

const words = id.split('-');
const pretty = words.map((w) => w[0].toUpperCase() + w.slice(1)).join(' ');

const stub = {
  schemaVersion: 1,
  id,
  category_name: category,
  signals: [
    { phrase: words.slice(0, 2).join(' '), weight: 5 },
    { phrase: words.join(' '), weight: 4 },
    { phrase: 'TODO keyword', weight: 3 },
  ],
  placeholders: ['task_name', 'goal', 'deadline', 'timeline'],
  steps: [
    {
      title: `Clarify the goal for {task_name}`,
      description: `Write down exactly what success looks like for {task_name}, including {goal}.`,
    },
    {
      title: `TODO second step for ${pretty}`,
      description: 'TODO: replace with a concrete step. You may use {placeholders} declared above.',
    },
    {
      title: 'TODO third step',
      description: 'TODO: replace with a concrete step.',
    },
    {
      title: 'TODO fourth step',
      description: 'TODO: replace with a concrete step.',
    },
    {
      title: `Review {task_name} by {deadline}`,
      description: `Check the result of {task_name} against {goal} across {timeline} and fix gaps.`,
    },
  ],
};

writeFileSync(filePath, `${JSON.stringify(stub, null, 2)}\n`);
console.log(`Created ${filePath}`);
console.log('Next: fill in signals/steps, run npm run breakdown:validate, register in templates/index.ts');
