# Firestore -> Postgres Import Script

This repository includes a one-time migration script that imports core Firestore entities into Postgres using Prisma.

Imported entities:
- users
- tasks
- notes
- accomplishments
- milestones

The script is idempotent for these entities by using Prisma upserts on primary keys (`email` for users, `id` for the other models).

## Required Environment Variables

### Postgres (required)
- `DATABASE_URL`

### Firebase Admin credentials (use one option)

Option 1:
- `FIREBASE_SERVICE_ACCOUNT_JSON` (full service account JSON string)

Option 2:
- `FIREBASE_PROJECT_ID`
- `FIREBASE_CLIENT_EMAIL`
- `FIREBASE_PRIVATE_KEY` (use `\\n` for line breaks in env files)

Option 3:
- `GOOGLE_APPLICATION_CREDENTIALS` (Application Default Credentials)

## Exact Run Commands

Dry run (recommended first):

```bash
npm run import:firestore:postgres -- --dry-run
```

Live import:

```bash
npm run import:firestore:postgres
```

Optional flags:

```bash
# Import only selected entities
npm run import:firestore:postgres -- --entities=users,tasks

# Change concurrent batch size (default: 100)
npm run import:firestore:postgres -- --batch-size=50
```

## Behavior Notes

- The importer strips `undefined` recursively before any Prisma write payload is sent.
- In dry-run mode, Firestore data is read and validated but no Postgres writes are performed.
- Task parent relationships are linked in a second pass after task upserts to reduce foreign key ordering issues.
- Milestones are read from both top-level `milestones` and `collectionGroup('milestones')` paths, then deduplicated by document path.