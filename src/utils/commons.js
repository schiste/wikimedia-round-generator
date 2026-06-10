export const COMMONS_API_ENDPOINT = 'https://commons.wikimedia.org/w/api.php';
export const COMMONS_IMAGEINFO_PROPS = 'url|mime|timestamp|sha1|extmetadata';
// Limit the extmetadata payload to the credit fields we actually surface.
const COMMONS_EXTMETADATA_FILTER = 'Artist|Credit|LicenseShortName|LicenseUrl|AttributionRequired|Restrictions';

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
    iiextmetadatafilter: COMMONS_EXTMETADATA_FILTER,
    titles: getCommonsLogos(logos)
      .map((logo) => logo.commonsTitle)
      .join('|')
  });

  if (origin) {
    params.set('origin', origin);
  }

  return `${COMMONS_API_ENDPOINT}?${params}`;
}

// Commons extmetadata values are small HTML snippets (e.g. Artist is often a
// link). Reduce to plain text without a DOM so this runs on the server too.
function decodeEntityCodePoint(rawValue, radix, fallback) {
  const codePoint = parseInt(rawValue, radix);
  try {
    return Number.isFinite(codePoint) ? String.fromCodePoint(codePoint) : fallback;
  } catch {
    return fallback;
  }
}

function htmlToText(html) {
  if (!html) return '';
  return String(html)
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&ndash;/g, '-')
    .replace(/&mdash;/g, '-')
    .replace(/&middot;/g, '.')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&#x([0-9a-f]+);/gi, (match, hex) => decodeEntityCodePoint(hex, 16, match))
    .replace(/&#(\d+);/g, (match, decimal) => decodeEntityCodePoint(decimal, 10, match))
    .replace(/\s+/g, ' ')
    .trim();
}

// Extracts author/license credit from an imageinfo entry's extmetadata.
// Missing fields come back as empty string / false so callers degrade gracefully.
export function getCommonsCredit(imageInfo) {
  const ext = imageInfo?.extmetadata || {};
  const text = (key) => htmlToText(ext[key]?.value);

  return {
    artist: text('Artist'),
    licenseShortName: text('LicenseShortName'),
    licenseUrl: typeof ext.LicenseUrl?.value === 'string' ? ext.LicenseUrl.value : '',
    attributionRequired: text('AttributionRequired').toLowerCase() === 'true'
  };
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
