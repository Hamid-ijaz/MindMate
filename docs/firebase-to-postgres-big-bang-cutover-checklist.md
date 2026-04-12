# Firebase to Postgres Big-Bang Cutover Checklist

## Purpose
This runbook defines the production cutover process from Firebase/Firestore to Postgres in one controlled window.

Status update (April 2026): Google task sync is legacy/transitional. Any checks that mention `/api/google/*` or `INTERNAL_API_KEY` are optional and apply only when legacy Google sync is enabled in the target environment.

It includes:
- Pre-cutover checks
- Freeze window steps
- Execution sequence
- Smoke tests
- Post-cutover verification
- Rollback plan
- Incident handling
- Approval gates with explicit go/no-go criteria

## Scope
In scope for this checklist:
- Data plane cutover for tasks, milestones, notes, accomplishments
- Scheduler/auth hardening checks for `CRON_AUTH_TOKEN`
- Optional legacy internal-header checks for `INTERNAL_API_KEY` when `/api/google/*` routes are enabled
- Validation of API behavior on cutover day

Out of scope:
- Feature development during the cutover window
- Non-critical UI refinements

## Roles And Owners
- Cutover Commander: owns timeline, gates, and go/no-go call
- DB Operator: snapshot/export/import/parity checks
- API Operator: route health and smoke tests
- Scheduler Operator: cron and token validation
- Scribe: records timestamps, decisions, and incident timeline

## Approval Gates And Go/No-Go Criteria

### Gate 0 - Pre-Cutover Readiness (T-24h to T-1h)
Required approvals:
- Engineering lead
- DBA/Platform owner
- Product owner

Go criteria:
- All required environment variables are present in deployment target:
  - `DATABASE_URL`
  - `CRON_AUTH_TOKEN`
- Optional (legacy Google sync only): `INTERNAL_API_KEY`
- Fresh Firebase export/snapshot exists and restore was spot-tested
- Migration/import scripts tested in staging with no data loss
- API paths required for cutover are available and tested:
  - `/api/tasks`
  - `/api/milestones`
  - `/api/notes`
  - `/api/accomplishments`
- On-call contacts and communication channels are confirmed

No-go criteria:
- Any required API path above returns `404` in the target release
- Missing or unknown `CRON_AUTH_TOKEN`
- Legacy Google sync is enabled, but `INTERNAL_API_KEY` is missing/unknown
- No validated backup/snapshot

### Gate 1 - Freeze Start (T-0)
Required approvals:
- Cutover Commander
- Product owner

Go criteria:
- User write freeze announced and active
- Background jobs that could mutate source/target are paused except controlled cutover jobs
- Team confirms no in-flight schema changes

No-go criteria:
- Freeze not enforced or cannot be verified

### Gate 2 - Data Migration Complete
Required approvals:
- DB Operator
- API Operator

Go criteria:
- Import completed without fatal errors
- Entity count parity is within accepted threshold (target: exact match)
- Spot checks for relational integrity pass

No-go criteria:
- Any critical table/entity mismatch that cannot be explained quickly

### Gate 3 - Smoke Tests Passed
Required approvals:
- API Operator
- Scheduler Operator

Go criteria:
- All P0 smoke tests pass (see smoke section)
- Scheduler auth checks pass:
  - Invalid/missing cron token rejected
  - Valid cron token accepted
  - Internal service key validation enforced

No-go criteria:
- Any P0 smoke test failure on tasks/milestones/notes/accomplishments
- Scheduler endpoint accepts unauthorized requests

### Gate 4 - Production Open
Required approvals:
- Cutover Commander final sign-off
- Product owner sign-off

Go criteria:
- Post-cutover verification checks pass
- Monitoring stable for initial observation window

No-go criteria:
- Error rate or data correctness outside agreed threshold

## Pre-Cutover Checks

### 1) Environment And Secrets
- Verify runtime env vars are set in production/staging:
  - `DATABASE_URL`
  - `CRON_AUTH_TOKEN`
   - Optional (legacy Google sync only): `INTERNAL_API_KEY`
- Verify secrets are stored in deployment secret manager (not plaintext in CI logs).

### 2) Backups And Restore Test
- Generate a final Firebase export snapshot.
- Record backup artifact location and timestamp.
- Perform a targeted restore dry run on non-prod to confirm recoverability.

### 3) Release Artifact And Schema
- Confirm cutover release artifact hash/tag.
- Confirm Postgres migrations are applied and schema version is expected.
- Confirm no pending migration drift.

### 4) API Readiness (Hard Requirement)
- Confirm these API paths exist and are routable in target build:
  - `/api/tasks`
  - `/api/milestones`
  - `/api/notes`
  - `/api/accomplishments`
- Confirm expected auth behavior:
  - Unauthenticated calls rejected
  - Authenticated owner calls succeed

### 5) Scheduler/Auth Readiness
- Confirm cron workflow sends `Authorization: Bearer <CRON_AUTH_TOKEN>`.
- If legacy Google sync is enabled, confirm internal service calls that use `x-user-email` also send `x-internal-api-key: <INTERNAL_API_KEY>`.

### 6) Operational Readiness
- Confirm on-call rotations and escalation path.
- Open incident bridge before cutover starts.

## Freeze Window Steps
1. Announce freeze start in engineering and product channels.
2. Disable UI writes or place app in maintenance mode for mutating flows.
3. Pause non-essential schedulers/workers that can write data.
4. Block manual admin writes outside cutover process.
5. Capture final source snapshot timestamp at freeze boundary.
6. Confirm all teams acknowledge freeze.

## Execution Sequence

### Step 1 - Final Export
1. Run final Firebase export at freeze boundary.
2. Record counts for source entities:
   - tasks
   - milestones
   - notes
   - accomplishments

### Step 2 - Import To Postgres
1. Run import in dependency-safe order.
2. Capture import logs and rejected record report.
3. Re-run idempotent retries for transient failures.

### Step 3 - Parity Validation
1. Compare source vs target counts for all four entities.
2. Run checksum/sample validation for selected users.
3. Validate foreign key/reference integrity where applicable.

### Step 4 - Switch Traffic
1. Deploy/activate Postgres-backed release.
2. Re-enable app traffic (still under heightened monitoring).
3. Re-enable scheduler only after auth checks pass.

### Step 5 - Execute Smoke Tests
Run all smoke tests below. If any P0 fails, pause and evaluate rollback.

## Smoke Tests

Run using an authenticated test user cookie in lower env before prod, then in prod after switch.

### A) Tasks API Path Checks (`/api/tasks`)
1. GET list
   - Request: `GET /api/tasks?userEmail=<test-user-email>`
   - Expect: `200`, response contains `tasks` array
2. POST create
   - Request: `POST /api/tasks` with `userEmail` and valid `task`
   - Expect: `200`, response contains `taskId`
3. Auth boundary
   - Mismatched cookie user vs `userEmail`
   - Expect: `403`

### B) Milestones API Path Checks (`/api/milestones`)
1. GET list
   - Request: `GET /api/milestones?userEmail=<test-user-email>`
   - Expect: `200`, `success: true`, `milestones` array
2. POST create
   - Request: `POST /api/milestones` with `userEmail` and milestone payload
   - Expect: `200`, `success: true`, `milestoneId`
3. Auth boundary
   - Mismatched cookie user vs `userEmail`
   - Expect: `403`

### C) Notes API Path Checks (`/api/notes`)
1. GET list
   - Request: `GET /api/notes?userEmail=<test-user-email>`
   - Expect: `200` and list payload
2. POST create
   - Request: `POST /api/notes` with valid note payload
   - Expect: `200` and created ID
3. PUT/PATCH update (if implemented)
   - Expect: successful update status
4. DELETE remove
   - Expect: successful delete status

P0 rule:
- Any `404` on `/api/notes` is an immediate no-go for big-bang cutover.

### D) Accomplishments API Path Checks (`/api/accomplishments`)
1. GET list
   - Request: `GET /api/accomplishments?userEmail=<test-user-email>`
   - Expect: `200` and list payload
2. POST create
   - Request: `POST /api/accomplishments` with valid payload
   - Expect: `200` and created ID
3. DELETE remove (if implemented)
   - Expect: successful delete status

P0 rule:
- Any `404` on `/api/accomplishments` is an immediate no-go for big-bang cutover.

### E) Scheduler/Auth Checks

#### E1. CRON_AUTH_TOKEN Enforcement (`/api/notifications/comprehensive-check?mode=single`)
1. Missing token
   - Request: POST without `Authorization`
   - Expect: `401 Unauthorized`
2. Wrong token
   - Request: `Authorization: Bearer wrong-token`
   - Expect: `401 Unauthorized`
3. Correct token
   - Request: `Authorization: Bearer <CRON_AUTH_TOKEN>`
   - Expect: `200` with `success: true`

PowerShell examples:
```powershell
# Missing token -> expect 401
Invoke-WebRequest -Uri "https://<host>/api/notifications/comprehensive-check?mode=single" -Method POST

# Wrong token -> expect 401
Invoke-WebRequest -Uri "https://<host>/api/notifications/comprehensive-check?mode=single" -Method POST -Headers @{ Authorization = "Bearer wrong-token" }

# Correct token -> expect 200
Invoke-WebRequest -Uri "https://<host>/api/notifications/comprehensive-check?mode=single" -Method POST -Headers @{ Authorization = "Bearer <CRON_AUTH_TOKEN>" }
```

#### E2. INTERNAL_API_KEY Enforcement (Optional Legacy `/api/google/sync` Path)
Run this section only when legacy Google sync routes are enabled.

1. With `x-user-email`, missing `x-internal-api-key`
   - Expect: `401 Unauthorized`
2. With wrong internal key
   - Expect: `401 Unauthorized`
3. With correct internal key
   - Expect: authenticated processing (not `401`)

PowerShell example:
```powershell
$body = @{ action = "intervalSync"; userEmail = "<test-user-email>" } | ConvertTo-Json

# Missing internal key -> expect 401
Invoke-WebRequest -Uri "https://<host>/api/google/sync" -Method POST -ContentType "application/json" -Headers @{ "x-user-email" = "<test-user-email>" } -Body $body

# Correct key -> expect non-401
Invoke-WebRequest -Uri "https://<host>/api/google/sync" -Method POST -ContentType "application/json" -Headers @{ "x-user-email" = "<test-user-email>"; "x-internal-api-key" = "<INTERNAL_API_KEY>" } -Body $body
```

## Post-Cutover Verification

### 0-30 Minutes
- Monitor API error rate and latency.
- Confirm scheduler executes and completes with valid auth only.
- Verify no unauthorized scheduler invocations succeed.

### 30-120 Minutes
- Re-run entity count parity on recent writes.
- Validate task and milestone creations persist and are queryable.
- Validate notes/accomplishments create+read on live traffic.

### First 24 Hours
- Audit top endpoints for 4xx/5xx regressions.
- Validate no data drift between expected write volume and Postgres inserts.
- Confirm notification and digest cadence is normal.

## Rollback Plan

Rollback trigger examples:
- P0 smoke failure on any required API path
- Sustained 5xx above agreed threshold
- Data correctness issue on core entities
- Auth bypass detected on scheduler/internal endpoints

Rollback steps:
1. Declare rollback in incident bridge and freeze further writes.
2. Disable scheduler trigger (GitHub Actions/manual cron).
3. Route traffic back to last known-good Firebase-backed release.
4. Restore source-of-truth write path to Firebase.
5. Validate critical user journeys:
   - task create/read
   - milestone create/read
   - notes/accomplishments read/write behavior
6. Publish rollback completion note with timestamps and impact.

Post-rollback:
- Preserve Postgres cutover logs and failed record snapshots.
- Perform root-cause analysis before next cutover attempt.

## Incident Handling

### Severity Levels
- SEV-1: data loss risk, auth bypass, or complete API outage
- SEV-2: partial degradation with workaround
- SEV-3: minor issues not blocking core flows

### Incident Workflow
1. Open incident and assign Incident Commander.
2. Capture start time, affected endpoints, and blast radius.
3. Apply containment first (disable scheduler, freeze writes, reduce traffic).
4. Decide recover-forward vs rollback within 15 minutes for SEV-1.
5. Communicate status every 15 minutes until resolved.

### Mandatory Artifacts
- Timeline of actions and decisions
- Failed request samples (redacted)
- Parity report before and after incident
- Final resolution and follow-up actions

## Cutover Day Sign-Off Template

Use this template in the release channel:

```text
Cutover: Firebase -> Postgres (Big-Bang)
Start Time:
Freeze Start:
Gate 0: PASS/FAIL
Gate 1: PASS/FAIL
Gate 2: PASS/FAIL
Gate 3: PASS/FAIL
Gate 4: PASS/FAIL
Rollback Triggered: YES/NO
Incidents: NONE / <ticket ids>
Commander Sign-Off:
Product Sign-Off:
```

## Quick Go/No-Go Summary
Go only if all are true:
- Required API paths are present and pass smoke tests:
  - `/api/tasks`, `/api/milestones`, `/api/notes`, `/api/accomplishments`
- `CRON_AUTH_TOKEN` enforcement verified (`401` for invalid, `200` for valid)
- If legacy Google sync is enabled: `INTERNAL_API_KEY` enforcement verified for internal header flow
- Data parity checks pass for tasks/milestones/notes/accomplishments

No-go if any are true:
- Missing required API path (`404`)
- Scheduler/internal auth bypass
- Unresolved critical data mismatch