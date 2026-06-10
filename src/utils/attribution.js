import { commonsFilePageUrl } from './commons.js';

function formatCommonsLine(logo, markdown) {
  const url = commonsFilePageUrl(logo);
  const parts = [markdown && url ? `[${logo.name}](${url})` : logo.name];

  if (logo.artist) parts.push(`by ${logo.artist}`);

  if (logo.licenseShortName) {
    parts.push(markdown && logo.licenseUrl ? `([${logo.licenseShortName}](${logo.licenseUrl}))` : `(${logo.licenseShortName})`);
  }

  let line = `- ${parts.join(' ')}`;
  // Plain text has no inline links, so append the file page URL for reference.
  if (!markdown && url) line += ` — ${url}`;
  return line;
}

// Builds attribution for the logos used in a design, as plain text or Markdown.
// Includes author and license where Commons provides them; uploaded logos are
// listed separately. `logos` should be de-duplicated and in design order.
export function buildAttribution(logos, { format = 'text' } = {}) {
  const markdown = format === 'markdown';
  const commons = [];
  const uploads = [];

  for (const logo of logos) {
    if (!logo) continue;
    if (logo.source === 'upload') {
      uploads.push(`- ${logo.name}`);
      continue;
    }
    commons.push(formatCommonsLine(logo, markdown));
  }

  const lines = [];

  if (commons.length > 0) {
    lines.push('Logos via Wikimedia Commons (see each file page for full terms):');
    lines.push(...commons);
  }

  if (uploads.length > 0) {
    if (lines.length > 0) lines.push('');
    lines.push('User-provided logos (not from Wikimedia Commons):');
    lines.push(...uploads);
  }

  return lines.join('\n');
}
