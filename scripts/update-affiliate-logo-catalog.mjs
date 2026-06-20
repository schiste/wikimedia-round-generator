import { writeFile } from 'node:fs/promises';

const META_API = 'https://meta.wikimedia.org/w/api.php';
const COMMONS_API = 'https://commons.wikimedia.org/w/api.php';
const USER_AGENT = 'WikiRoundGenerator/0.1 (https://logo-round-gen.toolforge.org/; affiliate logo catalog updater)';

const TEMPLATES = [
  ['chapter', 'Template:Wikimedia movement affiliates/Wikimedia chapters'],
  ['thematic', 'Template:Wikimedia movement affiliates/Wikimedia thematic organizations'],
  ['user-group', 'Template:Wikimedia movement affiliates/Wikimedia user groups']
];

const KIND_LABELS = {
  chapter: 'Chapters',
  thematic: 'Thematic organizations',
  'user-group': 'User groups'
};

async function fetchJson(endpoint, params) {
  const url = new URL(endpoint);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }

  let response;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    response = await fetch(url, {
      headers: {
        Accept: 'application/json',
        'User-Agent': USER_AGENT,
        'Api-User-Agent': USER_AGENT
      }
    });

    if (![429, 503].includes(response.status)) break;
    await new Promise((resolve) => setTimeout(resolve, 1000 * (attempt + 1)));
  }

  if (!response.ok) {
    throw new Error(`${endpoint} failed with ${response.status}`);
  }

  return response.json();
}

async function fetchTemplateWikitext(page) {
  const payload = await fetchJson(META_API, {
    action: 'parse',
    format: 'json',
    page,
    prop: 'wikitext'
  });

  return payload.parse?.wikitext?.['*'] || '';
}

function extractTemplateCalls(text, templateName) {
  const calls = [];
  let offset = 0;
  const marker = `{{${templateName}`;

  while (offset < text.length) {
    const start = text.indexOf(marker, offset);
    if (start === -1) break;

    let depth = 0;
    let end = -1;
    for (let index = start; index < text.length - 1; index += 1) {
      const pair = text.slice(index, index + 2);
      if (pair === '{{') {
        depth += 1;
        index += 1;
      } else if (pair === '}}') {
        depth -= 1;
        index += 1;
        if (depth === 0) {
          end = index + 1;
          break;
        }
      }
    }

    if (end === -1) break;
    calls.push(text.slice(start, end + 1));
    offset = end + 1;
  }

  return calls;
}

function splitTopLevelParams(call) {
  const body = call.trim().slice(2, -2);
  const params = [];
  let depth = 0;
  let current = '';

  for (let index = 0; index < body.length; index += 1) {
    const pair = body.slice(index, index + 2);
    if (pair === '{{') {
      depth += 1;
      current += pair;
      index += 1;
    } else if (pair === '}}') {
      depth = Math.max(0, depth - 1);
      current += pair;
      index += 1;
    } else if (body[index] === '|' && depth === 0) {
      params.push(current);
      current = '';
    } else {
      current += body[index];
    }
  }

  params.push(current);
  return params;
}

function parseTemplateParams(call) {
  const parts = splitTopLevelParams(call).slice(1);
  const params = {};

  for (const part of parts) {
    const separator = part.indexOf('=');
    if (separator === -1) continue;
    const key = part.slice(0, separator).trim();
    const value = part.slice(separator + 1).trim();
    params[key] = value;
  }

  return params;
}

function decodeEntities(value) {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'");
}

function cleanName(value) {
  return decodeEntities(String(value || '')
    .replace(/<translate[^>]*>/g, '')
    .replace(/<\/translate>/g, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/\[\[[^\]|]+\|([^\]]+)\]\]/g, '$1')
    .replace(/\[\[([^\]]+)\]\]/g, '$1')
    .replace(/\s+/g, ' ')
    .trim());
}

function decodeTitle(value) {
  const title = String(value || '').trim();
  if (!title) return '';

  try {
    return decodeURIComponent(title);
  } catch {
    return title;
  }
}

function slugify(value) {
  return String(value || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function createId(kind, code, name) {
  return `affiliate-${kind}-${slugify(code || name)}`;
}

function metaPageUrl(page, fullpage) {
  if (fullpage) {
    if (fullpage.startsWith('c:')) {
      return `https://commons.wikimedia.org/wiki/${encodeURIComponent(fullpage.slice(2)).replace(/%2F/g, '/')}`;
    }
    if (fullpage.startsWith('mw:')) {
      return `https://www.mediawiki.org/wiki/${encodeURIComponent(fullpage.slice(3)).replace(/%2F/g, '/')}`;
    }
    if (fullpage.startsWith('m:')) {
      return `https://meta.wikimedia.org/wiki/${encodeURIComponent(fullpage.slice(2)).replace(/%2F/g, '/')}`;
    }
    return `https://meta.wikimedia.org/wiki/${encodeURIComponent(fullpage).replace(/%2F/g, '/')}`;
  }

  return page ? `https://meta.wikimedia.org/wiki/${encodeURIComponent(page).replace(/%2F/g, '/')}` : '';
}

function chunk(items, size) {
  const chunks = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

function normalizeTitle(title) {
  return String(title || '').replaceAll('_', ' ');
}

async function fetchImageInfo(entries) {
  const infoByTitle = new Map();

  for (const batch of chunk(entries, 50)) {
    const payload = await fetchJson(COMMONS_API, {
      action: 'query',
      format: 'json',
      prop: 'imageinfo',
      iiprop: 'url|mime|timestamp|sha1',
      titles: batch.map((entry) => entry.commonsTitle).join('|')
    });

    const normalized = new Map((payload.query?.normalized || []).map((item) => [item.from, item.to]));
    const pagesByTitle = new Map(Object.values(payload.query?.pages || {}).map((page) => [page.title, page]));

    for (const entry of batch) {
      const normalizedTitle = normalized.get(entry.commonsTitle) || normalizeTitle(entry.commonsTitle);
      const page = pagesByTitle.get(normalizedTitle) || pagesByTitle.get(entry.commonsTitle) || pagesByTitle.get(normalizeTitle(entry.commonsTitle));
      const imageInfo = page?.imageinfo?.[0];
      infoByTitle.set(entry.commonsTitle, {
        mime: imageInfo?.mime || '',
        resolvedTitle: page?.title || entry.commonsTitle
      });
    }

  }

  return infoByTitle;
}

async function buildCatalog() {
  const rawEntries = [];

  for (const [kind, page] of TEMPLATES) {
    const text = await fetchTemplateWikitext(page);
    for (const call of extractTemplateCalls(text, 'Affiliates/listing-logo')) {
      const params = parseTemplateParams(call);
      const logo = decodeTitle(params.logo);
      if (!logo) continue;

      const name = cleanName(params.name);
      const code = cleanName(params.code);
      rawEntries.push({
        id: createId(kind, code, name),
        kind,
        kindLabel: KIND_LABELS[kind],
        code,
        name,
        commonsTitle: `File:${logo}`,
        metaPageUrl: metaPageUrl(params.page, params.fullpage)
      });
    }
  }

  const infoByTitle = await fetchImageInfo(rawEntries);
  const excluded = {};
  const entries = [];

  for (const entry of rawEntries) {
    const info = infoByTitle.get(entry.commonsTitle);
    if (info?.mime !== 'image/svg+xml') {
      excluded[info?.mime || 'missing'] = (excluded[info?.mime || 'missing'] || 0) + 1;
      continue;
    }

    entries.push({
      ...entry,
      commonsTitle: info.resolvedTitle || entry.commonsTitle
    });
  }

  return { entries, excluded };
}

function serializeCatalog({ entries, excluded }) {
  const kindCounts = entries.reduce((counts, entry) => {
    counts[entry.kind] = (counts[entry.kind] || 0) + 1;
    return counts;
  }, {});

  return `// Generated by scripts/update-affiliate-logo-catalog.mjs from Meta-Wiki affiliate templates.
// SVG-only: raster logos are excluded until the app supports raster-safe exports.

export const AFFILIATE_LOGO_SOURCE_URL = 'https://meta.wikimedia.org/wiki/Wikimedia_movement_affiliates';

export const AFFILIATE_LOGO_KIND_LABELS = {
  chapter: 'Chapters',
  thematic: 'Thematic organizations',
  'user-group': 'User groups'
};

export const AFFILIATE_LOGO_KIND_COUNTS = ${JSON.stringify(kindCounts, null, 2)};

export const AFFILIATE_LOGO_EXCLUDED_COUNTS = ${JSON.stringify(excluded, null, 2)};

export const AFFILIATE_LOGOS = ${JSON.stringify(entries, null, 2)};
`;
}

const catalog = await buildCatalog();
await writeFile(new URL('../src/data/affiliateLogos.js', import.meta.url), serializeCatalog(catalog));

console.log(`Wrote ${catalog.entries.length} SVG affiliate logos.`);
console.log(`Excluded: ${JSON.stringify(catalog.excluded)}`);
