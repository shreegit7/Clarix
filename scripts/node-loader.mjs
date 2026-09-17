/**
 * Tiny zero-dependency ESM loader for running repo TypeScript scripts
 * with plain `node` (no tsx/ts-node/jest required).
 *
 * It resolves:
 *  - `@/<path>` aliases to the project root (matches tsconfig paths)
 *  - extensionless relative imports to `.ts` / `.tsx` / `/index.ts`
 *
 * Usage:
 *   node --import ./scripts/node-loader.mjs scripts/<script>.ts
 */
import { existsSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';

const PROJECT_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
);

const CANDIDATE_SUFFIXES = [
  '.ts',
  '.tsx',
  '.mjs',
  '.js',
  '/index.ts',
  '/index.tsx',
  '/index.mjs',
  '/index.js',
];

function tryResolve(base) {
  if (/\.[A-Za-z0-9]+$/.test(base) && existsSync(base)) return base;
  for (const suffix of CANDIDATE_SUFFIXES) {
    if (existsSync(base + suffix)) return base + suffix;
  }
  return null;
}

export async function resolve(specifier, context, next) {
  try {
    if (specifier.startsWith('@/')) {
      const hit = tryResolve(path.join(PROJECT_ROOT, specifier.slice(2)));
      if (hit) return { url: pathToFileURL(hit).href, shortCircuit: true };
    } else if (specifier.startsWith('./') || specifier.startsWith('../')) {
      const parentPath = fileURLToPath(context.parentURL);
      const hit = tryResolve(path.resolve(path.dirname(parentPath), specifier));
      if (hit) return { url: pathToFileURL(hit).href, shortCircuit: true };
    }
  } catch {
    // Fall through to default resolution on any unexpected error.
  }
  return next(specifier, context);
}
