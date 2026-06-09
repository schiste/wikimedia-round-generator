import { normalizeConfig, sanitizeConfig } from './designConfig.js';

const STORAGE_VERSION = 1;
const STORAGE_KEY = `wikiround.customPresets.v${STORAGE_VERSION}`;

// A custom preset is { id, name, config } where config is a full design config.
// Field validation happens first; normalizeConfig then enforces cross-field
// invariants such as keeping the center logo out of the surrounding ring.
function normalizePreset(entry) {
  if (!entry || typeof entry !== 'object') return null;

  const name = typeof entry.name === 'string' ? entry.name.trim() : '';
  const sanitizedConfig = sanitizeConfig(entry.config);
  if (!name || !sanitizedConfig.centerLogo || !Array.isArray(sanitizedConfig.ringLogos)) return null;

  const id = typeof entry.id === 'string' && entry.id ? entry.id : createPresetId();
  return { id, name, config: normalizeConfig(sanitizedConfig) };
}

export function createPresetId() {
  return `preset-${Date.now()}-${Math.round(Math.random() * 1e6)}`;
}

export function readCustomPresets() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];

    const payload = JSON.parse(raw);
    if (payload.version !== STORAGE_VERSION || !Array.isArray(payload.presets)) return [];

    return payload.presets.map(normalizePreset).filter(Boolean);
  } catch {
    return [];
  }
}

export function writeCustomPresets(presets) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: STORAGE_VERSION, presets }));
  } catch {
    // Storage may be unavailable in private or restricted browser contexts.
  }
}

export function serializeCustomPresets(presets) {
  return JSON.stringify({ version: STORAGE_VERSION, presets }, null, 2);
}

// Accepts either { presets: [...] } or a bare array; returns normalized presets.
export function parseImportedPresets(text) {
  const payload = JSON.parse(text);
  const list = Array.isArray(payload) ? payload : payload?.presets;
  if (!Array.isArray(list)) {
    throw new Error('No presets found in file');
  }

  const presets = list.map(normalizePreset).filter(Boolean);
  if (presets.length === 0) {
    throw new Error('No valid presets found in file');
  }
  return presets;
}
