/**
 * Orchestrator: raw input text -> matched template -> extracted values ->
 * rendered breakdown (plain text + structured EmailBrief/KanbanPlan).
 *
 * Single entry point for the app: `breakdownTask(input)`.
 * Pure + synchronous. No network, no AI, no storage side effects.
 */
import type { EmailBrief } from '@/lib/briefs';
import { classifyTask } from './classifier';
import { extractDetails, type ExtractedValues } from './extractor';
import { renderBreakdown } from './renderer';
import type { TaskTemplate } from './schema';
import { FALLBACK_TEMPLATE, TEMPLATES } from './templates';

export type BreakdownResult = {
  template: TaskTemplate;
  score: number;
  matchedPhrases: string[];
  extracted: ExtractedValues;
  text: string;
  brief: EmailBrief;
};

export function breakdownTask(rawInput: string): BreakdownResult {
  const input = (rawInput ?? '').trim();
  if (!input) {
    throw new Error('Task input is required');
  }

  const classification = classifyTask(input, TEMPLATES, FALLBACK_TEMPLATE);
  const extracted = extractDetails(input, classification.template);
  const rendered = renderBreakdown(classification.template, extracted, input);

  return {
    template: classification.template,
    score: classification.score,
    matchedPhrases: classification.matchedPhrases,
    extracted,
    text: rendered.text,
    brief: rendered.brief,
  };
}
