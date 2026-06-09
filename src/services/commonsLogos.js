import { sanitizeSvgMarkup } from '../utils/svg.js';
import { createCommonsImageInfoUrl, getCommonsLogos, getPageForLogo } from '../utils/commons.js';

const CACHE_VERSION = 2;
const CACHE_KEY = `wikiround.commonsLogos.v${CACHE_VERSION}`;
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;

function toLogoMap(logos) {
  return Object.fromEntries(logos.map((logo) => [logo.id, logo]));
}

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
    fetchedAt: entry.fetchedAt || new Date().toISOString()
  };
}

export function readCachedCommonsLogos(fallbackLogos) {
  try {
    const raw = window.localStorage.getItem(CACHE_KEY);
    if (!raw) return null;

    const payload = JSON.parse(raw);
    if (payload.version !== CACHE_VERSION || !Array.isArray(payload.logos)) {
      return null;
    }

    const fallbackById = toLogoMap(fallbackLogos);
    const logos = payload.logos
      .map((entry) => {
        const fallbackLogo = fallbackById[entry.id];
        return fallbackLogo ? normalizeLiveLogo(entry, fallbackLogo, 'cached-commons') : null;
      })
      .filter(Boolean);

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

  const fallbackById = toLogoMap(fallbackLogos);
  const logos = payload.logos
    .map((entry) => {
      const fallbackLogo = fallbackById[entry.id];
      return fallbackLogo ? normalizeLiveLogo(entry, fallbackLogo, payload.source || 'toolforge-cache') : null;
    })
    .filter(Boolean);

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
          sha1: imageInfo.sha1
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
