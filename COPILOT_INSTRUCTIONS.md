Copilot / Assistant Instructions

Purpose
- Provide concise, actionable guidance for future automated edits and human collaborators.

Primary rules (must always follow)

1. Never save `undefined` to Firebase/Firestore
   - Firestore rejects `undefined` values and this causes runtime errors ("Unsupported field value: undefined").
   - Always remove or omit `undefined` before calling `setDoc`, `updateDoc`, or `set`.
   - Use a helper to sanitize objects:

     function sanitizeForFirestore(obj) {
       return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined));
     }

2. Server vs Client separation
   - Do not import server-only modules (for example `googleapis`, `fs`, `net`, `tls`, `child_process`) inside React client components or files that run in the browser.
   - Put code that uses server-only libraries behind API routes (for example under `src/app/api/*` or `src/pages/api/*` depending on routing) and call them from the client.

3. Merging partial updates
   - When updating nested objects (for example `googleTasksSettings` on the `users/<email>` document), merge existing data with new data instead of blindly replacing it.
   - Example pattern using Firestore client helper:

     const existing = (await getDoc(userRef)).data()?.googleTasksSettings || {};
     const merged = { ...existing, ...newPartial, lastSyncAt: Date.now() };
     const sanitized = sanitizeForFirestore(merged);
     await updateDoc(userRef, { googleTasksSettings: sanitized });

4. Token handling
   - Store both `accessToken` and `refreshToken` when present.
   - Always check token expiry (`tokenExpiresAt`) and refresh server-side before making API calls.

5. Logging & Secrets
   - Never log full tokens or secrets. Mask them in logs (for example `token?.substring(0,10) + '...'`).

6. Tests and verification
   - After making changes that touch sync, auth, or persistence, add or update a small test or manual verification steps in the PR description.

File and repo conventions
- Code that interacts with external services should live in `src/services/*` and be used only by server-side code or API routes.
- Client-side hooks (for example `useGoogleTasksSync`) must only call internal API routes and must not import server-only services.

Emergency rollback
- If a settings write accidentally wipes tokens or critical fields, restore from backup or revert the commit and re-run the OAuth connect flow to re-issue tokens.

If you are asked to make code changes, apply the smallest safe change that satisfies the request and include a short verification checklist in the commit message or PR.
