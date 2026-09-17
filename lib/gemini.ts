/**
 * Offline-first task breakdown entry point.
 *
 * Previously this module called Gemini's API at runtime. It is now fully
 * deterministic: `breakdownTask()` (weighted-keyword classifier + regex
 * extractor + template renderer) runs on-device with zero network calls,
 * zero API keys, and zero dependencies beyond the template JSON files.
 *
 * Exported function names/signatures are unchanged so existing screens
 * (Briefs tab, BriefFollowUpSheet) keep working with no UI changes.
 * Briefs are still persisted to Supabase via `insertBriefRows` below.
 */
import type { EmailBrief, KanbanPlan } from '@/lib/briefs';
import type {
  FollowUpQuestion,
  UserAiContextResponse,
} from '@/lib/ai-context';
import {
  getSupabaseErrorMessage,
  isMissingColumnError,
  supabase,
} from '@/lib/supabase';
import { breakdownTask } from '@/lib/task-breakdown';

type CreatedBriefResponse = {
  brief: EmailBrief;
  assistantChat: {
    id: string;
    created_at: string;
  };
};

export type ValidationResult = {
  isValid: boolean;
  reason: string;
};

const GREETING_OR_NOISE =
  /^(hi|hello|hey|yo|sup|howdy|good\s?(morning|afternoon|evening)|test|testing|asdf|qwerty|abc|123+)\W*$/i;

/**
 * Rule-based task validation (no network). Permissive by design: anything
 * that looks like an actionable goal passes; obvious non-tasks are rejected
 * and truly ambiguous input falls through to the generic template.
 */
export async function validateTaskInput(
  input: string,
): Promise<ValidationResult> {
  const trimmed = (input ?? '').trim();

  if (trimmed.length < 3) {
    return {
      isValid: false,
      reason: 'Please enter a clear actionable task like "Plan my wedding in June".',
    };
  }

  if (!/[a-zA-Z]/.test(trimmed)) {
    return {
      isValid: false,
      reason: 'Please describe your task using words, not just numbers or symbols.',
    };
  }

  if (GREETING_OR_NOISE.test(trimmed)) {
    return {
      isValid: false,
      reason:
        "That doesn't look like a task yet. Try something like 'Build a mobile app' or 'Plan my marketing strategy'.",
    };
  }

  return { isValid: true, reason: '' };
}

type KanbanGenerationArgs = {
  sourceTask: string;
  brief: EmailBrief;
  responses: UserAiContextResponse[];
};

/**
 * Deterministic follow-up questions (no network). Same 5-stage order the
 * app has always used: scope -> audience -> timeline -> resources ->
 * requirements. Signature unchanged for BriefFollowUpSheet.
 */
const STATIC_FOLLOW_UP_QUESTIONS: FollowUpQuestion[] = [
  {
    id: 'q_1',
    question: 'What does success look like for this task?',
    options: ['A finished result', 'A clear plan', 'Steady progress'],
    otherLabel: 'Other',
  },
  {
    id: 'q_2',
    question: 'Who is this for?',
    options: ['Just me', 'My team', 'Clients or audience'],
    otherLabel: 'Other',
  },
  {
    id: 'q_3',
    question: 'When do you need this done?',
    options: ['ASAP', 'This week', 'No rush'],
    otherLabel: 'Other',
  },
  {
    id: 'q_4',
    question: 'What resources do you already have?',
    options: ['Time only', 'Some tools or budget', 'A team to help'],
    otherLabel: 'Other',
  },
  {
    id: 'q_5',
    question: 'Any must-have requirements or preferences?',
    options: ['High quality', 'Low cost', 'Simple steps'],
    otherLabel: 'Other',
  },
];

export async function generateNextFollowUpQuestion(
  _userTask: string,
  questionNumber: number,
  _previousAnswers: UserAiContextResponse[],
): Promise<FollowUpQuestion | null> {
  return STATIC_FOLLOW_UP_QUESTIONS[questionNumber - 1] ?? null;
}

async function insertBriefRows(
  userId: string,
  emailText: string,
  brief: EmailBrief,
) {
  const trimmedEmail = emailText.trim().slice(0, 12000);

  const insertWithPayload = await supabase
    .from('chats')
    .insert([
      {
        user_id: userId,
        message: trimmedEmail,
        role: 'user',
        file_urls: [],
      },
      {
        user_id: userId,
        message: brief.summary,
        role: 'assistant',
        file_urls: [],
        brief_payload: brief,
      },
    ])
    .select('id, created_at, role');

  const fallbackInsert =
    insertWithPayload.error &&
    isMissingColumnError(insertWithPayload.error, 'brief_payload')
      ? await supabase
          .from('chats')
          .insert([
            {
              user_id: userId,
              message: trimmedEmail,
              role: 'user',
              file_urls: [],
            },
            {
              user_id: userId,
              message: JSON.stringify(brief),
              role: 'assistant',
              file_urls: [],
            },
          ])
          .select('id, created_at, role')
      : null;

  const rows = insertWithPayload.data ?? fallbackInsert?.data;
  const writeError = fallbackInsert?.error ?? insertWithPayload.error;

  if (writeError) {
    throw new Error(getSupabaseErrorMessage(writeError, 'Failed to save brief'));
  }

  const assistantChat = rows?.find((row) => row.role === 'assistant');

  if (!assistantChat) {
    throw new Error('Assistant chat was not created');
  }

  return assistantChat;
}

/**
 * Deterministic kanban plan from the matched template (no network).
 * Follow-up answers are preserved on the plan and folded into the first
 * step's notes, mirroring the previous fallback behavior.
 */
export async function generateKanbanPlan({
  sourceTask,
  brief,
  responses,
}: KanbanGenerationArgs): Promise<KanbanPlan> {
  const taskText = (sourceTask || '').trim() || brief.title;
  const result = breakdownTask(taskText);
  const basePlan = result.brief.kanbanPlan;

  if (!basePlan) {
    throw new Error('Breakdown did not produce a plan');
  }

  const contextAnswers = responses.slice(0, 5).map((response) => ({
    question: response.question,
    answer: response.answer,
  }));
  const contextLine = contextAnswers
    .map((entry) => entry.answer)
    .filter(Boolean)
    .join(' | ')
    .slice(0, 120);

  const subtasks = basePlan.subtasks.map((subtask, index) => {
    if (index !== 0 || !contextLine) return subtask;
    return {
      ...subtask,
      notes: subtask.notes
        ? `${subtask.notes} (Context: ${contextLine})`
        : `Context: ${contextLine}`,
    };
  });

  return {
    ...basePlan,
    sourceTask: taskText,
    contextAnswers,
    subtasks,
    nodes: subtasks,
  };
}

/**
 * Build a brief entirely on-device via the rule-based breakdown engine,
 * then persist it to Supabase exactly as before.
 */
export async function createBriefFromEmail(
  emailText: string,
): Promise<CreatedBriefResponse> {
  const trimmedEmail = emailText.trim();

  if (!trimmedEmail) {
    throw new Error('emailText is required');
  }

  const { brief } = breakdownTask(trimmedEmail);

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    throw new Error('You must be signed in to create briefs');
  }

  const assistantChat = await insertBriefRows(user.id, trimmedEmail, brief);

  return {
    brief,
    assistantChat: {
      id: assistantChat.id,
      created_at: assistantChat.created_at,
    },
  };
}
