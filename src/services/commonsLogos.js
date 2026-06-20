import { sanitizeSvgMarkup } from '../utils/svg.js';
import {
  COMMONS_CACHE_TTL_MS,
  commonsTitleToName,
  createCommonsImageInfoUrl,
  getCommonsCredit,
  getCommonsLogos,
  getPageForLogo,
  parseCommonsTitle
} from '../utils/commons.js';
import { indexById } from '../utils/collection.js';

const CACHE_VERSION = 4;
const CACHE_KEY = `wikiround.commonsLogos.v${CACHE_VERSION}`;
const CACHE_TTL_MS = COMMONS_CACHE_TTL_MS;

function normalizeLiveLogo(entry, fallbackLogo, source) {
  const svg = sanitizeSvgMarkup(entry.svg);
  if (!svg) return null;

  return {
    id: fallbackLogo.id,
    name: fallbackLogo.name,
    color: fallbackLogo.color,
    commonsTitle: fallbackLogo.commonsTitle,
    svg,
    source,
    sourceUrl: entry.sourceUrl,
    descriptionUrl: entry.descriptionUrl,
    commonsPageTitle: entry.commonsPageTitle,
    timestamp: entry.timestamp,
    sha1: entry.sha1,
    artist: entry.artist || '',
    licenseShortName: entry.licenseShortName || '',
    licenseUrl: entry.licenseUrl || '',
    attributionRequired: Boolean(entry.attributionRequired),
    fetchedAt: entry.fetchedAt || new Date().toISOString()
  };
}

function normalizeEntries(entries, fallbackLogos, source) {
  const fallbackById = indexById(fallbackLogos);
  return entries
    .map((entry) => {
      const fallbackLogo = fallbackById[entry.id];
      return fallbackLogo ? normalizeLiveLogo(entry, fallbackLogo, source) : null;
    })
    .filter(Boolean);
}

export function readCachedCommonsLogos(fallbackLogos) {
  try {
    const raw = window.localStorage.getItem(CACHE_KEY);
    if (!raw) return null;

    const payload = JSON.parse(raw);
    if (payload.version !== CACHE_VERSION || !Array.isArray(payload.logos)) {
      return null;
    }

    const logos = normalizeEntries(payload.logos, fallbackLogos, 'cached-commons');

    if (logos.length === 0) return null;

    return {
      logos,
      cachedAt: payload.cachedAt,
      isFresh: Date.now() - new Date(payload.cachedAt).getTime() < CACHE_TTL_MS
    };
  } catch {
    return null;
  }
}

export function writeCachedCommonsLogos(logos) {
  const payload = {
    version: CACHE_VERSION,
    cachedAt: new Date().toISOString(),
    logos: logos.map((logo) => ({
      id: logo.id,
      svg: logo.svg,
      sourceUrl: logo.sourceUrl,
      descriptionUrl: logo.descriptionUrl,
      commonsPageTitle: logo.commonsPageTitle,
      timestamp: logo.timestamp,
      sha1: logo.sha1,
      artist: logo.artist,
      licenseShortName: logo.licenseShortName,
      licenseUrl: logo.licenseUrl,
      attributionRequired: logo.attributionRequired,
      fetchedAt: logo.fetchedAt
    }))
  };

  try {
    window.localStorage.setItem(CACHE_KEY, JSON.stringify(payload));
  } catch {
    // Storage may be unavailable in private or restricted browser contexts.
  }
}

async function fetchFromToolforgeEndpoint(fallbackLogos, { signal, force } = {}) {
  const response = await fetch(`/api/logos${force ? '?refresh=1' : ''}`, {
    signal,
    headers: {
      Accept: 'application/json'
    }
  });

  const contentType = response.headers.get('content-type') || '';
  if (!response.ok || !contentType.includes('application/json')) {
    throw new Error('Toolforge logo endpoint is unavailable');
  }

  const payload = await response.json();
  if (!Array.isArray(payload.logos)) {
    throw new Error('Toolforge logo endpoint returned an invalid payload');
  }

  const logos = normalizeEntries(payload.logos, fallbackLogos, payload.source || 'toolforge-cache');

  if (logos.length === 0) {
    throw new Error('Toolforge logo endpoint returned no usable SVGs');
  }

  return {
    logos,
    source: payload.source || 'toolforge-cache',
    fetchedAt: payload.fetchedAt || new Date().toISOString(),
    errors: payload.errors || []
  };
}

async function fetchDirectlyFromCommons(fallbackLogos, { signal } = {}) {
  const commonsLogos = getCommonsLogos(fallbackLogos);

  const metadataResponse = await fetch(createCommonsImageInfoUrl(commonsLogos, { origin: '*' }), {
    signal,
    headers: {
      Accept: 'application/json'
    }
  });

  if (!metadataResponse.ok) {
    throw new Error('Commons imageinfo request failed');
  }

  const metadata = await metadataResponse.json();
  const liveLogos = [];
  const errors = [];

  for (const fallbackLogo of commonsLogos) {
    const page = getPageForLogo(metadata, fallbackLogo);
    const imageInfo = page?.imageinfo?.[0];

    if (!imageInfo?.url || imageInfo.mime !== 'image/svg+xml') {
      errors.push({ id: fallbackLogo.id, commonsTitle: fallbackLogo.commonsTitle, message: 'Missing SVG imageinfo' });
      continue;
    }

    try {
      const svgResponse = await fetch(imageInfo.url, {
        signal,
        headers: {
          Accept: 'image/svg+xml'
        }
      });

      if (!svgResponse.ok) {
        throw new Error(`SVG request failed with ${svgResponse.status}`);
      }

      const rawSvg = await svgResponse.text();
      const logo = normalizeLiveLogo(
        {
          svg: rawSvg,
          sourceUrl: imageInfo.url,
          descriptionUrl: imageInfo.descriptionurl,
          commonsPageTitle: page.title,
          timestamp: imageInfo.timestamp,
          sha1: imageInfo.sha1,
          ...getCommonsCredit(imageInfo)
        },
        fallbackLogo,
        'commons-direct'
      );

      if (logo) {
        liveLogos.push(logo);
      }
    } catch (error) {
      errors.push({ id: fallbackLogo.id, commonsTitle: fallbackLogo.commonsTitle, message: error.message });
    }
  }

  if (liveLogos.length === 0) {
    throw new Error('No Commons SVGs could be loaded');
  }

  return {
    logos: liveLogos,
    source: 'commons-direct',
    fetchedAt: new Date().toISOString(),
    errors
  };
}

function logoIdFromTitle(title) {
  const slug = String(title)
    .replace(/^File:/i, '')
    .replace(/\.[a-z0-9]+$/i, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
  return `commons-${slug || 'logo'}`;
}

function fallbackLogoForTitle(commonsTitle, options = {}) {
  return {
    id: options.id || logoIdFromTitle(commonsTitle),
    name: options.name || commonsTitleToName(commonsTitle),
    color: options.color || '#475569',
    commonsTitle
  };
}

async function fetchSingleFromToolforgeEndpoint(commonsTitle, fallbackLogo, { signal, source } = {}) {
  const response = await fetch(`/api/logo?title=${encodeURIComponent(commonsTitle)}`, {
    signal,
    headers: {
      Accept: 'application/json'
    }
  });

  const contentType = response.headers.get('content-type') || '';
  if (!response.ok || !contentType.includes('application/json')) {
    throw new Error('Toolforge single-logo endpoint is unavailable');
  }

  const payload = await response.json();
  if (!payload.logo?.svg) {
    throw new Error('Toolforge single-logo endpoint returned an invalid payload');
  }

  const logo = normalizeLiveLogo(payload.logo, fallbackLogo, source || 'toolforge-logo');
  if (!logo) {
    throw new Error('Toolforge single-logo endpoint returned no usable SVG');
  }

  return logo;
}

// Resolves a single user-supplied Commons reference (file-page URL, image URL,
// or bare title) to a ready-to-use SVG logo. SVG-only, since raster files would
// taint the export canvas and can't be inlined safely.
export async function fetchCommonsLogo(input, { signal, id, name, color, source = 'commons-custom' } = {}) {
  const commonsTitle = parseCommonsTitle(input);
  if (!commonsTitle) {
    throw new Error('Enter a Commons file URL or title, e.g. File:Example.svg');
  }

  const fallbackLogo = fallbackLogoForTitle(commonsTitle, { id, name, color });

  try {
    return await fetchSingleFromToolforgeEndpoint(commonsTitle, fallbackLogo, { signal, source });
  } catch (error) {
    if (signal?.aborted || error.name === 'AbortError') {
      throw error;
    }
    // Vite development has no Express API, and production may temporarily miss
    // the single-logo endpoint; direct Commons fetch keeps custom/library logos usable.
  }

  const metaResponse = await fetch(createCommonsImageInfoUrl([{ commonsTitle }], { origin: '*' }), {
    signal,
    headers: { Accept: 'application/json' }
  });
  if (!metaResponse.ok) {
    throw new Error('Could not reach Wikimedia Commons. Please try again.');
  }

  const metadata = await metaResponse.json();
  const page = getPageForLogo(metadata, { commonsTitle });
  if (!page || page.missing !== undefined || page.invalid !== undefined) {
    throw new Error(`No file named "${commonsTitle}" was found on Wikimedia Commons.`);
  }

  const imageInfo = page.imageinfo?.[0];
  if (!imageInfo?.url) {
    throw new Error('Commons returned no file information for that title.');
  }
  if (imageInfo.mime !== 'image/svg+xml') {
    throw new Error('Only SVG files are supported, and that file is not an SVG.');
  }

  const svgResponse = await fetch(imageInfo.url, { signal, headers: { Accept: 'image/svg+xml' } });
  if (!svgResponse.ok) {
    throw new Error('Could not download the SVG from Commons.');
  }

  const svg = sanitizeSvgMarkup(await svgResponse.text());
  if (!svg) {
    throw new Error('That SVG could not be parsed safely.');
  }

  const title = page.title || commonsTitle;
  const logo = normalizeLiveLogo(
    {
      svg,
      sourceUrl: imageInfo.url,
      descriptionUrl: imageInfo.descriptionurl,
      commonsPageTitle: page.title,
      timestamp: imageInfo.timestamp,
      sha1: imageInfo.sha1,
      ...getCommonsCredit(imageInfo)
    },
    {
      ...fallbackLogo,
      commonsTitle: title
    },
    source
  );

  if (!logo) {
    throw new Error('That SVG could not be parsed safely.');
  }

  return logo;
}

export async function fetchCatalogCommonsLogo(entry, { signal } = {}) {
  const logo = await fetchCommonsLogo(entry.commonsTitle, {
    signal,
    id: entry.id,
    name: entry.name,
    color: entry.color || '#475569',
    source: 'commons-affiliate'
  });

  return {
    ...logo,
    affiliateCode: entry.code,
    affiliateKind: entry.kind,
    affiliatePageUrl: entry.metaPageUrl
  };
}

export async function fetchLiveCommonsLogos(fallbackLogos, options = {}) {
  try {
    const result = await fetchFromToolforgeEndpoint(fallbackLogos, options);
    writeCachedCommonsLogos(result.logos);
    return result;
  } catch (toolforgeError) {
    const result = await fetchDirectlyFromCommons(fallbackLogos, options);
    writeCachedCommonsLogos(result.logos);
    return {
      ...result,
      errors: [{ message: toolforgeError.message }, ...result.errors]
    };
  }
}
