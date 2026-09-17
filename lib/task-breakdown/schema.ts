/**
 * Template schema for the deterministic, rule-based task breakdown system.
 *
 * No network / AI calls here — pure types + validation. AI may be used
 * during development to help *author* JSON content, but never at runtime.
 */

/** Schema version stamped on every template JSON file. */
export const TEMPLATE_SCHEMA_VERSION = 1;

/** Id of the domain-agnostic fallback template. */
export const FALLBACK_TEMPLATE_ID = 'generic-fallback';

/** A weighted keyword/phrase signal used by the classifier. */
export type TemplateSignal = {
  phrase: string;
  weight: number;
};

/** One ordered step inside a template. */
export type TemplateStep = {
  title: string;
  /** May contain {placeholders} filled by the extractor at runtime. */
  description: string;
};

/** A full task template as stored in `templates/*.json`. */
export type TaskTemplate = {
  schemaVersion: number;
  id: string;
  category_name: string;
  signals: TemplateSignal[];
  /** Placeholder names (snake_case) usable in step descriptions. */
  placeholders: string[];
  steps: TemplateStep[];
};

export type TemplateValidationResult = {
  valid: boolean;
  errors: string[];
};

const ID_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const PLACEHOLDER_NAME_PATTERN = /^[a-z][a-z0-9_]*$/;
const PLACEHOLDER_USE_PATTERN = /\{([a-zA-Z0-9_]+)\}/g;

/** All `{names}` referenced inside a string. */
export function extractPlaceholderNames(text: string): string[] {
  const names: string[] = [];
  PLACEHOLDER_USE_PATTERN.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = PLACEHOLDER_USE_PATTERN.exec(text)) !== null) {
    if (!names.includes(match[1])) {
      names.push(match[1]);
    }
  }
  return names;
}

/**
 * Validate an unknown parsed JSON value against the template schema.
 * Hand-rolled (no Zod/dependency) so it runs anywhere, including RN.
 */
export function validateTemplate(value: unknown): TemplateValidationResult {
  const errors: string[] = [];

  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return { valid: false, errors: ['Template must be a JSON object.'] };
  }

  const t = value as Partial<TaskTemplate>;

  if (t.schemaVersion !== TEMPLATE_SCHEMA_VERSION) {
    errors.push(
      `schemaVersion must be exactly ${TEMPLATE_SCHEMA_VERSION} (got ${String(t.schemaVersion)}).`,
    );
  }

  if (typeof t.id !== 'string' || !ID_PATTERN.test(t.id)) {
    errors.push('id must be kebab-case (e.g. "wedding-planning").');
  }

  if (typeof t.category_name !== 'string' || t.category_name.trim().length === 0) {
    errors.push('category_name must be a non-empty string.');
  }

  if (!Array.isArray(t.signals) || t.signals.length < 3 || t.signals.length > 20) {
    errors.push('signals must be an array of 3-20 weighted phrases.');
  } else {
    const seen = new Set<string>();
    t.signals.forEach((signal, i) => {
      if (!signal || typeof signal !== 'object') {
        errors.push(`signals[${i}] must be an object.`);
        return;
      }
      const phrase = (signal as Partial<TemplateSignal>).phrase;
      const weight = (signal as Partial<TemplateSignal>).weight;
      if (typeof phrase !== 'string' || phrase.trim().length < 2 || phrase.trim().length > 60) {
        errors.push(`signals[${i}].phrase must be a 2-60 char string.`);
      } else {
        const key = phrase.trim().toLowerCase();
        if (seen.has(key)) {
          errors.push(`signals[${i}].phrase is duplicated ("${phrase}").`);
        }
        seen.add(key);
      }
      if (
        typeof weight !== 'number' ||
        !Number.isInteger(weight) ||
        weight < 1 ||
        weight > 5
      ) {
        errors.push(`signals[${i}].weight must be an integer 1-5.`);
      }
    });
  }

  if (
    !Array.isArray(t.placeholders) ||
    t.placeholders.some(
      (p) => typeof p !== 'string' || !PLACEHOLDER_NAME_PATTERN.test(p),
    )
  ) {
    errors.push('placeholders must be an array of snake_case names.');
  }

  const declared = new Set(
    Array.isArray(t.placeholders) ? (t.placeholders as string[]) : [],
  );
  if (declared.size !== (Array.isArray(t.placeholders) ? t.placeholders.length : -1)) {
    errors.push('placeholders must not contain duplicates.');
  }

  if (!Array.isArray(t.steps) || t.steps.length < 5 || t.steps.length > 12) {
    errors.push('steps must be an ordered array of 5-12 steps.');
  } else {
    t.steps.forEach((step, i) => {
      if (!step || typeof step !== 'object') {
        errors.push(`steps[${i}] must be an object.`);
        return;
      }
      const title = (step as Partial<TemplateStep>).title;
      const description = (step as Partial<TemplateStep>).description;
      if (typeof title !== 'string' || title.trim().length < 4 || title.trim().length > 90) {
        errors.push(`steps[${i}].title must be 4-90 chars.`);
      }
      if (
        typeof description !== 'string' ||
        description.trim().length < 10 ||
        description.trim().length > 500
      ) {
        errors.push(`steps[${i}].description must be 10-500 chars.`);
      } else {
        for (const name of extractPlaceholderNames(description)) {
          if (!declared.has(name)) {
            errors.push(
              `steps[${i}].description uses undeclared placeholder "{${name}}".`,
            );
          }
        }
        for (const name of extractPlaceholderNames(
          typeof title === 'string' ? title : '',
        )) {
          if (!declared.has(name)) {
            errors.push(`steps[${i}].title uses undeclared placeholder "{${name}}".`);
          }
        }
      }
    });
  }

  return { valid: errors.length === 0, errors };
}
