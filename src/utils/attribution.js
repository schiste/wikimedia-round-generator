import { commonsFilePageUrl } from './commons.js';

// Builds plain-text attribution for the logos used in a design. Commons-backed
// logos link to their file page (the authoritative source for author + license);
// uploaded logos are listed separately as user-provided. `logos` should already
// be de-duplicated and in the order they appear in the design.
export function buildAttribution(logos) {
  const commons = [];
  const uploads = [];

  for (const logo of logos) {
    if (!logo) continue;
    if (logo.source === 'upload') {
      uploads.push(logo.name);
      continue;
    }
    const url = commonsFilePageUrl(logo);
    commons.push(url ? `- ${logo.name} — ${url}` : `- ${logo.name}`);
  }

  const lines = [];

  if (commons.length > 0) {
    lines.push('Wikimedia logos via Wikimedia Commons. See each file page for author and licensing details:');
    lines.push(...commons);
  }

  if (uploads.length > 0) {
    if (lines.length > 0) lines.push('');
    lines.push('User-provided logos (not from Wikimedia Commons):');
    lines.push(...uploads.map((name) => `- ${name}`));
  }

  return lines.join('\n');
}
