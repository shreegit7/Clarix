/**
 * Renderer — takes a matched template + extracted values and outputs the
 * final breakdown as both plain text (for simple display / sharing) and
 * structured JSON (EmailBrief + KanbanPlan) for the existing UI.
 *
 * Pure + synchronous. No network, no AI.
 */
import type { EmailBrief, KanbanPlan, KanbanSubtask } from '@/lib/briefs';
import { DEFAULT_PLACEHOLDER_VALUES, type ExtractedValues } from './extractor';
import type { TaskTemplate } from './schema';

export type RenderedBreakdown = {
  text: string;
  brief: EmailBrief;
};

export function humanizePlaceholder(name: string): string {
  return (
    DEFAULT_PLACEHOLDER_VALUES[name] ?? name.replace(/_/g, ' ') ?? 'the details'
  );
}

/** Substitute every {placeholder} — never leaves a raw {token} behind. */
export function fillPlaceholders(
  text: string,
  values: ExtractedValues,
): string {
  return text.replace(/\{([a-zA-Z0-9_]+)\}/g, (_match, name: string) => {
    const value = values[name]?.trim();
    if (value) return value;
    return humanizePlaceholder(name);
  });
}

function toTitleCase(text: string): string {
  const cleaned = text.replace(/\s+/g, ' ').trim();
  if (!cleaned) return 'Untitled task';
  const titled = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
  return titled.length > 72 ? `${titled.slice(0, 69)}...` : titled;
}

function parseDeadlineToISO(dateText: string | undefined): string | null {
  if (!dateText) return null;
  const lowered = dateText.toLowerCase();
  if (
    lowered.includes('your target date') ||
    lowered.includes('your deadline') ||
    lowered.includes('your timeline')
  ) {
    return null;
  }
  const iso = firstIsoDate(dateText);
  if (iso) return iso;
  const parsed = Date.parse(dateText.replace(/^(by|before|until|due|on)\s+/i, ''));
  if (!Number.isNaN(parsed)) return new Date(parsed).toISOString();
  return null;
}

function firstIsoDate(text: string): string | null {
  const m = text.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
  if (!m) return null;
  const d = new Date(`${m[1]}-${m[2]}-${m[3]}T23:59:00`);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/** Plain-text numbered breakdown, e.g. for sharing or simple rendering. */
export function renderPlainText(
  template: TaskTemplate,
  values: ExtractedValues,
  sourceInput: string,
): string {
  const taskName = values.task_name ?? sourceInput;
  const lines = [
    `Breakdown for: ${taskName}`,
    `Category: ${template.category_name} (${template.id})`,
    '',
  ];
  template.steps.forEach((step, i) => {
    lines.push(`${i + 1}. ${fillPlaceholders(step.title, values)}`);
    lines.push(`   ${fillPlaceholders(step.description, values)}`);
  });
  return lines.join('\n');
}

/**
 * Full structured render: plain text + EmailBrief (with embedded
 * KanbanPlan) so BriefCard / TaskFlowchart / KanbanBoard render unchanged.
 */
export function renderBreakdown(
  template: TaskTemplate,
  values: ExtractedValues,
  sourceInput: string,
): RenderedBreakdown {
  const taskName = values.task_name ?? shortFallback(sourceInput);
  const text = renderPlainText(template, values, sourceInput);

  const filledTitles = template.steps.map((step) =>
    fillPlaceholders(step.title, values),
  );
  const filledDescriptions = template.steps.map((step) =>
    fillPlaceholders(step.description, values),
  );

  const subtasks: KanbanSubtask[] = template.steps.map((step, index) => ({
    id: `step_${index + 1}`,
    title: filledTitles[index],
    notes: filledDescriptions[index],
    column: index === 0 ? 'in_progress' : 'todo',
    order: index,
    dependencies: index === 0 ? [] : [`step_${index}`],
    completedAt: null,
    type: 'step',
  }));

  const timeLabel =
    values.time && values.time !== DEFAULT_PLACEHOLDER_VALUES.time
      ? values.time
      : 'No set time';

  const deadlineAt =
    parseDeadlineToISO(values.deadline) ?? parseDeadlineToISO(values.date);

  const summary =
    filledDescriptions[0].length > 180
      ? `${filledDescriptions[0].slice(0, 177)}...`
      : filledDescriptions[0];

  const kanbanPlan: KanbanPlan = {
    generatedAt: new Date().toISOString(),
    sourceTask: sourceInput.trim().slice(0, 500),
    contextAnswers: [],
    subtasks,
    nodes: subtasks,
    edges: subtasks.slice(1).map((sub, i) => ({
      from: subtasks[i].id,
      to: sub.id,
    })),
  };

  const brief: EmailBrief = {
    title: toTitleCase(taskName),
    summary,
    timeLabel,
    deadlineAt,
    priority: 'medium',
    actionItems: filledTitles.slice(0, 5),
    kanbanPlan,
  };

  return { text, brief };
}

function shortFallback(input: string): string {
  const cleaned = (input ?? '').replace(/\s+/g, ' ').trim();
  return cleaned || 'your task';
}
