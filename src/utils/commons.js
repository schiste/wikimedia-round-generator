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

// Normalizes whatever the user pastes — a Commons file-page URL, an
// upload.wikimedia.org image URL (incl. thumbnails), or a bare title/filename —
// into a canonical `File:Name.ext` title. Returns null if nothing usable.
export function parseCommonsTitle(input) {
  if (!input) return null;
  let raw = String(input).trim();
  if (!raw) return null;

  // Give bare wikimedia hosts (no scheme) a scheme so URL parsing works.
  if (raw.startsWith('//')) raw = `https:${raw}`;
  else if (/^(?:www\.)?(?:commons|upload)\.wikimedia\.org\//i.test(raw)) raw = `https://${raw}`;

  if (/^https?:\/\//i.test(raw)) {
    let url;
    try {
      url = new URL(raw);
    } catch {
      return null;
    }

    const titleParam = url.searchParams.get('title');
    if (titleParam) {
      raw = titleParam;
    } else if (/upload\.wikimedia\.org$/i.test(url.hostname)) {
      // .../commons/a/ab/Name.svg or .../commons/thumb/a/ab/Name.svg/120px-Name.svg
      const last = decodeURIComponent(url.pathname.split('/').filter(Boolean).pop() || '');
      raw = last.replace(/^\d+px-/, '');
    } else {
      raw = decodeURIComponent(url.pathname.replace(/^\/wiki\//, ''));
      const filePath = raw.match(/^Special:FilePath\/(.+)$/i);
      if (filePath) raw = filePath[1];
    }
  } else if (raw.includes('/wiki/')) {
    raw = decodeURIComponent(raw.slice(raw.indexOf('/wiki/') + '/wiki/'.length));
    const filePath = raw.match(/^Special:FilePath\/(.+)$/i);
    if (filePath) raw = filePath[1];
  } else if (raw.includes('/')) {
    // A bare path such as /wikipedia/commons/a/ab/Name.svg or a thumbnail path.
    const last = decodeURIComponent(raw.split(/[?#]/)[0].split('/').filter(Boolean).pop() || '');
    raw = last.replace(/^\d+px-/, '');
  }

  raw = raw.split(/[?#]/)[0].trim().replace(/^\/+/, '');
  const withoutNs = raw.replace(/^(?:File|Image)\s*:\s*/i, '').trim();
  if (!withoutNs) return null;

  return `File:${withoutNs}`;
}

// Human-readable name from a Commons title, e.g. "File:Wikimania_2020.svg" -> "Wikimania 2020".
export function commonsTitleToName(title) {
  const name = String(title || '')
    .replace(/^File:/i, '')
    .replace(/\.[a-z0-9]+$/i, '')
    .replace(/_/g, ' ')
    .trim();
  return name || 'Commons logo';
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
