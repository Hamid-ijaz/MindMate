# Archived: Firebase to Postgres Big-Bang Cutover Checklist

Status: historical runbook retained for audit context only. The Firebase to Postgres cutover is complete and this checklist is no longer operational.

## Current Architecture

- Postgres is the system of record.
- Active operations should follow current Postgres runbooks and deployment procedures.
- Firebase export/import and Firebase-specific cutover execution are not part of current production workflows.

## Historical Scope (Retired)

This retired checklist previously covered:

- pre-cutover readiness and freeze-window coordination
- migration execution and parity validation
- smoke tests, approval gates, and rollback decisions

This file intentionally omits actionable Firebase setup or execution steps to avoid using deprecated procedures.
