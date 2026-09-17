/**
 * Deterministic keyword classifier — pure code, no ML/AI, no network.
 *
 * Each template declares weighted `signals` (keywords/phrases). The input
 * is scored against every template with case-insensitive word-boundary
 * substring matching; the best score wins, or the generic fallback when
 * nothing clears MIN_MATCH_SCORE.
 */
import type { TaskTemplate } from './schema';

export const MIN_MATCH_SCORE = 4;

export type TemplateScore = {
  id: string;
  score: number;
  matchedPhrases: string[];
};

export type ClassificationResult = {
  template: TaskTemplate;
  score: number;
  matchedPhrases: string[];
  /** All templates scored, sorted best-first (useful for debugging/tests). */
  scores: TemplateScore[];
};

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function countMatches(normalizedInput: string, phrase: string): boolean {
  const pattern = new RegExp(`\\b${escapeRegExp(phrase.trim().toLowerCase())}\\b`);
  return pattern.test(normalizedInput);
}

export function scoreTemplate(input: string, template: TaskTemplate): TemplateScore {
  const normalized = input.toLowerCase();
  let score = 0;
  const matchedPhrases: string[] = [];

  for (const signal of template.signals) {
    const phrase = signal.phrase?.trim();
    if (!phrase) continue;
    if (countMatches(normalized, phrase)) {
      score += signal.weight;
      matchedPhrases.push(phrase);
    }
  }

  return { id: template.id, score, matchedPhrases };
}

/**
 * Score raw input against every template and return the best match.
 * Pure + deterministic: ties break by (1) score, (2) number of matched
 * phrases, (3) alphabetical template id.
 *
 * `fallback` is passed in (rather than imported) so this module stays free
 * of JSON imports and can run under plain Node as well as Metro.
 */
export function classifyTask(
  rawInput: string,
  templates: TaskTemplate[],
  fallback: TaskTemplate,
): ClassificationResult {
  const input = (rawInput ?? '').trim();
  const scores = templates.map((template) => scoreTemplate(input, template));

  scores.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (b.matchedPhrases.length !== a.matchedPhrases.length) {
      return b.matchedPhrases.length - a.matchedPhrases.length;
    }
    return a.id.localeCompare(b.id);
  });

  const best = scores[0];
  const winner =
    best && best.score >= MIN_MATCH_SCORE
      ? templates.find((t) => t.id === best.id) ?? fallback
      : fallback;

  const winningScore =
    winner.id === fallback.id
      ? scores.find((s) => s.id === winner.id)?.score ?? 0
      : (best?.score ?? 0);
  const winningMatched =
    winner.id === fallback.id
      ? (scores.find((s) => s.id === winner.id)?.matchedPhrases ?? [])
      : (best?.matchedPhrases ?? []);

  return {
    template: winner,
    score: winningMatched.length === 0 && winner.id === fallback.id ? 0 : winningScore,
    matchedPhrases: winningMatched,
    scores,
  };
}
