# Toolforge Deployment

This app is deployed as the Toolforge tool `logo-round-gen` at:

```text
https://logo-round-gen.toolforge.org/
```

The Toolforge webservice runs the repository checkout from `$HOME/www/js` and starts the app with:

```bash
npm start
```

`npm start` installs dependencies, builds the Vite frontend, and runs `server.js` with `HOST=0.0.0.0` and Toolforge's provided `PORT`.

## Configuration

Set a Wikimedia API user agent for Commons requests:

```bash
COMMONS_USER_AGENT="WikiRoundGenerator/0.1 (https://logo-round-gen.toolforge.org/; maintainer@example.org)"
```

Keep local SSH material, shell profiles, and account-specific files outside the repository.

## Deploy

From a workstation with Toolforge SSH access:

```bash
ssh <toolforge-user>@login.toolforge.org
become logo-round-gen
cd "$HOME/www/js"
git fetch origin main
git reset --hard origin/main
git rev-parse --short HEAD
toolforge webservice node20 restart
```

The printed commit should match `origin/main`.

## Verify

After restart, verify the deployed app:

```bash
curl -I https://logo-round-gen.toolforge.org/
curl https://logo-round-gen.toolforge.org/api/healthz
curl -I "https://logo-round-gen.toolforge.org/api/logos?refresh=1&verify=<commit>"
curl "https://logo-round-gen.toolforge.org/api/logos?refresh=1&verify=<commit>"
```

Expected checks:

- The homepage returns HTTP `200`.
- `/api/healthz` returns `{"ok":true,...}`.
- The refreshed `/api/logos` response sends `Cache-Control: no-store`.
- The logo payload includes every configured logo, has no fetch errors, and includes Commons metadata where available.
- The Wikimedia center logo resolves to `File:Wikimedia-logo black.svg`.

## Notes

Do not commit Toolforge account files, SSH material, `.env` files, generated build output, or local browser/debug state.
