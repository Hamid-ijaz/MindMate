# MindMate n8n Scheduler Workflows

This folder contains importable n8n workflow templates for MindMate scheduled API jobs.

## Required n8n environment variables

- `MINDMATE_BASE_URL` (example: `http://127.0.0.1:3000`)
- `MINDMATE_CRON_AUTH_TOKEN` (must match app `CRON_AUTH_TOKEN`)

## Included templates

- `mindmate-comprehensive-check.workflow.json`
  - Calls `/api/notifications/comprehensive-check?mode=single`
  - Default schedule: every 1 minute

- `mindmate-overdue-check.workflow.json`
  - Calls `/api/notifications/trigger-overdue-check`
  - Default schedule: daily at 18:00 UTC

## Import instructions

1. In n8n, open Workflows.
2. Use Import from file.
3. Select one of the workflow JSON files.
4. Activate workflow after validation.

## Validation

1. Run each workflow once manually.
2. Confirm HTTP node returns status 200.
3. Confirm MindMate app logs show authorized request handling.
