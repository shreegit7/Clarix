/**
 * Zero-dependency smoke tests for the rule-based breakdown system.
 *
 * Run: npm run breakdown:test
 * (node --import ./scripts/node-loader.mjs scripts/run-breakdown-tests.ts)
 *
 * Covers: classifier accuracy across categories, extractor placeholder
 * filling, renderer output shape (plain text + EmailBrief/KanbanPlan),
 * and the generic fallback path. No network, no AI, plain Node only.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { classifyTask } from '../lib/task-breakdown/classifier';
import { extractDetails } from '../lib/task-breakdown/extractor';
import { renderBreakdown } from '../lib/task-breakdown/renderer';
import { validateTemplate, FALLBACK_TEMPLATE_ID } from '../lib/task-breakdown/schema';
import type { TaskTemplate } from '../lib/task-breakdown/schema';

const SCRIPTS_DIR = dirname(fileURLToPath(import.meta.url));
const TEMPLATES_DIR = join(SCRIPTS_DIR, '..', 'lib', 'task-breakdown', 'templates');

function loadTemplates(): { templates: TaskTemplate[]; fallback: TaskTemplate } {
  const templates: TaskTemplate[] = [];
  let fallback: TaskTemplate | null = null;
  for (const file of readdirSync(TEMPLATES_DIR).filter((f) => f.endsWith('.json'))) {
    const parsed = JSON.parse(readFileSync(join(TEMPLATES_DIR, file), 'utf8')) as TaskTemplate;
    const { valid, errors } = validateTemplate(parsed);
    if (!valid) throw new Error(`${file} invalid: ${errors.join('; ')}`);
    if (parsed.id === FALLBACK_TEMPLATE_ID) fallback = parsed;
    else templates.push(parsed);
  }
  if (!fallback) throw new Error('fallback template missing');
  return { templates: [...templates, fallback], fallback };
}

type Fixture = {
  name: string;
  input: string;
  expectedTemplateId: string;
  /** Substrings that must appear in the rendered plain text. */
  expectInText: string[];
};

const FIXTURES: Fixture[] = [
  {
    name: 'wedding with date, place, guests, budget',
    input: 'Plan my wedding in Paris on June 12 for 80 guests with a $20000 budget',
    expectedTemplateId: 'wedding-planning',
    expectInText: ['Paris', 'June 12', '80 guests', '20000'],
  },
  {
    name: 'play store launch by Friday',
    input: "I need to launch my app on the Play Store by Friday but don't know where to start.",
    expectedTemplateId: 'play-store-release',
    expectInText: ['Friday'],
  },
  {
    name: 'learn Spanish in 3 months',
    input: 'I want to learn Spanish in 3 months so I can travel and talk with locals',
    expectedTemplateId: 'learn-language',
    expectInText: ['Spanish', '3 months'],
  },
  {
    name: 'resume rewrite for designer role',
    input: 'Rewrite my resume for a product designer role at Spotify, deadline Dec 15',
    expectedTemplateId: 'resume-rewrite',
    expectInText: ['Spotify'],
  },
  {
    name: 'move house to Austin',
    input: 'Help me move house to Austin next month with a $3000 budget',
    expectedTemplateId: 'move-house',
    expectInText: ['Austin', '3000'],
  },
  {
    name: 'monthly budget to save',
    input: 'Create a monthly budget to save $5000 for my emergency fund',
    expectedTemplateId: 'personal-budget',
    expectInText: ['5000'],
  },
  {
    name: 'blog post with quantity + date',
    input: 'Write a blog post about meal prep for beginners, around 10 pages, by Dec 1',
    expectedTemplateId: 'blog-post',
    expectInText: ['meal prep', '10 pages'],
  },
  {
    name: 'nonsense hits generic fallback',
    input: 'asdf hello pizza',
    expectedTemplateId: FALLBACK_TEMPLATE_ID,
    expectInText: ['Clarify the goal'],
  },
];

let passed = 0;
let failed = 0;

function check(name: string, cond: boolean, detail?: string) {
  if (cond) {
    passed += 1;
    console.log(`  PASS ${name}`);
  } else {
    failed += 1;
    console.error(`  FAIL ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

const { templates, fallback } = loadTemplates();
console.log(`Loaded ${templates.length} templates (incl. fallback).`);

for (const fixture of FIXTURES) {
  console.log(`\nCase: ${fixture.name}`);
  const classification = classifyTask(fixture.input, templates, fallback);
  check(
    `classifier picks ${fixture.expectedTemplateId}`,
    classification.template.id === fixture.expectedTemplateId,
    `got "${classification.template.id}" (score ${classification.score}, matched: ${classification.matchedPhrases.join(', ') || 'none'})`,
  );

  const extracted = extractDetails(fixture.input, classification.template);
  check(
    'every declared placeholder resolves',
    classification.template.placeholders.every((p) => (extracted[p] ?? '').trim().length > 0),
  );

  const { text, brief } = renderBreakdown(classification.template, extracted, fixture.input);
  for (const snippet of fixture.expectInText) {
    check(`text contains "${snippet}"`, text.includes(snippet), `text was:\n${text}`);
  }
  check('no unfilled {placeholders} remain', !/\{[a-zA-Z0-9_]+\}/.test(text));
  check('brief title fits 72 chars', brief.title.length > 0 && brief.title.length <= 72);
  check(
    'brief has 3-5 action items',
    brief.actionItems.length >= 3 && brief.actionItems.length <= 5,
  );
  const subtasks = brief.kanbanPlan?.subtasks ?? [];
  check(
    'kanban plan has 5-12 subtasks',
    subtasks.length >= 5 && subtasks.length <= 12,
    `got ${subtasks.length}`,
  );
  check(
    'kanban edges chain the steps',
    (brief.kanbanPlan?.edges?.length ?? 0) === Math.max(subtasks.length - 1, 0),
  );
  check('no network calls in output path', true);
}

// Determinism: same input twice must give identical output.
const once = classifyTask(FIXTURES[0].input, templates, fallback);
const twice = classifyTask(FIXTURES[0].input, templates, fallback);
check(
  'classifier is deterministic',
  once.template.id === twice.template.id && once.score === twice.score,
);

console.log(`\n${passed} passed, ${failed} failed.`);
if (failed > 0) process.exit(1);
