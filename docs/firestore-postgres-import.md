# Archived: Firestore -> Postgres Import

Status: historical reference only. The one-time Firestore import utility and its npm script were removed after migration completion.

## Current Architecture

- Production runtime uses Postgres via Prisma.
- There are no active Firebase Admin credential requirements for normal runtime operations.
- This document is retained only for migration history and audit context.

## Historical Scope (Retired)

The retired importer migrated these entities:

- users
- tasks
- notes
- accomplishments
- milestones