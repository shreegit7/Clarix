# Clarix

Expo Router app for turning pasted work into structured briefs and tasks with Supabase auth/storage.

## Local setup

1. Install dependencies:

```bash
npm install
```

2. Create `.env` from `.env.example` and fill in your Supabase project values.

3. Apply Supabase migrations, including the new `brief_payload` migration.

4. No AI keys needed — task breakdowns are generated on-device by
   `lib/task-breakdown` (deterministic templates, no network calls).
   The legacy `summarize-email` Edge Function is retired and no longer
   invoked by the client.

## Commands

```bash
npm run dev
npm run lint
npm run typecheck
```

## Architecture notes

- Task breakdowns are generated on-device by `lib/task-breakdown`
  (weighted-keyword classifier + regex extractor + JSON templates).
  No AI/LLM API is called at runtime.
- Assistant briefs are stored in `chats.brief_payload` as structured JSON.
- Existing assistant chat rows still render through a fallback parser until all environments run the migration.
