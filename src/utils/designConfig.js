import { BACKDROP_THEMES, PRESETS } from '../data/logos.js';
import { MAX_LOGO_SCALE, MIN_LOGO_SCALE, clamp } from './layout.js';

// Canonical shape of an editable wheel design. Shared by the live editor state,
// shareable URLs (#2), and saved presets (#3) so all three agree on one schema.
export const DEFAULT_CONFIG = {
  centerLogo: 'wikimedia',
  ringLogos: PRESETS[0].ring,
  showHalo: true,
  haloColor: '#0e65c0',
  haloOpacity: 0.2,
  haloRadius: 260,
  ringRadius: 210,
  ringRotation: 0,
  centerLateralAnchors: true,
  autoScaleLogos: true,
  ringScale: 0.75,
  showGuides: false,
  backdrop: 'transparent'
};

// Field schema drives URL (de)serialization and validation. `param` is the short
// URL key; `type` selects how the raw string is coerced and bounded.
const FIELDS = [
  { key: 'centerLogo', param: 'c', type: 'string' },
  { key: 'ringLogos', param: 'r', type: 'idList' },
  { key: 'showHalo', param: 'halo', type: 'bool' },
  { key: 'haloColor', param: 'hc', type: 'color' },
  { key: 'haloOpacity', param: 'ho', type: 'number', min: 0.1, max: 1 },
  { key: 'haloRadius', param: 'hr', type: 'int', min: 100, max: 400 },
  { key: 'ringRadius', param: 'rr', type: 'int', min: 100, max: 300 },
  { key: 'ringRotation', param: 'rot', type: 'int', min: 0, max: 360 },
  { key: 'centerLateralAnchors', param: 'anchor', type: 'bool' },
  { key: 'autoScaleLogos', param: 'auto', type: 'bool' },
  { key: 'ringScale', param: 'rs', type: 'number', min: MIN_LOGO_SCALE, max: MAX_LOGO_SCALE },
  { key: 'showGuides', param: 'guides', type: 'bool' },
  { key: 'backdrop', param: 'bg', type: 'enum', values: BACKDROP_THEMES.map((theme) => theme.id) }
];

const HEX_COLOR = /^#[0-9a-f]{6}$/i;

function coerceValue(field, value) {
  switch (field.type) {
    case 'bool':
      return typeof value === 'boolean' ? value : value === '1' || value === 'true';
    case 'int':
    case 'number': {
      const num = typeof value === 'number' ? value : parseFloat(value);
      if (!Number.isFinite(num)) return undefined;
      const bounded = clamp(num, field.min, field.max);
      return field.type === 'int' ? Math.round(bounded) : bounded;
    }
    case 'color': {
      const hex = String(value).startsWith('#') ? String(value) : `#${value}`;
      return HEX_COLOR.test(hex) ? hex.toLowerCase() : undefined;
    }
    case 'enum':
      return field.values.includes(value) ? value : undefined;
    case 'idList': {
      const list = Array.isArray(value) ? value : String(value).split(',');
      const ids = list.map((id) => String(id).trim()).filter(Boolean);
      return ids.length > 0 ? ids : undefined;
    }
    case 'string':
    default: {
      const str = String(value).trim();
      return str ? str : undefined;
    }
  }
}

// Returns a clean config containing only valid, in-bounds values from `raw`.
// Unknown keys and unparseable values are dropped (caller merges over defaults).
export function sanitizeConfig(raw) {
  if (!raw || typeof raw !== 'object') return {};

  const config = {};
  for (const field of FIELDS) {
    if (raw[field.key] === undefined || raw[field.key] === null) continue;
    const coerced = coerceValue(field, raw[field.key]);
    if (coerced !== undefined) config[field.key] = coerced;
  }
  return config;
}

export function encodeConfigToHash(config) {
  const params = new URLSearchParams();
  for (const field of FIELDS) {
    const value = config[field.key];
    if (value === undefined || value === null) continue;

    if (field.type === 'bool') params.set(field.param, value ? '1' : '0');
    else if (field.type === 'idList') params.set(field.param, value.join(','));
    else if (field.type === 'color') params.set(field.param, String(value).replace('#', ''));
    else params.set(field.param, String(value));
  }
  return params.toString();
}

export function decodeConfigFromHash(hash) {
  const clean = String(hash || '').replace(/^#/, '');
  if (!clean) return {};

  const params = new URLSearchParams(clean);
  const raw = {};
  for (const field of FIELDS) {
    if (params.has(field.param)) raw[field.key] = params.get(field.param);
  }
  return sanitizeConfig(raw);
}

// Reads the current location hash once (safe in non-browser contexts).
export function readConfigFromLocation() {
  if (typeof window === 'undefined') return {};
  return decodeConfigFromHash(window.location.hash);
}
