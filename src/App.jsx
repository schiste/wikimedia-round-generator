import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  Check,
  ChevronDown,
  Cloud,
  Copy,
  Download,
  FolderOpen,
  GripVertical,
  Image as ImageIcon,
  Library,
  Moon,
  RefreshCw,
  Save,
  Sliders,
  Sparkles,
  Sun,
  Trash2,
  Upload
} from 'lucide-react';
import { LogoGlyph } from './components/LogoGlyph.jsx';
import { LogoLibraryDialog } from './components/LogoLibraryDialog.jsx';
import { AFFILIATE_LOGOS } from './data/affiliateLogos.js';
import { BACKDROP_THEMES, DEFAULT_LOGOS, HALO_COLORS, PRESETS, getBackdropFill } from './data/logos.js';
import { fetchCommonsLogo } from './services/commonsLogos.js';
import { useAffiliateLogoLibrary } from './hooks/useAffiliateLogoLibrary.js';
import { useCommonsLogoSync } from './hooks/useCommonsLogoSync.js';
import { useCustomPresets } from './hooks/useCustomPresets.js';
import { useDesignUrlSync } from './hooks/useDesignUrlSync.js';
import { useLogoCatalog } from './hooks/useLogoCatalog.js';
import { useLogoImageCache } from './hooks/useLogoImageCache.js';
import { useTheme } from './hooks/useTheme.js';
import { drawWheel, useWheelCanvas } from './hooks/useWheelCanvas.js';
import { buildAttribution } from './utils/attribution.js';
import { commonsFilePageUrl } from './utils/commons.js';
import { parseImportedPresets, serializeCustomPresets } from './utils/customPresets.js';
import { normalizeConfig, readConfigFromLocation } from './utils/designConfig.js';
import { copyCanvasToClipboard, downloadBlob, downloadCanvasImage } from './utils/download.js';
import {
  MIN_LOGO_SCALE,
  getAutoLogoScale,
  getCenterCollisionSafeScale,
  getCenterLogoScale,
  getCollisionSafeLogoScale
} from './utils/layout.js';
import { generateWheelSvg } from './utils/wheelSvg.js';

const EXPORT_SIZES = [800, 1600, 2400, 4000];
const EXPORT_BACKGROUNDS = [
  { id: 'preview', label: 'Match preview' },
  { id: 'transparent', label: 'Transparent' },
  { id: 'white', label: 'White' },
  { id: 'dark', label: 'Dark' }
];
const APP_PICKER_OPTIONS = [
  {
    id: 'wikiround',
    name: 'WikiRound Generator',
    description: 'Live Wikimedia logo clusters',
    href: '/',
    current: true
  },
  {
    id: 'qr-generator',
    name: 'Wikimedia QR Generator',
    description: 'Client-side codes for movement links and campaign pages',
    href: 'https://wikimedia-qr-generator.toolforge.org/'
  }
];

function useDismissableMenu(open, setOpen) {
  const menuRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;

    function handlePointer(event) {
      if (menuRef.current && !menuRef.current.contains(event.target)) setOpen(false);
    }
    function handleKey(event) {
      if (event.key === 'Escape') setOpen(false);
    }

    document.addEventListener('mousedown', handlePointer);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handlePointer);
      document.removeEventListener('keydown', handleKey);
    };
  }, [open, setOpen]);

  return menuRef;
}

function formatCommonsDate(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat(undefined, { year: 'numeric', month: 'short', day: 'numeric' }).format(date);
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

function RefreshButton({ syncState, onRefresh }) {
  const isSyncing = syncState.status === 'syncing';
  const hint = `${(syncState.detail || syncState.label).replace(/\.$/, '')} — click to manually refresh them.`;

  return (
    <button
      type="button"
      className="refresh-button"
      onClick={() => onRefresh({ force: true })}
      disabled={isSyncing}
      title={hint}
      aria-label={hint}
    >
      <RefreshCw className={`h-4 w-4 ${isSyncing ? 'animate-spin' : ''}`} aria-hidden="true" focusable="false" />
    </button>
  );
}

function AppPicker() {
  const [open, setOpen] = useState(false);
  const menuRef = useDismissableMenu(open, setOpen);
  const currentApp = APP_PICKER_OPTIONS.find((option) => option.current) || APP_PICKER_OPTIONS[0];

  return (
    <div className="app-picker" ref={menuRef}>
      <h1>
        <button
          type="button"
          className="app-picker-button"
          aria-haspopup="menu"
          aria-expanded={open}
          aria-label="Choose Wikimedia generator"
          onClick={() => setOpen((value) => !value)}
        >
          <span className="app-picker-title">{currentApp.name}</span>
          <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" focusable="false" />
        </button>
      </h1>
      <p>{currentApp.description}</p>

      {open && (
        <div className="app-picker-menu" role="menu" aria-label="Wikimedia generator picker">
          {APP_PICKER_OPTIONS.map((option) => (
            <a
              key={option.id}
              className={`app-picker-option ${option.current ? 'app-picker-option-current' : ''}`}
              href={option.href}
              role="menuitem"
              aria-current={option.current ? 'page' : undefined}
              onClick={() => setOpen(false)}
            >
              <span className="app-picker-option-title">
                <span>{option.name}</span>
                {option.current && <Check className="h-3.5 w-3.5" aria-hidden="true" focusable="false" />}
              </span>
              <span className="app-picker-option-description">{option.description}</span>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

function DesignToolbar({ presets, onSave, onApply, onDelete, onExport, onImport }) {
  const [open, setOpen] = useState(false);
  const menuRef = useDismissableMenu(open, setOpen);

  async function handleImport(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    try {
      await onImport(file);
    } catch (error) {
      window.alert(error.message || 'Could not import designs.');
    }
  }

  return (
    <div className="design-toolbar">
      <div className="designs-menu" ref={menuRef}>
        <button
          type="button"
          className="header-button"
          aria-haspopup="menu"
          aria-expanded={open}
          aria-label={`My designs${presets.length > 0 ? ` (${presets.length} saved)` : ''}`}
          onClick={() => setOpen((value) => !value)}
        >
          <FolderOpen className="h-4 w-4" aria-hidden="true" focusable="false" />
          <span>My designs</span>
          {presets.length > 0 && <span className="header-badge">{presets.length}</span>}
          <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" focusable="false" />
        </button>

        {open && (
          <div className="designs-dropdown" role="menu">
            {presets.length === 0 ? (
              <p className="designs-empty">
                No saved designs yet. Use <strong>Save</strong> to keep the current design here.
              </p>
            ) : (
              <ul className="designs-list">
                {presets.map((preset) => (
                  <li key={preset.id}>
                    <button
                      type="button"
                      className="designs-apply"
                      role="menuitem"
                      onClick={() => {
                        onApply(preset.config);
                        setOpen(false);
                      }}
                    >
                      {preset.name}
                    </button>
                    <button type="button" onClick={() => onDelete(preset.id)} aria-label={`Delete ${preset.name}`}>
                      <Trash2 className="h-3.5 w-3.5" aria-hidden="true" focusable="false" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <p className="designs-note">Saved in this browser (local storage), not the cloud.</p>
          </div>
        )}
      </div>

      <button type="button" className="header-button" onClick={onSave} aria-label="Save current design">
        <Save className="h-4 w-4" aria-hidden="true" focusable="false" />
        <span>Save</span>
      </button>

      <label className="header-button">
        <Upload className="h-4 w-4" aria-hidden="true" focusable="false" />
        <span>Import</span>
        <input type="file" accept="application/json,.json" onChange={handleImport} aria-label="Import designs from a JSON file" />
      </label>

      <button type="button" className="header-button" onClick={onExport} disabled={presets.length === 0} aria-label="Export designs to a JSON file">
        <Download className="h-4 w-4" aria-hidden="true" focusable="false" />
        <span>Export</span>
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
  const filePageUrl = commonsFilePageUrl(selectedLogo);
  const updated = formatCommonsDate(selectedLogo.timestamp);
  const revision = selectedLogo.sha1 ? selectedLogo.sha1.slice(0, 10) : '';

  return (
    <div className="central-logo-panel">
      <label className="central-logo-picker">
        <LogoGlyph logo={selectedLogo} className="central-logo-glyph" />
        <span className="central-logo-label">Central logo</span>
        <select className="central-logo-select" value={value} onChange={(event) => onChange(event.target.value)} aria-describedby="central-logo-details">
          {logos.map((logo) => (
            <option key={logo.id} value={logo.id}>
              {logo.name}
            </option>
          ))}
        </select>
      </label>

      <dl className="central-logo-details" id="central-logo-details">
        <div>
          <dt>Source</dt>
          <dd>
            {filePageUrl ? (
              <a href={filePageUrl} target="_blank" rel="noreferrer">
                {sourceLabel}
              </a>
            ) : (
              sourceLabel
            )}
          </dd>
        </div>
        {updated && (
          <div>
            <dt>Updated</dt>
            <dd>{updated}</dd>
          </div>
        )}
        {revision && (
          <div>
            <dt>Revision</dt>
            <dd>
              <code>{revision}...</code>
            </dd>
          </div>
        )}
      </dl>
    </div>
  );
}

function SequenceList({ ringLogos, logoById, onMove, onShift, onRemove }) {
  const listRef = useRef(null);
  const [dragIndex, setDragIndex] = useState(null);
  const [overIndex, setOverIndex] = useState(null);

  // Pointer-based reordering works for both mouse and touch. The visible row whose
  // vertical midpoint sits below the pointer becomes the drop target.
  function indexFromPoint(clientY) {
    const container = listRef.current;
    if (!container) return null;

    const rows = [...container.querySelectorAll('[data-seq-row]')];
    for (let index = 0; index < rows.length; index += 1) {
      const rect = rows[index].getBoundingClientRect();
      if (clientY < rect.top + rect.height / 2) return index;
    }
    return rows.length - 1;
  }

  function handlePointerDown(event, index) {
    event.preventDefault();
    setDragIndex(index);
    setOverIndex(index);
    event.currentTarget.setPointerCapture?.(event.pointerId);
  }

  function handlePointerMove(event) {
    if (dragIndex === null) return;
    const target = indexFromPoint(event.clientY);
    if (target !== null) setOverIndex(target);
  }

  function handlePointerUp() {
    if (dragIndex !== null && overIndex !== null && dragIndex !== overIndex) {
      onMove(dragIndex, overIndex);
    }
    setDragIndex(null);
    setOverIndex(null);
  }

  return (
    <div className="sequence-list control-scrollbar" role="list" aria-live="polite" ref={listRef}>
      {ringLogos.map((id, index) => {
        const item = logoById.get(id);
        if (!item) return null;

        const isDragging = index === dragIndex;
        const isOver = dragIndex !== null && index === overIndex && index !== dragIndex;

        return (
          <div
            key={id}
            data-seq-row=""
            className={`sequence-row${isDragging ? ' sequence-row-dragging' : ''}${isOver ? ' sequence-row-over' : ''}`}
            role="listitem"
          >
            <button
              type="button"
              className="sequence-drag-handle"
              aria-label={`Drag to reorder ${item.name}`}
              onPointerDown={(event) => handlePointerDown(event, index)}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerUp}
            >
              <GripVertical className="h-3.5 w-3.5" aria-hidden="true" focusable="false" />
            </button>
            <span>
              {index + 1}. {item.name}
            </span>
            <div>
              <button type="button" disabled={index === 0} onClick={() => onShift(index, -1)} aria-label={`Move ${item.name} earlier`}>
                <ArrowUp className="h-3.5 w-3.5" aria-hidden="true" focusable="false" />
              </button>
              <button
                type="button"
                disabled={index === ringLogos.length - 1}
                onClick={() => onShift(index, 1)}
                aria-label={`Move ${item.name} later`}
              >
                <ArrowDown className="h-3.5 w-3.5" aria-hidden="true" focusable="false" />
              </button>
              <button type="button" onClick={() => onRemove(id)} aria-label={`Remove ${item.name}`}>
                <Trash2 className="h-3.5 w-3.5" aria-hidden="true" focusable="false" />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function App() {
  // Seed editor state from the shared URL hash once, falling back to defaults.
  const initialConfig = useMemo(() => normalizeConfig(readConfigFromLocation()), []);

  const [theme, setTheme] = useTheme();
  const { remoteLogos, syncState, refreshCommons } = useCommonsLogoSync(DEFAULT_LOGOS);
  const [customLogos, setCustomLogos] = useState([]);
  const [centerLogo, setCenterLogo] = useState(initialConfig.centerLogo);
  const [ringLogos, setRingLogos] = useState(initialConfig.ringLogos);
  const selectedLogoIds = useMemo(() => [centerLogo, ...ringLogos], [centerLogo, ringLogos]);
  const { affiliateLogos, affiliateLoadingById, affiliateErrorById, ensureAffiliateLogo } = useAffiliateLogoLibrary(selectedLogoIds);
  const extraLogos = useMemo(() => [...affiliateLogos, ...customLogos], [affiliateLogos, customLogos]);
  const { activeCommonsCount, allLogos, baseLogos, logoById } = useLogoCatalog({
    fallbackLogos: DEFAULT_LOGOS,
    remoteLogos,
    customLogos: extraLogos
  });

  const [showHalo, setShowHalo] = useState(initialConfig.showHalo);
  const [haloColor, setHaloColor] = useState(initialConfig.haloColor);
  const [haloOpacity, setHaloOpacity] = useState(initialConfig.haloOpacity);
  const [haloRadius, setHaloRadius] = useState(initialConfig.haloRadius);

  const [ringRadius, setRingRadius] = useState(initialConfig.ringRadius);
  const [ringRotation, setRingRotation] = useState(initialConfig.ringRotation);
  const [centerLateralAnchors, setCenterLateralAnchors] = useState(initialConfig.centerLateralAnchors);
  const [autoScaleLogos, setAutoScaleLogos] = useState(initialConfig.autoScaleLogos);
  const [ringScale, setRingScale] = useState(initialConfig.ringScale);
  const [centerScale, setCenterScale] = useState(initialConfig.centerScale);

  const [showGuides, setShowGuides] = useState(initialConfig.showGuides);
  const [backdrop, setBackdrop] = useState(initialConfig.backdrop);
  const [commonsInput, setCommonsInput] = useState('');
  const [commonsLoading, setCommonsLoading] = useState(false);
  const [commonsStatus, setCommonsStatus] = useState(null);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [exportSize, setExportSize] = useState(1600);
  const [exportBackground, setExportBackground] = useState('preview');
  const [exportStatus, setExportStatus] = useState('');
  const [attributionStatus, setAttributionStatus] = useState('');
  const [attributionFormat, setAttributionFormat] = useState('text');
  const { presets: customPresets, savePreset, deletePreset, importPresets } = useCustomPresets();
  const imageCache = useLogoImageCache(allLogos);
  const backdropFill = getBackdropFill(backdrop);
  const coreLibraryEntries = useMemo(
    () =>
      baseLogos.map((logo) => ({
        id: logo.id,
        kind: 'core',
        kindLabel: 'Core logos',
        code: '',
        name: logo.name,
        commonsTitle: logo.commonsTitle,
        metaPageUrl: commonsFilePageUrl(logo)
      })),
    [baseLogos]
  );
  const logoLibraryEntries = useMemo(() => [...coreLibraryEntries, ...AFFILIATE_LOGOS], [coreLibraryEntries]);

  const collisionSafeLogoScale = useMemo(() => getCollisionSafeLogoScale(ringRadius, ringLogos.length), [ringRadius, ringLogos.length]);
  const manualLogoScale = Math.min(ringScale, collisionSafeLogoScale);
  const effectiveRingScale = autoScaleLogos ? getAutoLogoScale(ringRadius, ringLogos.length) : manualLogoScale;
  const centerCollisionSafeScale = getCenterCollisionSafeScale(ringRadius, effectiveRingScale);
  const manualCenterScale = Math.min(centerScale, centerCollisionSafeScale);
  const effectiveCenterScale = autoScaleLogos ? getCenterLogoScale(ringRadius, effectiveRingScale) : manualCenterScale;
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

  const attributionText = useMemo(
    () => buildAttribution(usedLogos, { format: attributionFormat }),
    [usedLogos, attributionFormat]
  );

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
      centerScale,
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
      centerScale,
      showGuides,
      backdrop
    ]
  );

  useDesignUrlSync(designConfig);

  // Apply a complete saved/imported config (custom presets). Built-in presets use
  // applyPreset below, which intentionally leaves unspecified fields untouched.
  function applyConfig(config) {
    const merged = normalizeConfig(config);
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
    setCenterScale(merged.centerScale);
    setShowGuides(merged.showGuides);
    setBackdrop(merged.backdrop);
  }

  // Seed manual sizes from the current auto values when leaving auto mode, so the
  // sliders start where the design already looks instead of jumping.
  function handleAutoScaleChange(next) {
    if (!next) {
      setRingScale(effectiveRingScale);
      setCenterScale(effectiveCenterScale);
    }
    setAutoScaleLogos(next);
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

  function handleSaveDesign() {
    const name = window.prompt('Name this design');
    if (name && name.trim()) savePreset(name.trim(), designConfig);
  }

  function applyPreset(preset) {
    setCenterLogo(preset.center);
    setRingLogos(preset.ring);
    setHaloColor(preset.haloColor);
    setHaloOpacity(preset.haloOpacity);
    setHaloRadius(preset.haloRadius);
    setRingRadius(preset.ringRadius);
    setRingScale(preset.ringScale);
    setCenterScale(preset.centerScale ?? getCenterLogoScale(preset.ringRadius, preset.ringScale));
    setCenterLateralAnchors(preset.centerLateralAnchors ?? true);
  }

  function selectCenterLogo(id) {
    setCenterLogo(id);
    setRingLogos((current) => (current.includes(id) && current.length > 1 ? current.filter((itemId) => itemId !== id) : current));
  }

  async function handleAddCommonsLogo(event) {
    event.preventDefault();
    const value = commonsInput.trim();
    if (!value || commonsLoading) return;

    setCommonsLoading(true);
    setCommonsStatus(null);
    try {
      const logo = await fetchCommonsLogo(value);
      // Replace any earlier fetch of the same file, then append.
      setCustomLogos((current) => [...current.filter((item) => item.id !== logo.id), logo]);
      setCommonsInput('');
      setCommonsStatus({ type: 'success', message: `Added “${logo.name}”.` });
    } catch (error) {
      setCommonsStatus({ type: 'error', message: error.message || 'Could not add that logo.' });
    } finally {
      setCommonsLoading(false);
    }
  }

  async function addLibraryLogoToRing(entry) {
    const logo = entry.kind === 'core' ? logoById.get(entry.id) : await ensureAffiliateLogo(entry);
    if (!logo || logo.id === centerLogo) return;

    setRingLogos((current) => (current.includes(logo.id) ? current : [...current, logo.id]));
  }

  async function setLibraryLogoAsCenter(entry) {
    const logo = entry.kind === 'core' ? logoById.get(entry.id) : await ensureAffiliateLogo(entry);
    if (logo) selectCenterLogo(logo.id);
  }

  function toggleRingItem(id) {
    if (id === centerLogo) return;

    setRingLogos((current) => {
      if (!current.includes(id)) return [...current, id];
      return current.length > 1 ? current.filter((itemId) => itemId !== id) : current;
    });
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

  function moveRingItem(from, to) {
    setRingLogos((current) => {
      if (from === to || to < 0 || to >= current.length) return current;
      const updated = [...current];
      const [moved] = updated.splice(from, 1);
      updated.splice(to, 0, moved);
      return updated;
    });
  }

  // Resolve the chosen export background to a fill. "Match preview" follows the
  // current backdrop; JPG has no alpha, so a transparent choice falls back to white.
  function resolveExportBackdrop() {
    return exportBackground === 'preview' ? backdrop : exportBackground;
  }

  function resolveExportFill(forJpg) {
    const fill = getBackdropFill(resolveExportBackdrop());
    return forJpg && !fill ? '#ffffff' : fill;
  }

  function buildExportCanvas(forJpg) {
    const canvas = document.createElement('canvas');
    drawWheel(canvas, exportSize, {
      ...wheelSettings,
      backdrop: resolveExportBackdrop(),
      backdropFill: resolveExportFill(forJpg)
    });
    return canvas;
  }

  function generateVectorSvg() {
    return generateWheelSvg({
      backdrop: resolveExportBackdrop(),
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
          <AppPicker />
        </div>
        <div className="top-band-actions">
          <DesignToolbar
            presets={customPresets}
            onSave={handleSaveDesign}
            onApply={applyConfig}
            onDelete={deletePreset}
            onExport={exportPresets}
            onImport={importPresetsFromFile}
          />
          <RefreshButton syncState={syncState} onRefresh={refreshCommons} />
          <ThemeToggle theme={theme} onChange={setTheme} />
        </div>
      </header>

      <div className="app-body">
        <aside className="sidebar control-scrollbar" aria-label="Logo wheel controls">
          <div className="sidebar-body">
            <section className="control-section" aria-labelledby="ready-designs-heading">
              <SectionHeader id="ready-designs-heading" accent="blue" icon={<Sliders className="h-4 w-4" />} title="1. Ready designs" />

              <div className="preset-grid" role="group" aria-label="Ready designs">
                {PRESETS.map((preset) => (
                  <button
                    key={preset.name}
                    type="button"
                    onClick={() => applyPreset(preset)}
                    className="preset-button"
                    aria-label={`Apply ${preset.name} (${preset.ring.length} ring logos)`}
                  >
                    <strong>{preset.name}</strong>
                    <span>{preset.ring.length} logos</span>
                  </button>
                ))}
              </div>

              <select
                className="preset-picker"
                aria-label="Ready designs"
                value=""
                onChange={(event) => {
                  const preset = PRESETS[Number(event.target.value)];
                  if (preset) applyPreset(preset);
                }}
              >
                <option value="" disabled>
                  Choose a ready design…
                </option>
                {PRESETS.map((preset, index) => (
                  <option key={preset.name} value={index}>
                    {preset.name} ({preset.ring.length} logos)
                  </option>
                ))}
              </select>
            </section>

            <section className="control-section" aria-labelledby="central-logo-heading">
              <SectionHeader id="central-logo-heading" accent="red" title="2. Central Logo" meta={`ID: ${centerLogo}`} />
              <CentralLogoPicker logos={allLogos} selectedLogo={selectedCenterLogo} value={centerLogo} onChange={selectCenterLogo} />
              <button type="button" className="library-inline-button" onClick={() => setLibraryOpen(true)}>
                <Library className="h-4 w-4" aria-hidden="true" focusable="false" />
                <span>Browse logo library</span>
              </button>
            </section>

            <section className="control-section" aria-labelledby="ring-distribution-heading">
              <SectionHeader id="ring-distribution-heading" accent="green" title="3. Surround Ring Distribution" meta={`Active: ${ringLogos.length}`} />
              <p className="section-note" id="ring-distribution-note">
                Current spacing <strong>{(360 / ringLogos.length).toFixed(1)} degrees</strong>. The central logo is excluded from this ring.
              </p>

              <div className="library-section-tools">
                <button type="button" className="secondary-action library-open-action" onClick={() => setLibraryOpen(true)}>
                  <Library className="h-4 w-4" aria-hidden="true" focusable="false" />
                  <span>Logo library</span>
                </button>
                <span>{AFFILIATE_LOGOS.length} affiliate SVG logos available on demand</span>
              </div>

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
                  <p className="section-note">Drag the handle to reorder, or use the arrow buttons.</p>
                  <SequenceList ringLogos={ringLogos} logoById={logoById} onMove={moveRingItem} onShift={shiftRingItem} onRemove={toggleRingItem} />
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
                <ToggleSwitch checked={autoScaleLogos} onChange={handleAutoScaleChange} label="Auto scale logo size" />
              </div>

              {autoScaleLogos ? (
                <div className="auto-scale-summary">
                  <span>Auto logo size</span>
                  <strong>
                    Ring x{effectiveRingScale.toFixed(2)} / Center x{effectiveCenterScale.toFixed(2)}
                  </strong>
                </div>
              ) : (
                <>
                  <RangeControl label="Ring logo size" valueLabel={`x${manualLogoScale.toFixed(2)} / max x${collisionSafeLogoScale.toFixed(2)}`}>
                    <input
                      type="range"
                      min={MIN_LOGO_SCALE}
                      max={collisionSafeLogoScale}
                      step="0.01"
                      value={manualLogoScale}
                      onChange={(event) => setRingScale(parseFloat(event.target.value))}
                      aria-valuetext={`Ring logo scale ${manualLogoScale.toFixed(2)}, maximum ${collisionSafeLogoScale.toFixed(2)}`}
                    />
                  </RangeControl>

                  <RangeControl label="Center logo size" valueLabel={`x${manualCenterScale.toFixed(2)} / max x${centerCollisionSafeScale.toFixed(2)}`}>
                    <input
                      type="range"
                      min={MIN_LOGO_SCALE}
                      max={centerCollisionSafeScale}
                      step="0.01"
                      value={manualCenterScale}
                      onChange={(event) => setCenterScale(parseFloat(event.target.value))}
                      aria-valuetext={`Center logo scale ${manualCenterScale.toFixed(2)}, maximum ${centerCollisionSafeScale.toFixed(2)}`}
                    />
                  </RangeControl>
                </>
              )}
            </section>

            <section className="control-section" aria-labelledby="display-heading">
              <SectionHeader id="display-heading" accent="blue" icon={<Sliders className="h-4 w-4" />} title="5. Display" />

              <label className="field-row">
                <span>Backdrop</span>
                <select value={backdrop} onChange={(event) => setBackdrop(event.target.value)} aria-label="Canvas backdrop">
                  {BACKDROP_THEMES.map((backdropTheme) => (
                    <option key={backdropTheme.id} value={backdropTheme.id}>
                      {backdropTheme.label}
                    </option>
                  ))}
                </select>
              </label>

              <div className="alignment-row">
                <div>
                  <strong>Show guides</strong>
                  <span>Overlay the ring circle and spokes on the preview.</span>
                </div>
                <ToggleSwitch checked={showGuides} onChange={setShowGuides} label="Show guides" />
              </div>
            </section>

            <section className="upload-panel" aria-labelledby="commons-add-heading">
              <h3 id="commons-add-heading">
                <Cloud className="h-3.5 w-3.5" aria-hidden="true" focusable="false" />
                Add a Commons logo
              </h3>
              <p>Paste a Wikimedia Commons file URL or title (e.g. File:Example.svg). SVG files only.</p>
              <form className="commons-add-form" onSubmit={handleAddCommonsLogo}>
                <input
                  type="text"
                  value={commonsInput}
                  onChange={(event) => setCommonsInput(event.target.value)}
                  placeholder="commons.wikimedia.org/wiki/File:… or File:….svg"
                  aria-label="Wikimedia Commons file URL or title"
                  autoComplete="off"
                  spellCheck="false"
                />
                <button type="submit" className="secondary-action" disabled={commonsLoading || !commonsInput.trim()}>
                  {commonsLoading ? (
                    <RefreshCw className="h-4 w-4 animate-spin" aria-hidden="true" focusable="false" />
                  ) : (
                    <Download className="h-4 w-4" aria-hidden="true" focusable="false" />
                  )}
                  <span>{commonsLoading ? 'Fetching…' : 'Fetch'}</span>
                </button>
              </form>
              {commonsStatus && (
                <p
                  className={commonsStatus.type === 'error' ? 'error-text' : 'section-note'}
                  role={commonsStatus.type === 'error' ? 'alert' : 'status'}
                >
                  {commonsStatus.message}
                </p>
              )}
            </section>

            <section className="control-section" aria-labelledby="attribution-heading">
              <SectionHeader id="attribution-heading" accent="blue" title="6. Attribution" meta={`${usedLogos.length} logos`} />
              <p className="section-note">Credit for the logos in this design, with author and license where Commons provides them.</p>

              <div className="attribution-format" role="group" aria-label="Attribution format">
                <button type="button" className={attributionFormat === 'text' ? 'active' : ''} aria-pressed={attributionFormat === 'text'} onClick={() => setAttributionFormat('text')}>
                  Plain text
                </button>
                <button
                  type="button"
                  className={attributionFormat === 'markdown' ? 'active' : ''}
                  aria-pressed={attributionFormat === 'markdown'}
                  onClick={() => setAttributionFormat('markdown')}
                >
                  Markdown
                </button>
              </div>

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

      <LogoLibraryDialog
        centerLogo={centerLogo}
        entries={logoLibraryEntries}
        errorById={affiliateErrorById}
        loadingById={affiliateLoadingById}
        logoById={logoById}
        onAddToRing={addLibraryLogoToRing}
        onClose={() => setLibraryOpen(false)}
        onRemoveFromRing={toggleRingItem}
        onSetCenter={setLibraryLogoAsCenter}
        open={libraryOpen}
        ringLogos={ringLogos}
      />

      <footer className="app-footer">
        <span className="footer-sync">{syncState.detail || syncState.label}</span>
        <span aria-hidden="true">/</span>
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
