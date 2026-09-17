/**
 * Public entry point for the deterministic task breakdown system.
 *
 * Usage:
 *   import { breakdownTask } from '@/lib/task-breakdown';
 *   const { text, brief, template } = breakdownTask(userInput);
 */
export * from './schema';
export * from './classifier';
export * from './extractor';
export * from './renderer';
export * from './breakdown';
export { FALLBACK_TEMPLATE, TEMPLATES, getTemplateById } from './templates';
