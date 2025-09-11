# Copilot & AI Agent Instructions for MindMate

Purpose: concise, actionable guidance so automated coding agents can make safe, high-value edits.

Core architectural notes
- AI flows live in `src/ai/flows/` and are registered via `src/ai/dev.ts`. Flows use Zod input/output schemas (see `chat-flow.ts`, `reword-task-flow.ts`).
- Genkit is configured in `src/ai/genkit.ts` and the project expects `npm run genkit:dev` to start the Genkit dev UI (http://localhost:4000).
- UI components: `src/components/`. Server/service logic: `src/services/`. Shared types: `src/lib/types.ts`.

Safety-first developer rules (must follow)
- Never write `undefined` to Firestore. Filter objects before writes. Example:

```js
function sanitizeForFirestore(obj) {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined));
}
```

- When updating nested settings (for example `users/<email>.googleTasksSettings`) merge with existing data instead of replacing. Example pattern:

```ts
const existing = (await getDoc(userRef)).data()?.googleTasksSettings || {};
const merged = { ...existing, ...newPartial, lastSyncAt: Date.now() };
await updateDoc(userRef, sanitizeForFirestore(merged));
```

- Server vs client separation: do NOT import server-only modules (`googleapis`, `fs`, `child_process`, `net`, `tls`) into client components. Put them behind API routes in `src/app/api/*` and call those from the client.
- Token handling: store `accessToken` and `refreshToken` when present. Check `tokenExpiresAt` and refresh server-side before API calls.
- Logging: redact secrets (e.g. `token?.slice(0,10) + '...'`).

Agent roles & process guidance
- GitHub Copilot / automated agents: perform small, safe edits, add tests or docs when changing behavior, and never perform high-risk refactors without human confirmation.
- Background sync and notification workers must run server-side only (do not bundle server libs into client builds).
- If a change affects user data (tokens, settings, tasks), include a short verification test or manual check in the PR description.

Developer workflows (exact commands)
- Install: `npm install`
- Start dev server: `npm run dev` (app usually served at http://localhost:9002)
- Start Genkit: `npm run genkit:dev` (Genkit UI at http://localhost:4000)
- Notification single-run (verify server running): POST to `/api/notifications/comprehensive-check?mode=single` (see README for examples).

What to reference when working
- `src/ai/flows/` — examples of Zod-driven flows and prompts (`chat-flow.ts`, `reword-task-flow.ts`).
- `src/ai/genkit.ts` — shows the Genkit + GoogleAI plugin configuration.
- `src/services/` — external integrations (Google Calendar/Tasks, notifications) and safe calling patterns.
- `src/lib/types.ts` — canonical types and schemas used across flows and UI.
- `agents.md` and `COPILOT_INSTRUCTIONS.md` — additional behavior rules and examples (already mirrored here).

Quick rules checklist for PRs
- Smallest safe change. Add a verification step for data/auth/sync changes. Redact tokens in logs. Merge partial updates for nested objects. Run dev + genkit locally to smoke test AI flows.

Emergency rollback
- If settings or token writes accidentally wipe critical fields: revert the commit, restore from backup if available, and re-run OAuth connect to re-issue tokens.

If anything here is unclear or you'd like more examples (e.g., a unit test template for flows, or a sanitization util export), tell me which area to expand and I'll update this file.
