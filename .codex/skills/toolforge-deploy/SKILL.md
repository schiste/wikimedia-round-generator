---
name: toolforge-deploy
description: Deploy and verify this repository's Toolforge Node webservice. Use when Codex is asked to build, push, deploy, restart, verify, or troubleshoot the WikiRound Generator deployment on Toolforge, especially for the logo-round-gen tool, login.toolforge.org SSH access, node20 webservice restarts, and post-deploy HTTP/API checks.
---

# Toolforge Deploy

## Overview

Deploy the WikiRound Generator to Toolforge with the same sequence used in production: local build, push `main`, update the Toolforge checkout, restart the `node20` webservice, and verify the public site.

Use the bundled script for the standard path:

```bash
.codex/skills/toolforge-deploy/scripts/deploy-toolforge.sh
```

Use verify-only mode after a manual deploy:

```bash
.codex/skills/toolforge-deploy/scripts/deploy-toolforge.sh --verify-only
```

## Defaults

The script defaults to this repository's current production setup:

- Toolforge user: `schiste`
- SSH key: `~/.ssh/id_ed25519_toolforge`
- Tool account: `logo-round-gen`
- Remote checkout: `/data/project/logo-round-gen/www/js`
- Branch: `main`
- Webservice type: `node20`
- Public URL: `https://logo-round-gen.toolforge.org`
- Expected core logo count from `/api/logos`: `14`

Override defaults with environment variables:

```bash
TOOLFORGE_SSH_USER=schiste
TOOLFORGE_SSH_KEY="$HOME/.ssh/id_ed25519_toolforge"
TOOLFORGE_TOOL=logo-round-gen
TOOLFORGE_REPO_DIR=/data/project/logo-round-gen/www/js
TOOLFORGE_BRANCH=main
TOOLFORGE_WEB_URL=https://logo-round-gen.toolforge.org
TOOLFORGE_READY_TIMEOUT_SECONDS=180
TOOLFORGE_READY_POLL_SECONDS=5
TOOLFORGE_VERIFY_TIMEOUT_SECONDS=45
```

## Workflow

1. Check local status with `git status --short --branch`.
2. Confirm the worktree is clean before deployment. Commit intentional changes first.
3. Run `npm run build` locally.
4. Push `main` to `origin`.
5. SSH to `schiste@login.toolforge.org` with `~/.ssh/id_ed25519_toolforge`.
6. Run remote commands through `become logo-round-gen`.
7. In `/data/project/logo-round-gen/www/js`, `git fetch origin main` then `git reset --hard origin/main`.
8. Confirm the remote commit matches the pushed commit.
9. Run `toolforge webservice node20 restart`.
10. Wait for `/api/healthz` to return `200`, then inspect recent logs.
11. Verify public responses:
    - `/` returns `200` with `Cache-Control: no-cache`.
    - Hashed JS/CSS assets return `public, max-age=31536000, immutable`.
    - `/api/healthz` returns OK.
    - `/api/logos?refresh=1&verify=<commit>` returns `14` logos and `0` errors.
    - `/api/logo?title=File%3AWikimedia%20Armenia%20logo.svg&refresh=1&verify=<commit>` returns an SVG and `0` errors.

## Guardrails

- Do not commit SSH keys, KeePass files, `.env` files, Toolforge account files, `dist/`, or browser/debug state.
- Treat the remote `git reset --hard origin/main` as destructive to uncommitted files in the Toolforge checkout. Only run it after the local branch is pushed and the target commit is known.
- If SSH auth fails, first try the project key directly:

```bash
ssh -i ~/.ssh/id_ed25519_toolforge -o BatchMode=yes schiste@login.toolforge.org 'whoami'
```

- If the public homepage shows an old asset fingerprint immediately after restart, check Toolforge logs first; the `npm start` path rebuilds in the pod and can take around 40 seconds.
- If Toolforge builds are slower than usual, raise `TOOLFORGE_READY_TIMEOUT_SECONDS`; do not replace readiness polling with a fixed sleep.
- If the homepage is stale but cache-busted HTML is current, verify `server.js` still serves app-shell HTML with `Cache-Control: no-cache`.
- If forced Commons refresh checks are slow, raise `TOOLFORGE_VERIFY_TIMEOUT_SECONDS` rather than removing verification.

## Useful Commands

Current deployed checkout:

```bash
ssh -i ~/.ssh/id_ed25519_toolforge -o BatchMode=yes schiste@login.toolforge.org \
  'become logo-round-gen git -C /data/project/logo-round-gen/www/js rev-parse --short HEAD'
```

Recent webservice logs:

```bash
ssh -i ~/.ssh/id_ed25519_toolforge -o BatchMode=yes schiste@login.toolforge.org \
  'become logo-round-gen toolforge webservice -l 80 logs'
```

Webservice status:

```bash
ssh -i ~/.ssh/id_ed25519_toolforge -o BatchMode=yes schiste@login.toolforge.org \
  'become logo-round-gen toolforge webservice status'
```
