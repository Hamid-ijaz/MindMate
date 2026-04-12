# Docker to GHCR to VM Deployment

This project can be deployed with GitHub Actions by building a Docker image, pushing it to GHCR, then pulling and restarting services on a VM using Docker Compose.

Current project mode: minimal-effort workflow (`latest` image tag deployment).

## Architecture

- CI builds and pushes app image to GHCR on every push to main.
- CD connects to VM over SSH and runs Docker Compose updates.
- VM runs one service:
  - `app` (Next.js server)
- n8n runs scheduling workflows that call protected MindMate API endpoints.
- Database is external managed PostgreSQL via `DATABASE_URL`.

## Files added for deployment

- `Dockerfile`
- `.dockerignore`
- `docker-compose.vm.yml`
- `.env.vm.example`
- `.github/workflows/deploy-vm-ghcr.yml`
- `docs/n8n/mindmate-comprehensive-check.workflow.json`
- `docs/n8n/mindmate-overdue-check.workflow.json`

## GitHub Settings

### Repository actions permissions

Set workflow permissions to allow package publishing:

- `contents: read`
- `packages: write`

### Required GitHub secrets

- `VM_HOST`: VM public/private host name
- `VM_USER`: SSH user for deployment
- `VM_SSH_PRIVATE_KEY`: private key for SSH auth
- `VM_DEPLOY_PATH`: absolute path on VM where compose stack lives
- `GHCR_USERNAME`: GHCR username used by VM for `docker login`
- `GHCR_PAT`: GHCR token with `read:packages` scope

## VM Setup

1. Install Docker Engine and Docker Compose plugin.
2. Create deployment directory:
   - Example: `/opt/mindmate`
3. Copy `.env.vm.example` to `.env.vm` and fill production values.
4. Keep `.env.vm` only on VM.

## .env.vm settings

Core required values:

- `DATABASE_URL`
- `CRON_AUTH_TOKEN`
- `INTERNAL_API_KEY`
- `NEXTAUTH_SECRET` (or `AUTH_COOKIE_SECRET`)
- `NEXTAUTH_URL`
- `GOOGLE_AI_API_KEY`
- `NEXT_PUBLIC_VAPID_PUBLIC_KEY`
- `VAPID_PRIVATE_KEY`
- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_USER`
- `SMTP_PASS`
- `SMTP_FROM_EMAIL`

Optional:

- `AUTH_COOKIE_SECRET`
- `VAPID_EMAIL`
- `NEXT_PUBLIC_GA_MEASUREMENT_ID`

## n8n scheduler setup

Use n8n to schedule requests to MindMate's protected cron endpoints.

### 1. Add n8n environment variables

Set these in the n8n runtime environment:

- `MINDMATE_BASE_URL` (example: `http://127.0.0.1:3000`)
- `MINDMATE_CRON_AUTH_TOKEN` (same value as app `CRON_AUTH_TOKEN`)

### 2. Import workflows into n8n

Import from:

- `docs/n8n/mindmate-comprehensive-check.workflow.json`
- `docs/n8n/mindmate-overdue-check.workflow.json`

### 3. Adjust schedule rules

- Comprehensive check workflow default: every 1 minute.
- Overdue check workflow default: daily at 18:00 UTC.

Update these in n8n as needed for your workload.

### 4. Activate workflows

Enable both workflows in n8n after confirming endpoint access and auth header values.

### 5. Validate execution

- Verify success in n8n execution history.
- Confirm app logs show authorized POST calls and successful responses.

## First deployment

1. Push to `main`.
2. Wait for workflow `Build and Deploy to VM via GHCR` to complete.
3. On VM, verify:

```bash
cd /opt/mindmate
docker compose -f docker-compose.vm.yml ps
docker compose -f docker-compose.vm.yml logs app --tail 100
```

## Manual rollback

If latest release causes an issue, set `IMAGE_TAG` to a previous SHA and redeploy:

```bash
cd /opt/mindmate
export IMAGE_NAME=ghcr.io/<owner>/mindmate
export IMAGE_TAG=<previous_12_char_sha>
docker compose -f docker-compose.vm.yml pull app
docker compose -f docker-compose.vm.yml up -d --remove-orphans
```

## Security notes

- Keep VM app port bound to localhost (`127.0.0.1:3000:3000`) for private deployment.
- n8n calls protected API routes with `CRON_AUTH_TOKEN` bearer auth.
- Do not commit `.env.vm` or any real secrets.
- Rotate `CRON_AUTH_TOKEN`, `INTERNAL_API_KEY`, and SMTP credentials regularly.

## Reusable templates for other projects

If you want the same flow in any new project, use:

- `docs/templates/vm-ghcr/README.md`
- `docs/templates/vm-ghcr/workflow.minimal-latest.yml`
- `docs/templates/vm-ghcr/workflow.recommended-immutable.yml`
- `docs/templates/vm-ghcr/docker-compose.single-service.yml`
- `docs/templates/vm-ghcr/docker-compose.multi-service.yml`
- `docs/templates/vm-ghcr/env.vm.example`
