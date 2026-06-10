# WikiRound Generator

React app for composing circular Wikimedia-style logo clusters and exporting them as PNG or SVG.

The app ships bundled fallback SVGs, then refreshes the current official logo SVGs from Wikimedia Commons. In production the Express server exposes `/api/logos`, batches Commons `imageinfo` lookups, fetches SVGs with a Wikimedia API user agent, and keeps an in-memory cache. During Vite development, the browser falls back to direct Commons requests if `/api/logos` is not available.

## Commands

```bash
npm install
npm run dev
npm run build
npm run serve
```

Local URLs:

```text
Vite dev:          http://127.0.0.1:5173/
Production server: http://127.0.0.1:4173/
```

## Toolforge

`npm start` is configured for Toolforge-style Node webservice startup:

```bash
npm start
```

It installs dependencies, builds the Vite bundle, and runs `server.js` on `PORT` with `HOST=0.0.0.0`.

Recommended environment override:

```bash
COMMONS_USER_AGENT="WikiRoundGenerator/0.1 (https://YOUR-TOOL.toolforge.org/; your-contact@example.org)"
```

For the production update and verification checklist, see [Toolforge deployment](./docs/toolforge-deployment.md).

## License

This project is licensed under the GNU Affero General Public License v3.0 or later (`AGPL-3.0-or-later`). See [LICENSE](./LICENSE).

When deployed as a network service, keep the corresponding source code available to users as required by the AGPL.
