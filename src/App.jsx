import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  Check,
  Cloud,
  Copy,
  Download,
  Image as ImageIcon,
  Moon,
  RefreshCw,
  Save,
  Sliders,
  Sparkles,
  Sun,
  Trash2,
  Upload
} from 'lucide-react';
import { BACKDROP_THEMES, DEFAULT_LOGOS, HALO_COLORS, PRESETS, getBackdropFill } from './data/logos.js';
import { useCommonsLogoSync } from './hooks/useCommonsLogoSync.js';
import { useCustomPresets } from './hooks/useCustomPresets.js';
import { useDesignUrlSync } from './hooks/useDesignUrlSync.js';
import { useLogoCatalog } from './hooks/useLogoCatalog.js';
import { useLogoImageCache } from './hooks/useLogoImageCache.js';
import { useTheme } from './hooks/useTheme.js';
import { drawWheel, useWheelCanvas } from './hooks/useWheelCanvas.js';
import { buildAttribution } from './utils/attribution.js';
import { parseImportedPresets, serializeCustomPresets } from './utils/customPresets.js';
import { DEFAULT_CONFIG, readConfigFromLocation, sanitizeConfig } from './utils/designConfig.js';
import { copyCanvasToClipboard, downloadBlob, downloadCanvasImage } from './utils/download.js';
import {
  MIN_LOGO_SCALE,
  getAutoLogoScale,
  getCenterLogoScale,
  getCollisionSafeLogoScale
} from './utils/layout.js';
import { sanitizeSvgMarkup } from './utils/svg.js';
import { generateWheelSvg } from './utils/wheelSvg.js';

const EXPORT_SIZES = [800, 1600, 2400, 4000];
const EXPORT_BACKGROUNDS = [
  { id: 'preview', label: 'Match preview' },
  { id: 'transparent', label: 'Transparent' },
  { id: 'white', label: 'White' },
  { id: 'dark', label: 'Dark' }
];

function LogoGlyph({ logo, className = 'logo-glyph' }) {
  return <div className={className} aria-hidden="true" dangerouslySetInnerHTML={{ __html: logo.svg }} />;
}

function SectionHeader({ accent = 'blue', icon, id, title, meta }) {
  return (
    <div className="section-heading">
      <div className="section-title">
        <span className={`status-dot status-dot-${accent}`} aria-hidden="true" />
        {icon && React.cloneElement(icon, { 'aria-hidden': true, focusable: 'false' })}
        <h2 id={id}>{title}</h2>
      </div>
      {meta && <span className="section-meta">{meta}</span>}
    </div>
  );
}

function ToggleSwitch({ checked, onChange, label, showLabel = false }) {
  return (
    <button
      type="button"
      className="switch-control"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
    >
      {showLabel && <span>{label}</span>}
      <span className="switch-track" aria-hidden="true" />
    </button>
  );
}

function RangeControl({ label, valueLabel, children }) {
  return (
    <label className="range-control">
      <span className="range-label">
        <span>{label}</span>
        <span>{valueLabel}</span>
      </span>
      {children}
    </label>
  );
}

function ThemeToggle({ theme, onChange }) {
  return (
    <div className="theme-toggle" role="group" aria-label="Interface theme">
      <button
        type="button"
        className={theme === 'light' ? 'active' : ''}
        onClick={() => onChange('light')}
        aria-label="Light interface"
        aria-pressed={theme === 'light'}
      >
        <Sun className="h-4 w-4" aria-hidden="true" focusable="false" />
      </button>
      <button
        type="button"
        className={theme === 'dark' ? 'active' : ''}
        onClick={() => onChange('dark')}
        aria-label="Dark interface"
        aria-pressed={theme === 'dark'}
      >
        <Moon className="h-4 w-4" aria-hidden="true" focusable="false" />
      </button>
    </div>
  );
}

function CommonsStatus({ syncState, onRefresh }) {
  const isSyncing = syncState.status === 'syncing';
  const isLive = syncState.status === 'live' || syncState.status === 'cached';
  const Icon = isLive ? Cloud : AlertTriangle;

  return (
    <div className={`commons-status commons-status-${syncState.status}`} role="status" aria-live="polite">
      <Icon className="h-4 w-4" aria-hidden="true" focusable="false" />
      <div>
        <strong>{syncState.label}</strong>
        <span>{syncState.detail}</span>
      </div>
      <button type="button" onClick={() => onRefresh({ force: true })} disabled={isSyncing} aria-label="Refresh Commons logos">
        <RefreshCw className={`h-4 w-4 ${isSyncing ? 'animate-spin' : ''}`} aria-hidden="true" focusable="false" />
      </button>
    </div>
  );
}

function LogoButton({ logo, active, disabled, onClick, accent = 'blue' }) {
  const isCommons = Boolean(logo.sha1 || logo.sourceUrl);
  const action = active ? 'Remove' : 'Add';
  const source = isCommons ? 'Loaded from Wikimedia Commons.' : 'Bundled or uploaded logo.';
  const disabledReason = disabled ? ' This logo is already used as the central logo.' : '';

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`logo-tile ${active ? `logo-tile-active logo-tile-${accent}` : ''} ${disabled ? 'logo-tile-disabled' : ''}`}
      title={logo.commonsPageTitle || logo.name}
      aria-pressed={active}
      aria-label={`${action} ${logo.name} in the surrounding ring. ${source}${disabledReason}`}
    >
      <LogoGlyph logo={logo} />
      <span>{logo.name}</span>
      {isCommons && <i className="commons-mark" aria-hidden="true" />}
      {active && (
        <b aria-hidden="true">
          <Check className="h-2.5 w-2.5" aria-hidden="true" focusable="false" />
        </b>
      )}
    </button>
  );
}

function CentralLogoPicker({ logos, selectedLogo, value, onChange }) {
  if (!selectedLogo) return null;

  const sourceLabel = selectedLogo.commonsPageTitle || selectedLogo.commonsTitle || 'Local upload';

  return (
    <div className="central-logo-picker">
      <div className="central-logo-preview">
        <LogoGlyph logo={selectedLogo} className="central-logo-glyph" />
        <div>
          <strong>{selectedLogo.name}</strong>
          <span id="central-logo-source">{sourceLabel}</span>
        </div>
      </div>

      <label className="central-logo-select">
        <span>Change central logo</span>
        <select value={value} onChange={(event) => onChange(event.target.value)} aria-describedby="central-logo-source">
          {logos.map((logo) => (
            <option key={logo.id} value={logo.id}>
              {logo.name}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}

function CustomPresetPanel({ presets, onSave, onApply, onDelete, onExport, onImport }) {
  const [name, setName] = useState('');
  const [error, setError] = useState('');

  function handleSave(event) {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    onSave(trimmed);
    setName('');
  }

  async function handleImport(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    try {
      await onImport(file);
      setError('');
    } catch (importError) {
      setError(importError.message || 'Could not import presets.');
    }
  }

  return (
    <div className="custom-preset-panel">
      <form className="custom-preset-save" onSubmit={handleSave}>
        <input
          type="text"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Name this design"
          aria-label="Custom preset name"
          maxLength={60}
        />
        <button type="submit" className="secondary-action" disabled={!name.trim()}>
          <Save className="h-3.5 w-3.5" aria-hidden="true" focusable="false" />
          <span>Save</span>
        </button>
      </form>

      {presets.length > 0 && (
        <ul className="custom-preset-list" aria-label="Saved presets">
          {presets.map((preset) => (
            <li key={preset.id} className="custom-preset-row">
              <button type="button" className="custom-preset-apply" onClick={() => onApply(preset.config)} title={`Apply ${preset.name}`}>
                {preset.name}
              </button>
              <button type="button" onClick={() => onDelete(preset.id)} aria-label={`Delete preset ${preset.name}`}>
                <Trash2 className="h-3.5 w-3.5" aria-hidden="true" focusable="false" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="custom-preset-io">
        <button type="button" onClick={onExport} disabled={presets.length === 0}>
          <Download className="h-3.5 w-3.5" aria-hidden="true" focusable="false" />
          <span>Export</span>
        </button>
        <label className="custom-preset-import">
          <Upload className="h-3.5 w-3.5" aria-hidden="true" focusable="false" />
          <span>Import</span>
          <input type="file" accept="application/json,.json" onChange={handleImport} />
        </label>
      </div>

      {error && (
        <p className="error-text" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

export default function App() {
  // Seed editor state from the shared URL hash once, falling back to defaults.
  const initialConfig = useMemo(() => ({ ...DEFAULT_CONFIG, ...readConfigFromLocation() }), []);

  const [theme, setTheme] = useTheme();
  const { remoteLogos, syncState, refreshCommons } = useCommonsLogoSync(DEFAULT_LOGOS);
  const [customLogos, setCustomLogos] = useState([]);
  const { activeCommonsCount, allLogos, baseLogos, logoById } = useLogoCatalog({
    fallbackLogos: DEFAULT_LOGOS,
    remoteLogos,
    customLogos
  });

  const [centerLogo, setCenterLogo] = useState(initialConfig.centerLogo);
  const [ringLogos, setRingLogos] = useState(initialConfig.ringLogos);

  const [showHalo, setShowHalo] = useState(initialConfig.showHalo);
  const [haloColor, setHaloColor] = useState(initialConfig.haloColor);
  const [haloOpacity, setHaloOpacity] = useState(initialConfig.haloOpacity);
  const [haloRadius, setHaloRadius] = useState(initialConfig.haloRadius);

  const [ringRadius, setRingRadius] = useState(initialConfig.ringRadius);
  const [ringRotation, setRingRotation] = useState(initialConfig.ringRotation);
  const [centerLateralAnchors, setCenterLateralAnchors] = useState(initialConfig.centerLateralAnchors);
  const [autoScaleLogos, setAutoScaleLogos] = useState(initialConfig.autoScaleLogos);
  const [ringScale, setRingScale] = useState(initialConfig.ringScale);

  const [showGuides, setShowGuides] = useState(initialConfig.showGuides);
  const [backdrop, setBackdrop] = useState(initialConfig.backdrop);
  const [uploadError, setUploadError] = useState('');
  const [exportSize, setExportSize] = useState(1600);
  const [exportBackground, setExportBackground] = useState('preview');
  const [exportStatus, setExportStatus] = useState('');
  const [attributionStatus, setAttributionStatus] = useState('');
  const { presets: customPresets, savePreset, deletePreset, importPresets } = useCustomPresets();
  const imageCache = useLogoImageCache(allLogos);
  const backdropFill = getBackdropFill(backdrop);

  const collisionSafeLogoScale = useMemo(() => getCollisionSafeLogoScale(ringRadius, ringLogos.length), [ringRadius, ringLogos.length]);
  const manualLogoScale = Math.min(ringScale, collisionSafeLogoScale);
  const effectiveRingScale = autoScaleLogos ? getAutoLogoScale(ringRadius, ringLogos.length) : manualLogoScale;
  const effectiveCenterScale = getCenterLogoScale(ringRadius, effectiveRingScale);
  const selectedCenterLogo = logoById.get(centerLogo) || allLogos[0];
  const ringLogoNames = useMemo(
    () => ringLogos.map((id) => logoById.get(id)?.name).filter(Boolean),
    [logoById, ringLogos]
  );
  const canvasDescription = `${selectedCenterLogo?.name || 'Selected'} logo centered with ${ringLogoNames.length} surrounding logos: ${ringLogoNames.join(', ')}. ${showHalo ? `Halo enabled at ${Math.round(haloOpacity * 100)} percent intensity.` : 'Halo disabled.'}`;

  // Unique logos used in the current design (center first), for attribution (#4).
  const usedLogos = useMemo(() => {
    const seen = new Set();
    const list = [];
    for (const id of [centerLogo, ...ringLogos]) {
      if (seen.has(id)) continue;
      seen.add(id);
      const logo = logoById.get(id);
      if (logo) list.push(logo);
    }
    return list;
  }, [centerLogo, ringLogos, logoById]);

  const attributionText = useMemo(() => buildAttribution(usedLogos), [usedLogos]);

  const wheelSettings = {
    backdrop,
    backdropFill,
    centerLateralAnchors,
    centerLogo,
    centerScale: effectiveCenterScale,
    haloColor,
    haloOpacity,
    haloRadius,
    imageCache,
    ringLogos,
    ringRadius,
    ringRotation,
    ringScale: effectiveRingScale,
    showGuides,
    showHalo
  };

  const { canvasRef, isRendering } = useWheelCanvas(wheelSettings);

  // Full editable design, shared by URL sync (#2) and saved presets (#3).
  const designConfig = useMemo(
    () => ({
      centerLogo,
      ringLogos,
      showHalo,
      haloColor,
      haloOpacity,
      haloRadius,
      ringRadius,
      ringRotation,
      centerLateralAnchors,
      autoScaleLogos,
      ringScale,
      showGuides,
      backdrop
    }),
    [
      centerLogo,
      ringLogos,
      showHalo,
      haloColor,
      haloOpacity,
      haloRadius,
      ringRadius,
      ringRotation,
      centerLateralAnchors,
      autoScaleLogos,
      ringScale,
      showGuides,
      backdrop
    ]
  );

  useDesignUrlSync(designConfig);

  // Apply a complete saved/imported config (custom presets). Built-in presets use
  // applyPreset below, which intentionally leaves unspecified fields untouched.
  function applyConfig(config) {
    const merged = { ...DEFAULT_CONFIG, ...sanitizeConfig(config) };
    setCenterLogo(merged.centerLogo);
    setRingLogos(merged.ringLogos);
    setShowHalo(merged.showHalo);
    setHaloColor(merged.haloColor);
    setHaloOpacity(merged.haloOpacity);
    setHaloRadius(merged.haloRadius);
    setRingRadius(merged.ringRadius);
    setRingRotation(merged.ringRotation);
    setCenterLateralAnchors(merged.centerLateralAnchors);
    setAutoScaleLogos(merged.autoScaleLogos);
    setRingScale(merged.ringScale);
    setShowGuides(merged.showGuides);
    setBackdrop(merged.backdrop);
  }

  function exportPresets() {
    downloadBlob(serializeCustomPresets(customPresets), {
      filename: 'wikiround-presets.json',
      type: 'application/json;charset=utf-8'
    });
  }

  async function importPresetsFromFile(file) {
    const text = await file.text();
    importPresets(parseImportedPresets(text));
  }

  function applyPreset(preset) {
    setCenterLogo(preset.center);
    setRingLogos(preset.ring);
    setHaloColor(preset.haloColor);
    setHaloOpacity(preset.haloOpacity);
    setHaloRadius(preset.haloRadius);
    setRingRadius(preset.ringRadius);
    setRingScale(preset.ringScale);
    setCenterLateralAnchors(preset.centerLateralAnchors ?? true);
  }

  function selectCenterLogo(id) {
    setCenterLogo(id);
    setRingLogos((current) => (current.includes(id) && current.length > 1 ? current.filter((itemId) => itemId !== id) : current));
  }

  function handleUpload(event) {
    const input = event.currentTarget;
    const file = input.files?.[0];
    if (!file) return;

    const isSvg = file.type.includes('svg') || file.name.toLowerCase().endsWith('.svg');
    const isImage = file.type.startsWith('image/');

    if (!isSvg && !isImage) {
      setUploadError('Use an SVG, PNG, or JPG file.');
      return;
    }

    const reader = new FileReader();
    const uniqueId = `custom-${Date.now()}`;

    reader.onload = (readerEvent) => {
      const content = readerEvent.target?.result;
      if (typeof content !== 'string') return;

      const svg = isSvg
        ? sanitizeSvgMarkup(content)
        : `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
            <image href="${content}" x="5" y="5" width="90" height="90" preserveAspectRatio="xMidYMid meet" />
          </svg>`;

      if (!svg) {
        setUploadError('That SVG could not be parsed safely.');
        return;
      }

      setCustomLogos((current) => [
        ...current,
        {
          id: uniqueId,
          name: file.name.replace(/\.[^.]+$/, '') || 'Uploaded Logo',
          color: '#475569',
          svg,
          source: 'upload'
        }
      ]);
      setUploadError('');
      input.value = '';
    };

    if (isSvg) {
      reader.readAsText(file);
    } else {
      reader.readAsDataURL(file);
    }
  }

  function toggleRingItem(id) {
    if (id === centerLogo) return;

    if (ringLogos.includes(id)) {
      if (ringLogos.length > 1) {
        setRingLogos((current) => current.filter((itemId) => itemId !== id));
      }
      return;
    }

    setRingLogos((current) => [...current, id]);
  }

  function shiftRingItem(index, direction) {
    setRingLogos((current) => {
      const updated = [...current];
      const targetIndex = index + direction;

      if (targetIndex < 0 || targetIndex >= updated.length) {
        return current;
      }

      [updated[index], updated[targetIndex]] = [updated[targetIndex], updated[index]];
      return updated;
    });
  }

  // Resolve the chosen export background to a fill. "Match preview" follows the
  // current backdrop; JPG has no alpha, so a transparent choice falls back to white.
  function resolveExportFill(forJpg) {
    const fill = exportBackground === 'preview' ? backdropFill : getBackdropFill(exportBackground);
    return forJpg && !fill ? '#ffffff' : fill;
  }

  function buildExportCanvas(forJpg) {
    const canvas = document.createElement('canvas');
    drawWheel(canvas, exportSize, { ...wheelSettings, backdropFill: resolveExportFill(forJpg) });
    return canvas;
  }

  function generateVectorSvg() {
    return generateWheelSvg({
      backdrop: exportBackground === 'preview' ? backdrop : exportBackground,
      backdropFill: resolveExportFill(false),
      centerLateralAnchors,
      centerLogo,
      centerScale: effectiveCenterScale,
      haloColor,
      haloOpacity,
      haloRadius,
      logoById,
      ringLogos,
      ringRadius,
      ringRotation,
      ringScale: effectiveRingScale,
      showGuides,
      showHalo
    });
  }

  function downloadSVG() {
    downloadBlob(generateVectorSvg(), {
      filename: `wikimedia-wheel-${centerLogo}.svg`,
      type: 'image/svg+xml;charset=utf-8'
    });
  }

  async function downloadPNG() {
    await downloadCanvasImage(buildExportCanvas(false), `wikimedia-wheel-${centerLogo}-${exportSize}.png`);
  }

  async function downloadJPG() {
    await downloadCanvasImage(buildExportCanvas(true), `wikimedia-wheel-${centerLogo}-${exportSize}.jpg`, {
      type: 'image/jpeg',
      quality: 0.92
    });
  }

  async function copyPNG() {
    try {
      await copyCanvasToClipboard(buildExportCanvas(false));
      setExportStatus('Copied PNG to clipboard.');
    } catch (error) {
      setExportStatus(error.message || 'Could not copy to clipboard.');
    }
  }

  async function copyAttribution() {
    try {
      await navigator.clipboard.writeText(attributionText);
      setAttributionStatus('Copied attribution.');
    } catch {
      setAttributionStatus('Copy failed — select the text manually.');
    }
  }

  return (
    <div className={`app-shell theme-${theme}`}>
      <a className="skip-link" href="#workspace-preview">
        Skip to preview and export
      </a>
      <header className="top-band">
        <div className="top-band-title">
          <h1>WikiRound Generator</h1>
          <p>Live Wikimedia logo clusters</p>
        </div>
        <div className="top-band-actions">
          <CommonsStatus syncState={syncState} onRefresh={refreshCommons} />
          <ThemeToggle theme={theme} onChange={setTheme} />
        </div>
      </header>

      <div className="app-body">
        <aside className="sidebar control-scrollbar" aria-label="Logo wheel controls">
          <div className="sidebar-body">
            <section className="control-section" aria-labelledby="visual-presets-heading">
              <SectionHeader id="visual-presets-heading" accent="blue" icon={<Sliders className="h-4 w-4" />} title="1. Visual Presets" />
              <div className="preset-grid">
                {PRESETS.map((preset) => (
                  <button
                    key={preset.name}
                    type="button"
                    onClick={() => applyPreset(preset)}
                    className="preset-button"
                    aria-label={`Apply ${preset.name} preset with ${preset.ring.length} surrounding logos`}
                  >
                    <strong>{preset.name}</strong>
                    <span>
                      {preset.ring.length} ring items / Center: {preset.center}
                    </span>
                  </button>
                ))}
              </div>

              <CustomPresetPanel
                presets={customPresets}
                onSave={(name) => savePreset(name, designConfig)}
                onApply={applyConfig}
                onDelete={deletePreset}
                onExport={exportPresets}
                onImport={importPresetsFromFile}
              />
            </section>

            <section className="control-section" aria-labelledby="central-logo-heading">
              <SectionHeader id="central-logo-heading" accent="red" title="2. Central Logo" meta={`ID: ${centerLogo}`} />
              <CentralLogoPicker logos={allLogos} selectedLogo={selectedCenterLogo} value={centerLogo} onChange={selectCenterLogo} />
            </section>

            <section className="control-section" aria-labelledby="ring-distribution-heading">
              <SectionHeader id="ring-distribution-heading" accent="green" title="3. Surround Ring Distribution" meta={`Active: ${ringLogos.length}`} />
              <p className="section-note" id="ring-distribution-note">
                Current spacing <strong>{(360 / ringLogos.length).toFixed(1)} degrees</strong>. The central logo is excluded from this ring.
              </p>

              <div className="logo-grid" role="group" aria-describedby="ring-distribution-note" aria-label="Surrounding logo selection">
                {allLogos.map((logo) => {
                  const isActive = ringLogos.includes(logo.id);
                  const isCenterLogo = logo.id === centerLogo;

                  return (
                    <LogoButton
                      key={logo.id}
                      logo={logo}
                      active={isActive}
                      disabled={isCenterLogo}
                      accent="green"
                      onClick={() => toggleRingItem(logo.id)}
                    />
                  );
                })}
              </div>

              {ringLogos.length > 1 && (
                <div className="sequence-panel" aria-labelledby="sequence-heading">
                  <strong id="sequence-heading">Sequence Order Clockwise</strong>
                  <div className="sequence-list control-scrollbar" role="list" aria-live="polite">
                    {ringLogos.map((id, index) => {
                      const item = logoById.get(id);
                      if (!item) return null;

                      return (
                        <div key={id} className="sequence-row" role="listitem">
                          <span>
                            {index + 1}. {item.name}
                          </span>
                          <div>
                            <button type="button" disabled={index === 0} onClick={() => shiftRingItem(index, -1)} aria-label={`Move ${item.name} earlier`}>
                              <ArrowUp className="h-3.5 w-3.5" aria-hidden="true" focusable="false" />
                            </button>
                            <button
                              type="button"
                              disabled={index === ringLogos.length - 1}
                              onClick={() => shiftRingItem(index, 1)}
                              aria-label={`Move ${item.name} later`}
                            >
                              <ArrowDown className="h-3.5 w-3.5" aria-hidden="true" focusable="false" />
                            </button>
                            <button type="button" onClick={() => toggleRingItem(id)} aria-label={`Remove ${item.name}`}>
                              <Trash2 className="h-3.5 w-3.5" aria-hidden="true" focusable="false" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </section>

            <section className="halo-panel" aria-labelledby="halo-heading">
              <div className="panel-title-row">
                <div>
                  <Sparkles className="h-4 w-4" aria-hidden="true" focusable="false" />
                  <h3 id="halo-heading">Surround Halo</h3>
                </div>
                <ToggleSwitch checked={showHalo} onChange={setShowHalo} label="Show surround halo" />
              </div>

              {showHalo && (
                <div className="panel-controls">
                  <div>
                    <span className="compact-label" id="halo-color-heading">
                      Halo hue
                    </span>
                    <div className="color-row" role="group" aria-labelledby="halo-color-heading">
                      {HALO_COLORS.map((color) => (
                        <button
                          key={color.hex}
                          type="button"
                          onClick={() => setHaloColor(color.hex)}
                          style={{ backgroundColor: color.hex }}
                          className={haloColor === color.hex ? 'active' : ''}
                          title={color.name}
                          aria-label={color.name}
                          aria-pressed={haloColor === color.hex}
                        />
                      ))}
                      <input type="color" value={haloColor} onChange={(event) => setHaloColor(event.target.value)} aria-label="Custom halo color" />
                    </div>
                  </div>

                  <RangeControl label="Glow intensity" valueLabel={`${Math.round(haloOpacity * 100)}%`}>
                    <input
                      type="range"
                      min="0.1"
                      max="1"
                      step="0.05"
                      value={haloOpacity}
                      onChange={(event) => setHaloOpacity(parseFloat(event.target.value))}
                      aria-valuetext={`${Math.round(haloOpacity * 100)} percent`}
                    />
                  </RangeControl>

                  <RangeControl label="Outer glow boundary" valueLabel={`${haloRadius}px`}>
                    <input
                      type="range"
                      min="100"
                      max="400"
                      value={haloRadius}
                      onChange={(event) => setHaloRadius(parseInt(event.target.value, 10))}
                      aria-valuetext={`${haloRadius} pixels`}
                    />
                  </RangeControl>
                </div>
              )}
            </section>

            <section className="control-section" aria-labelledby="layout-heading">
              <SectionHeader id="layout-heading" accent="amber" icon={<Sliders className="h-4 w-4" />} title="4. Layout Dimensions" />

              <RangeControl label="Ring spread radius" valueLabel={`${ringRadius}px`}>
                <input
                  type="range"
                  min="100"
                  max="300"
                  value={ringRadius}
                  onChange={(event) => setRingRadius(parseInt(event.target.value, 10))}
                  aria-valuetext={`${ringRadius} pixels`}
                />
              </RangeControl>

              <RangeControl label="Ring angle rotation" valueLabel={`${ringRotation} degrees`}>
                <input
                  type="range"
                  min="0"
                  max="360"
                  value={ringRotation}
                  onChange={(event) => setRingRotation(parseInt(event.target.value, 10))}
                  aria-valuetext={`${ringRotation} degrees`}
                />
              </RangeControl>

              <div className="alignment-row">
                <div>
                  <strong>Center side anchors</strong>
                  <span>Align the strongest lateral ring position with the center logo.</span>
                </div>
                <ToggleSwitch checked={centerLateralAnchors} onChange={setCenterLateralAnchors} label="Center side anchors" />
              </div>

              <div className="alignment-row">
                <div>
                  <strong>Auto scale logo size</strong>
                  <span>Fit the current logo count and ring radius without collisions.</span>
                </div>
                <ToggleSwitch checked={autoScaleLogos} onChange={setAutoScaleLogos} label="Auto scale logo size" />
              </div>

              {autoScaleLogos ? (
                <div className="auto-scale-summary">
                  <span>Auto logo size</span>
                  <strong>
                    Ring x{effectiveRingScale.toFixed(2)} / Center x{effectiveCenterScale.toFixed(2)}
                  </strong>
                </div>
              ) : (
                <RangeControl label="Logo size" valueLabel={`x${manualLogoScale.toFixed(2)} / max x${collisionSafeLogoScale.toFixed(2)}`}>
                  <input
                    type="range"
                    min={MIN_LOGO_SCALE}
                    max={collisionSafeLogoScale}
                    step="0.01"
                    value={manualLogoScale}
                    onChange={(event) => setRingScale(parseFloat(event.target.value))}
                    aria-valuetext={`Scale ${manualLogoScale.toFixed(2)}, maximum ${collisionSafeLogoScale.toFixed(2)}`}
                  />
                </RangeControl>
              )}
            </section>

            <section className="upload-panel" aria-labelledby="upload-heading">
              <h3 id="upload-heading">
                <Upload className="h-3.5 w-3.5" aria-hidden="true" focusable="false" />
                Upload Custom Logo
              </h3>
              <p>SVG, PNG, or JPG files become local-only custom nodes.</p>
              <label>
                <ImageIcon className="h-8 w-8" aria-hidden="true" focusable="false" />
                <span>Click to select file</span>
                <small>SVG vector formats recommended</small>
                <input type="file" accept=".svg,image/png,image/jpeg" onChange={handleUpload} />
              </label>
              {uploadError && (
                <p className="error-text" role="alert">
                  {uploadError}
                </p>
              )}
            </section>

            <section className="control-section" aria-labelledby="attribution-heading">
              <SectionHeader id="attribution-heading" accent="blue" title="5. Attribution" meta={`${usedLogos.length} logos`} />
              <p className="section-note">Credit for the logos in this design. Each Commons file page lists the author and license.</p>
              <textarea className="attribution-text control-scrollbar" readOnly rows={6} value={attributionText} aria-label="Attribution text" />
              <button type="button" className="secondary-action attribution-copy" onClick={copyAttribution}>
                <Copy className="h-3.5 w-3.5" aria-hidden="true" focusable="false" />
                <span>Copy attribution</span>
              </button>
              {attributionStatus && (
                <p className="section-note" role="status" aria-live="polite">
                  {attributionStatus}
                </p>
              )}
            </section>
          </div>
        </aside>

        <main className="workspace" id="workspace-preview" aria-label="Logo wheel preview and export">
          <div className="workspace-toolbar">
            <div className="backdrop-controls" role="group" aria-labelledby="backdrop-heading">
              <span id="backdrop-heading">Backdrop</span>
              <div>
                {BACKDROP_THEMES.map((backdropTheme) => (
                  <button
                    key={backdropTheme.id}
                    type="button"
                    onClick={() => setBackdrop(backdropTheme.id)}
                    className={backdrop === backdropTheme.id ? 'active' : ''}
                    aria-pressed={backdrop === backdropTheme.id}
                  >
                    {backdropTheme.label}
                  </button>
                ))}
              </div>
            </div>

            <ToggleSwitch checked={showGuides} onChange={setShowGuides} label="Display guides" showLabel />
          </div>

          <div className="canvas-stage">
            <div className="canvas-frame">
              <div className={backdrop === 'transparent' ? 'bg-checkerboard canvas-backdrop' : 'canvas-backdrop'} />
              <canvas ref={canvasRef} role="img" aria-label={canvasDescription}>
                {canvasDescription}
              </canvas>

              {isRendering && (
                <div className="render-overlay" role="status" aria-live="polite">
                  <RefreshCw className="h-8 w-8 animate-spin" aria-hidden="true" focusable="false" />
                  <span>Drawing canvas...</span>
                </div>
              )}
            </div>

            <div className="canvas-metadata">
              <span>800 x 800 px</span>
              <span>
                {activeCommonsCount}/{baseLogos.length} Commons logos active
              </span>
              <span>Background - halo - guides - logos</span>
            </div>
          </div>

          <div className="export-bar">
            <div className="export-info">
              <strong>Publish Design Assets</strong>
              <span>Exports use the currently rendered logo source.</span>
            </div>

            <div className="export-options">
              <label>
                <span>Size</span>
                <select value={exportSize} onChange={(event) => setExportSize(parseInt(event.target.value, 10))} aria-label="Export size">
                  {EXPORT_SIZES.map((size) => (
                    <option key={size} value={size}>
                      {size} × {size} px
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>Background</span>
                <select value={exportBackground} onChange={(event) => setExportBackground(event.target.value)} aria-label="Export background">
                  {EXPORT_BACKGROUNDS.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="export-actions">
              <button type="button" onClick={downloadPNG} className="secondary-action">
                <ImageIcon className="h-4 w-4" aria-hidden="true" focusable="false" />
                <span>PNG</span>
              </button>
              <button type="button" onClick={downloadJPG} className="secondary-action">
                <ImageIcon className="h-4 w-4" aria-hidden="true" focusable="false" />
                <span>JPG</span>
              </button>
              <button type="button" onClick={copyPNG} className="secondary-action">
                <Copy className="h-4 w-4" aria-hidden="true" focusable="false" />
                <span>Copy</span>
              </button>
              <button type="button" onClick={downloadSVG} className="primary-action">
                <Download className="h-4 w-4" aria-hidden="true" focusable="false" />
                <span>SVG</span>
              </button>
            </div>

            <p className="export-status" role="status" aria-live="polite">
              {exportStatus}
            </p>
          </div>
        </main>
      </div>

      <footer className="app-footer">
        <span>
          License{' '}
          <a href="https://www.gnu.org/licenses/agpl-3.0.html" target="_blank" rel="noreferrer">
            AGPL-3.0-or-later
          </a>
        </span>
        <span aria-hidden="true">/</span>
        <a href="https://github.com/schiste/wikimedia-round-generator" target="_blank" rel="noreferrer">
          GitHub
        </a>
        <span aria-hidden="true">/</span>
        <a href="https://commons.wikimedia.org/wiki/File:Wikimedia_logo_family_2009.svg" target="_blank" rel="noreferrer">
          Special thanks to Guillom, the original author of that design
        </a>
      </footer>
    </div>
  );
}
