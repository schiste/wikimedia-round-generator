export const COMMONS_API_ENDPOINT = 'https://commons.wikimedia.org/w/api.php';
export const COMMONS_IMAGEINFO_PROPS = 'url|mime|timestamp|sha1';

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
