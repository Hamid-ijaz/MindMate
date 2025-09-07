# Agents used in this repository

This project uses automated coding and runtime agents. Keep agent responsibilities clear and minimal.

- GitHub Copilot
  - Role: automated coding assistant used to make code edits, refactors, and add tests or documentation on request.
  - Behavior rules:
    - Do not make high-risk, wide-scope changes without explicit user confirmation.
    - When editing code that touches production data, follow the repo's safety rules (see below).

- Background Sync Worker (server-side)
  - Role: periodic/background sync of external services (Google Tasks, calendars, etc.).
  - Must run in server environment only. Never bundle server-only libraries into client code.

- Local Developer (human)
  - Role: review and approve PRs, test OAuth flows with real credentials, and deploy changes.

Important repository rules (enforced for all agents):

- Never write `undefined` into Firestore or Firebase Realtime Database. Firestore rejects `undefined` fields; saving them can cause runtime errors and corrupt state.
  - Always filter out `undefined` values before calling `setDoc` / `updateDoc`.
  - Example safe pattern:

    const data = { a: 1, b: undefined, c: 'x' };
    const filtered = Object.fromEntries(Object.entries(data).filter(([, v]) => v !== undefined));
    await updateDoc(docRef, filtered);

- Server-only libraries (for example `googleapis`, `fs`, `net`, `tls`, `child_process`) MUST only be imported in server-side code (API routes, server utils). Client components must call API routes instead.

- When updating complex objects (settings), always merge with existing values instead of replacing the entire object unless explicitly intended. This prevents accidental deletion of tokens or config.

- Logging: redact sensitive tokens in logs (show only first N characters).


If an automated agent performs any action that affects user data (tokens, settings, tasks), the change must be accompanied by a short test or verification step logged in the PR description.
