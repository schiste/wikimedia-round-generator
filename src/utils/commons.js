export const COMMONS_API_ENDPOINT = 'https://commons.wikimedia.org/w/api.php';
export const COMMONS_IMAGEINFO_PROPS = 'url|mime|timestamp|sha1';

// Default lifetime for resolved Commons logo metadata, shared by the browser
// cache (services/commonsLogos.js) and the Toolforge server cache (server.js).
export const COMMONS_CACHE_TTL_MS = 6 * 60 * 60 * 1000;

export function getCommonsLogos(logos) {
  return logos.filter((logo) => logo.commonsTitle);
}

export function createCommonsImageInfoUrl(logos, { origin } = {}) {
  const params = new URLSearchParams({
    action: 'query',
    format: 'json',
    prop: 'imageinfo',
    iiprop: COMMONS_IMAGEINFO_PROPS,
    titles: getCommonsLogos(logos)
      .map((logo) => logo.commonsTitle)
      .join('|')
  });

  if (origin) {
    params.set('origin', origin);
  }

  return `${COMMONS_API_ENDPOINT}?${params}`;
}

export function getPageForLogo(apiResponse, logo) {
  const pages = Object.values(apiResponse.query?.pages || {});
  const normalized = new Map((apiResponse.query?.normalized || []).map((item) => [item.from, item.to]));
  const expectedTitle = normalized.get(logo.commonsTitle) || normalizeCommonsTitle(logo.commonsTitle);

  return pages.find((page) => page.title === expectedTitle || page.title === logo.commonsTitle || page.title === normalizeCommonsTitle(logo.commonsTitle));
}

function normalizeCommonsTitle(title) {
  return title.replaceAll('_', ' ');
}

const COMMONS_FILE_BASE = 'https://commons.wikimedia.org/wiki/';

// Best-available link to a logo's Commons file page (the source of truth for its
// current revision, author, and license).
export function commonsFilePageUrl(logo) {
  if (!logo) return null;
  if (logo.descriptionUrl) return logo.descriptionUrl;

  const title = logo.commonsPageTitle || logo.commonsTitle;
  return title ? `${COMMONS_FILE_BASE}${encodeURI(title.replaceAll(' ', '_'))}` : null;
}
