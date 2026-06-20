import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DEFAULT_LOGOS } from './src/data/logos.js';
import {
  COMMONS_CACHE_TTL_MS,
  createCommonsImageInfoUrl,
  getCommonsCredit,
  getCommonsLogos as getCommonsLogoDefinitions,
  getPageForLogo,
  parseCommonsTitle
} from './src/utils/commons.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = parseInt(process.env.PORT || '4173', 10);
const HOST = process.env.HOST || '127.0.0.1';
const CACHE_TTL_MS = parseInt(process.env.LOGO_CACHE_TTL_MS || `${COMMONS_CACHE_TTL_MS}`, 10);
const STALE_TTL_MS = parseInt(process.env.LOGO_STALE_TTL_MS || `${7 * 24 * 60 * 60 * 1000}`, 10);
const MAX_SVG_BYTES = parseInt(process.env.LOGO_MAX_SVG_BYTES || '250000', 10);
const USER_AGENT =
  process.env.COMMONS_USER_AGENT ||
  'WikiRoundGenerator/0.1 (https://toolforge.org/; Toolforge hosted Wikimedia logo composer)';

const app = express();
const distDir = path.join(__dirname, 'dist');

let logoCache = {
  fetchedAt: 0,
  logos: [],
  errors: []
};
const singleLogoCache = new Map();
let refreshPromise = null;

function cacheIsFresh() {
  return logoCache.logos.length > 0 && Date.now() - logoCache.fetchedAt < CACHE_TTL_MS;
}

function cacheIsUsableStale() {
  return logoCache.logos.length > 0 && Date.now() - logoCache.fetchedAt < STALE_TTL_MS;
}

function headers(accept) {
  return {
    Accept: accept,
    'User-Agent': USER_AGENT,
    'Api-User-Agent': USER_AGENT
  };
}

async function fetchCommonsMetadata(logos) {
  const response = await fetch(createCommonsImageInfoUrl(logos), {
    headers: headers('application/json')
  });

  if (!response.ok) {
    throw new Error(`Commons imageinfo failed with ${response.status}`);
  }

  return response.json();
}

async function fetchSvgText(url) {
  const response = await fetch(url, {
    headers: headers('image/svg+xml')
  });

  if (!response.ok) {
    throw new Error(`SVG fetch failed with ${response.status}`);
  }

  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('image/svg+xml')) {
    throw new Error(`Unexpected SVG content type: ${contentType || 'unknown'}`);
  }

  const contentLength = parseInt(response.headers.get('content-length') || '0', 10);
  if (contentLength > MAX_SVG_BYTES) {
    throw new Error(`SVG is too large: ${contentLength} bytes`);
  }

  const svg = await response.text();
  if (Buffer.byteLength(svg, 'utf8') > MAX_SVG_BYTES) {
    throw new Error(`SVG is too large after download`);
  }

  if (!/<svg[\s>]/i.test(svg)) {
    throw new Error('Downloaded file is not SVG markup');
  }

  return svg;
}

async function resolveCommonsLogos() {
  const commonsLogos = getCommonsLogoDefinitions(DEFAULT_LOGOS);
  const metadata = await fetchCommonsMetadata(commonsLogos);
  const logos = [];
  const errors = [];

  for (const logo of commonsLogos) {
    const page = getPageForLogo(metadata, logo);
    const imageInfo = page?.imageinfo?.[0];

    if (!imageInfo?.url || imageInfo.mime !== 'image/svg+xml') {
      errors.push({
        id: logo.id,
        commonsTitle: logo.commonsTitle,
        message: 'Commons did not return current SVG imageinfo'
      });
      continue;
    }

    try {
      const svg = await fetchSvgText(imageInfo.url);
      logos.push({
        id: logo.id,
        commonsTitle: logo.commonsTitle,
        commonsPageTitle: page.title,
        svg,
        sourceUrl: imageInfo.url,
        descriptionUrl: imageInfo.descriptionurl,
        timestamp: imageInfo.timestamp,
        sha1: imageInfo.sha1,
        mime: imageInfo.mime,
        fetchedAt: new Date().toISOString(),
        ...getCommonsCredit(imageInfo)
      });
    } catch (error) {
      errors.push({
        id: logo.id,
        commonsTitle: logo.commonsTitle,
        message: error.message
      });
    }
  }

  if (logos.length === 0) {
    throw new Error('No Commons SVG logos could be resolved');
  }

  logoCache = {
    fetchedAt: Date.now(),
    logos,
    errors
  };

  return logoCache;
}

async function resolveSingleCommonsLogo(commonsTitle) {
  const metadata = await fetchCommonsMetadata([{ commonsTitle }]);
  const page = getPageForLogo(metadata, { commonsTitle });
  const imageInfo = page?.imageinfo?.[0];

  if (!page || page.missing !== undefined || page.invalid !== undefined) {
    throw new Error(`No Commons file named "${commonsTitle}" was found`);
  }

  if (!imageInfo?.url || imageInfo.mime !== 'image/svg+xml') {
    throw new Error(`Commons file "${commonsTitle}" is not an SVG`);
  }

  const svg = await fetchSvgText(imageInfo.url);
  return {
    fetchedAt: Date.now(),
    logo: {
      commonsTitle,
      commonsPageTitle: page.title,
      svg,
      sourceUrl: imageInfo.url,
      descriptionUrl: imageInfo.descriptionurl,
      timestamp: imageInfo.timestamp,
      sha1: imageInfo.sha1,
      mime: imageInfo.mime,
      fetchedAt: new Date().toISOString(),
      ...getCommonsCredit(imageInfo)
    }
  };
}

async function getResolvedCommonsLogos({ force = false } = {}) {
  if (!force && cacheIsFresh()) {
    return { ...logoCache, source: 'toolforge-cache' };
  }

  if (!refreshPromise) {
    refreshPromise = resolveCommonsLogos().finally(() => {
      refreshPromise = null;
    });
  }

  try {
    const result = await refreshPromise;
    return { ...result, source: 'toolforge-commons' };
  } catch (error) {
    if (cacheIsUsableStale()) {
      return {
        ...logoCache,
        source: 'toolforge-stale-cache',
        errors: [{ message: error.message }, ...logoCache.errors]
      };
    }

    throw error;
  }
}

async function getResolvedSingleCommonsLogo(commonsTitle, { force = false } = {}) {
  const cached = singleLogoCache.get(commonsTitle);
  const cachedAge = cached ? Date.now() - cached.fetchedAt : Number.POSITIVE_INFINITY;

  if (!force && cached && cachedAge < CACHE_TTL_MS) {
    return { ...cached, source: 'toolforge-single-cache' };
  }

  try {
    const result = await resolveSingleCommonsLogo(commonsTitle);
    singleLogoCache.set(commonsTitle, result);
    return { ...result, source: 'toolforge-single-commons' };
  } catch (error) {
    if (cached && cachedAge < STALE_TTL_MS) {
      return {
        ...cached,
        source: 'toolforge-single-stale-cache',
        errors: [{ message: error.message }]
      };
    }

    throw error;
  }
}

app.get('/api/healthz', (req, res) => {
  res.json({ ok: true, cacheEntries: logoCache.logos.length, singleLogoCacheEntries: singleLogoCache.size });
});

app.get('/api/logos', async (req, res) => {
  try {
    const forceRefresh = req.query.refresh === '1';
    const payload = await getResolvedCommonsLogos({ force: forceRefresh });
    res.set('Cache-Control', forceRefresh ? 'no-store' : 'public, max-age=300, stale-while-revalidate=3600');
    res.json({
      source: payload.source,
      fetchedAt: new Date(payload.fetchedAt).toISOString(),
      cacheTtlMs: CACHE_TTL_MS,
      logos: payload.logos,
      errors: payload.errors
    });
  } catch (error) {
    res.status(502).json({
      source: 'toolforge-error',
      message: error.message,
      logos: [],
      errors: [{ message: error.message }]
    });
  }
});

app.get('/api/logo', async (req, res) => {
  const commonsTitle = parseCommonsTitle(req.query.title);

  if (!commonsTitle) {
    res.status(400).json({
      source: 'toolforge-error',
      message: 'Missing or invalid Commons file title',
      logo: null,
      errors: [{ message: 'Missing or invalid Commons file title' }]
    });
    return;
  }

  try {
    const forceRefresh = req.query.refresh === '1';
    const payload = await getResolvedSingleCommonsLogo(commonsTitle, { force: forceRefresh });
    res.set('Cache-Control', forceRefresh ? 'no-store' : 'public, max-age=300, stale-while-revalidate=3600');
    res.json({
      source: payload.source,
      fetchedAt: new Date(payload.fetchedAt).toISOString(),
      cacheTtlMs: CACHE_TTL_MS,
      logo: payload.logo,
      errors: payload.errors || []
    });
  } catch (error) {
    res.status(502).json({
      source: 'toolforge-error',
      message: error.message,
      logo: null,
      errors: [{ message: error.message }]
    });
  }
});

app.use(
  express.static(distDir, {
    etag: true,
    immutable: true,
    index: false,
    maxAge: '1y',
    setHeaders(res, filePath) {
      if (filePath.endsWith('.html')) {
        res.setHeader('Cache-Control', 'no-cache');
      }
    }
  })
);

app.get(/.*/, (req, res) => {
  res.set('Cache-Control', 'no-cache');
  res.sendFile(path.join(distDir, 'index.html'));
});

const server = app.listen(PORT, HOST, () => {
  console.log(`WikiRound server listening on http://${HOST}:${PORT}`);
});

server.on('error', (error) => {
  console.error(`WikiRound server failed to start: ${error.message}`);
  process.exitCode = 1;
});
