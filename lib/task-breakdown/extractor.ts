/**
 * Lightweight regex-only extractor — no LLM, no network, no dependencies.
 *
 * Pulls realistic specifics (dates, times, money, counts, locations,
 * durations) out of raw input so step `{placeholders}` can be filled.
 * Anything not found falls back to a sensible default so no `{token}`
 * ever leaks into rendered output.
 */
import type { TaskTemplate } from './schema';

export type ExtractedValues = Record<string, string>;

/** Sensible defaults so every known placeholder always resolves. */
export const DEFAULT_PLACEHOLDER_VALUES: Record<string, string> = {
  task_name: 'your task',
  goal: 'your goal',
  topic: 'your topic',
  date: 'your target date',
  deadline: 'your deadline',
  time: 'a time that works for you',
  location: 'your chosen location',
  venue: 'your chosen venue',
  destination: 'your destination',
  budget: 'your budget',
  guest_count: 'your guest list',
  quantity: 'what you need',
  amount: 'what you need',
  duration: 'your timeline',
  timeline: 'your timeline',
  audience: 'your audience',
  attendees: 'your attendees',
  team: 'your team',
  name: 'the people involved',
  client: 'your client',
  role: 'the role',
  company: 'the company',
  platform: 'your chosen platform',
  tool: 'the tools you have',
  skill: 'the skill',
  subject: 'the subject',
  course: 'your course',
  project_name: 'your project',
  event_name: 'your event',
  trip_name: 'your trip',
  app_name: 'your app',
  product_name: 'your product',
  business_name: 'your business',
  dish: 'your dish',
  routine: 'your routine',
  habit: 'your habit',
  requirement: 'your requirements',
  milestone: 'your milestones',
};

const MONTHS =
  'january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sept|sep|oct|nov|dec';

function firstMatch(input: string, pattern: RegExp): string | null {
  const m = input.match(pattern);
  return m ? m[0].trim().replace(/\s+/g, ' ') : null;
}

function cleanListLabel(text: string): string {
  return text.trim().replace(/^(for|with|at|in|on|to|of)\s+/i, '').trim();
}

/**
 * Strip leading prepositions so templates can supply their own:
 * "by Friday" -> "Friday", "for 80 guests" -> "80 guests".
 * Templates always render values after their own prepositions
 * ("on {date}", "for {guest_count}"), so bare values prevent doubling.
 */
function stripLeadingPrepositions(text: string): string {
  let out = text.trim();
  for (let i = 0; i < 3; i++) {
    const next = out.replace(
      /^(by|before|until|due|on|in|for|at|to|within|over|from|across)\s+/i,
      '',
    );
    if (next === out) break;
    out = next;
  }
  return out.trim();
}

function extractDate(input: string): string | null {
  const raw =
    firstMatch(input, /\b\d{4}-\d{2}-\d{2}\b/) ??
    firstMatch(input, /\b\d{1,2}\/\d{1,2}(?:\/\d{2,4})?\b/) ??
    firstMatch(
      input,
      new RegExp(`\\b(?:on\\s+)?(?:${MONTHS})\\s+\\d{1,2}(?:st|nd|rd|th)?(?:,?\\s*\\d{4})?\\b`, 'i'),
    ) ??
    firstMatch(
      input,
      /\b(?:by|before|until|due)\s+(?:this\s+|next\s+)?(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday|week|weekend|month|friday)\b/i,
    ) ??
    firstMatch(input, /\b(?:next\s+(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday|week|month|year)|this\s+(?:weekend|week|month)|tomorrow|today|tonight)\b/i) ??
    firstMatch(input, /\bin\s+\d+\s+(?:days?|weeks?|months?|years?)\b/i);
  return raw ? stripLeadingPrepositions(raw) : null;
}

function extractTime(input: string): string | null {
  return (
    firstMatch(input, /\bat\s+\d{1,2}(?::\d{2})?\s*(?:am|pm)\b/i) ??
    firstMatch(input, /\b\d{1,2}:\d{2}\s*(?:am|pm)?\b/i)
  );
}

function extractBudget(input: string): string | null {
  return (
    firstMatch(input, /\$\s?\d[\d,]*(?:\.\d{1,2})?\s*(?:k\b)?/i) ??
    firstMatch(input, /\b\d[\d,]*\s*(?:dollars|usd|bucks)\b/i) ??
    firstMatch(input, /\bbudget(?:\s+of)?\s+[^.,;]{2,40}/i)
  );
}

function extractGuestCount(input: string): string | null {
  const raw =
    firstMatch(input, /\bfor\s+\d+\s*(?:guests|people|persons|attendees|kids|students|members)\b/i) ??
    firstMatch(input, /\b\d+\s*(?:guests|people|persons|attendees)\b/i);
  return raw ? stripLeadingPrepositions(raw) : null;
}

function extractQuantity(input: string): string | null {
  return firstMatch(
    input,
    /\b\d+\s*(?:pages?|chapters?|episodes?|videos?|posts?|items?|tasks?|steps?|questions?|songs?|photos?|miles|km|hours?|minutes?|days?|weeks?|months?|kg|lbs?|servings?|meals?)\b/i,
  );
}

function extractLocation(input: string): string | null {
  const candidates = [
    input.match(/\bin\s+([A-Z][A-Za-z'’.-]+(?:\s+[A-Z][A-Za-z'’.-]+){0,3})\b/),
    input.match(/\bat\s+([A-Z][A-Za-z'’&.-]+(?:\s+[A-Z][A-Za-z'’&.-]+){0,3})\b/),
    input.match(/\bto\s+([A-Z][A-Za-z'’.-]+(?:\s+[A-Z][A-Za-z'’.-]+){0,2})\b/),
  ];
  const skip = /^(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday|January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\b/i;
  for (const m of candidates) {
    if (m?.[1] && !/^(?:\d|AM|PM)\b/i.test(m[1]) && !skip.test(m[1].trim())) {
      return m[1].trim();
    }
  }
  return null;
}

function extractDuration(input: string): string | null {
  const raw =
    firstMatch(input, /\b\d+\s*-\s*day\b/i) ??
    firstMatch(input, /\b\d+\s+(?:days?|weeks?|months?|years?)\s+(?:long|trip|challenge|plan)\b/i) ??
    firstMatch(input, /\b(?:over|for|within)\s+\d+\s+(?:days?|weeks?|months?)\b/i);
  return raw ? stripLeadingPrepositions(raw) : null;
}

function shortTaskName(input: string): string {
  const oneLine = input.replace(/\s+/g, ' ').trim();
  const firstSentence = oneLine.split(/(?<=[.!?])\s+/)[0] ?? oneLine;
  const cleaned = firstSentence.replace(/^(i need to|i want to|i have to|please help me|help me to|help me)\s+/i, '').trim();
  if (!cleaned) return DEFAULT_PLACEHOLDER_VALUES.task_name;
  const titled = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
  return titled.length > 60 ? `${titled.slice(0, 57)}...` : titled;
}

/**
 * Short subject for name-like placeholders ({event_name}, {project_name},
 * {topic} …): the task name minus extracted detail fragments (dates,
 * counts, budgets) so "Celebrate {event_name}" reads naturally instead of
 * echoing the whole input sentence.
 */
function shortSubject(input: string, taskName: string): string {
  let subject = taskName.replace(/\.\.\.$/, '');
  // Cut at the first detail fragment (date, count, budget …) — everything
  // after it is logistics, not the subject itself.
  let cutAt = subject.length;
  for (const fragment of [
    extractDate(input),
    extractGuestCount(input),
    extractQuantity(input),
    extractBudget(input),
    extractTime(input),
  ]) {
    if (!fragment) continue;
    const idx = subject.toLowerCase().indexOf(fragment.toLowerCase());
    if (idx >= 0 && idx < cutAt) cutAt = idx;
  }
  subject = subject
    .slice(0, cutAt)
    .replace(/\s+/g, ' ')
    .replace(/[\s,;:]+$/g, '')
    .replace(/\s+(for|with|and|on|in|at|by|to|within|across|around|about|of|a|an|the)\s*$/i, '')
    .trim();
  if (!subject) return DEFAULT_PLACEHOLDER_VALUES.topic;
  const titled = subject.charAt(0).toUpperCase() + subject.slice(1);
  return titled.length > 48 ? `${titled.slice(0, 45)}...` : titled;
}

/**
 * Extract every supported detail from raw input. Returns the full bag;
 * the renderer picks only the placeholders a template declares.
 */
export function extractAllDetails(rawInput: string): ExtractedValues {
  const input = (rawInput ?? '').replace(/\s+/g, ' ').trim();
  const bag: ExtractedValues = {};

  const taskName = shortTaskName(input);
  bag.task_name = taskName;
  bag.goal = input.length > 140 ? `${input.slice(0, 137)}...` : input || DEFAULT_PLACEHOLDER_VALUES.goal;
  bag.topic = shortSubject(input, taskName);

  const date = extractDate(input);
  if (date) {
    bag.date = date;
    bag.deadline = date;
    bag.timeline = date;
  }
  const time = extractTime(input);
  if (time) bag.time = time;

  const budget = extractBudget(input);
  if (budget) bag.budget = budget;

  const guests = extractGuestCount(input);
  if (guests) {
    bag.guest_count = guests;
    bag.attendees = guests;
  }

  const qty = extractQuantity(input);
  if (qty) {
    bag.quantity = qty;
    bag.amount = qty;
  }

  const location = extractLocation(input);
  if (location) {
    bag.location = location;
    bag.venue = location;
    bag.destination = location;
  }

  const duration = extractDuration(input);
  if (duration) bag.duration = duration;

  const audience = firstMatch(input, /\bfor\s+(?:my\s+)?(?:team|family|friends|beginners|students|clients|followers|audience|kids)\b/i);
  if (audience) bag.audience = cleanListLabel(audience);

  // Named aliases default to the short subject so project/event/app
  // placeholders read naturally even when no proper noun is present.
  const subject = shortSubject(input, taskName);
  for (const alias of [
    'project_name',
    'event_name',
    'trip_name',
    'app_name',
    'product_name',
    'business_name',
  ]) {
    bag[alias] = subject;
  }

  return bag;
}

/** Extract only the placeholders a template declares (plus safe defaults). */
export function extractDetails(
  rawInput: string,
  template: TaskTemplate,
): ExtractedValues {
  const bag = extractAllDetails(rawInput);
  const out: ExtractedValues = {};
  for (const name of template.placeholders) {
    out[name] =
      bag[name] ?? DEFAULT_PLACEHOLDER_VALUES[name] ?? name.replace(/_/g, ' ');
  }
  return out;
}
