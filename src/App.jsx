import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  Check,
  Cloud,
  Download,
  Image as ImageIcon,
  Moon,
  RefreshCw,
  Sliders,
  Sparkles,
  Sun,
  Trash2,
  Upload
} from 'lucide-react';
import { BACKDROP_THEMES, DEFAULT_LOGOS, HALO_COLORS, PRESETS, getBackdropFill } from './data/logos.js';
import { useCommonsLogoSync } from './hooks/useCommonsLogoSync.js';
import { useLogoCatalog } from './hooks/useLogoCatalog.js';
import { useLogoImageCache } from './hooks/useLogoImageCache.js';
import { useTheme } from './hooks/useTheme.js';
import { downloadBlob, downloadCanvasPng } from './utils/download.js';
import {
  MIN_LOGO_SCALE,
  getAutoLogoScale,
  getCenterLogoScale,
  getCollisionSafeLogoScale,
  getRingAngle
} from './utils/layout.js';
import {
  CANVAS_SIZE,
  LOGO_VIEWBOX_SIZE,
  fitIntoSquare,
  hexToRgb,
  sanitizeSvgMarkup
} from './utils/svg.js';
import { generateWheelSvg } from './utils/wheelSvg.js';

const INITIAL_RING_LOGOS = PRESETS[0].ring;

function LogoGlyph({ logo, className = 'logo-glyph' }) {
  return <div className={className} dangerouslySetInnerHTML={{ __html: logo.svg }} />;
}

function drawLogoOnCanvas(ctx, imageEntry, x, y, size) {
  if (!imageEntry?.image) return;
  const fitted = fitIntoSquare(size, imageEntry.aspectRatio);
  ctx.drawImage(imageEntry.image, x - fitted.width / 2, y - fitted.height / 2, fitted.width, fitted.height);
}

function SectionHeader({ accent = 'blue', icon, title, meta }) {
  return (
    <div className="section-heading">
      <div className="section-title">
        <span className={`status-dot status-dot-${accent}`} />
        {icon}
        <h2>{title}</h2>
      </div>
      {meta && <span className="section-meta">{meta}</span>}
    </div>
  );
}

function ToggleSwitch({ checked, onChange, label }) {
  return (
    <label className="switch-control">
      <span>{label}</span>
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
      <span className="switch-track" />
    </label>
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
    <div className="theme-toggle" aria-label="Interface theme">
      <button className={theme === 'light' ? 'active' : ''} onClick={() => onChange('light')} aria-label="Light interface">
        <Sun className="h-4 w-4" />
      </button>
      <button className={theme === 'dark' ? 'active' : ''} onClick={() => onChange('dark')} aria-label="Dark interface">
        <Moon className="h-4 w-4" />
      </button>
    </div>
  );
}

function CommonsStatus({ syncState, onRefresh }) {
  const isSyncing = syncState.status === 'syncing';
  const isLive = syncState.status === 'live' || syncState.status === 'cached';
  const Icon = isLive ? Cloud : AlertTriangle;

  return (
    <div className={`commons-status commons-status-${syncState.status}`}>
      <Icon className="h-4 w-4" />
      <div>
        <strong>{syncState.label}</strong>
        <span>{syncState.detail}</span>
      </div>
      <button onClick={() => onRefresh({ force: true })} disabled={isSyncing} aria-label="Refresh Commons logos">
        <RefreshCw className={`h-4 w-4 ${isSyncing ? 'animate-spin' : ''}`} />
      </button>
    </div>
  );
}

function LogoButton({ logo, active, disabled, onClick, accent = 'blue' }) {
  const isCommons = Boolean(logo.sha1 || logo.sourceUrl);

  return (
    <button
      disabled={disabled}
      onClick={onClick}
      className={`logo-tile ${active ? `logo-tile-active logo-tile-${accent}` : ''} ${disabled ? 'logo-tile-disabled' : ''}`}
      title={logo.commonsPageTitle || logo.name}
    >
      <LogoGlyph logo={logo} />
      <span>{logo.name}</span>
      {isCommons && <i className="commons-mark" aria-label="Loaded from Wikimedia Commons" />}
      {active && (
        <b>
          <Check className="h-2.5 w-2.5" />
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
          <span>{sourceLabel}</span>
        </div>
      </div>

      <label className="central-logo-select">
        <span>Change central logo</span>
        <select value={value} onChange={(event) => onChange(event.target.value)}>
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

export default function App() {
  const canvasRef = useRef(null);

  const [theme, setTheme] = useTheme();
  const { remoteLogos, syncState, refreshCommons } = useCommonsLogoSync(DEFAULT_LOGOS);
  const [customLogos, setCustomLogos] = useState([]);
  const { activeCommonsCount, allLogos, baseLogos, logoById } = useLogoCatalog({
    fallbackLogos: DEFAULT_LOGOS,
    remoteLogos,
    customLogos
  });

  const [centerLogo, setCenterLogo] = useState('wikimedia');
  const [ringLogos, setRingLogos] = useState(INITIAL_RING_LOGOS);

  const [showHalo, setShowHalo] = useState(true);
  const [haloColor, setHaloColor] = useState('#3470ff');
  const [haloOpacity, setHaloOpacity] = useState(0.2);
  const [haloRadius, setHaloRadius] = useState(260);

  const [ringRadius, setRingRadius] = useState(210);
  const [ringRotation, setRingRotation] = useState(0);
  const [centerLateralAnchors, setCenterLateralAnchors] = useState(true);
  const [autoScaleLogos, setAutoScaleLogos] = useState(true);
  const [ringScale, setRingScale] = useState(0.75);

  const [showGuides, setShowGuides] = useState(false);
  const [backdrop, setBackdrop] = useState('transparent');
  const [isRendering, setIsRendering] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const imageCache = useLogoImageCache(allLogos);
  const backdropFill = getBackdropFill(backdrop);

  const collisionSafeLogoScale = useMemo(() => getCollisionSafeLogoScale(ringRadius, ringLogos.length), [ringRadius, ringLogos.length]);
  const manualLogoScale = Math.min(ringScale, collisionSafeLogoScale);
  const effectiveRingScale = autoScaleLogos ? getAutoLogoScale(ringRadius, ringLogos.length) : manualLogoScale;
  const effectiveCenterScale = getCenterLogoScale(ringRadius, effectiveRingScale);
  const selectedCenterLogo = logoById.get(centerLogo) || allLogos[0];

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    setIsRendering(true);

    canvas.width = CANVAS_SIZE;
    canvas.height = CANVAS_SIZE;
    const center = CANVAS_SIZE / 2;

    ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

    if (backdropFill) {
      ctx.fillStyle = backdropFill;
      ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
    }

    if (showHalo) {
      const rgb = hexToRgb(haloColor);
      const rOuter = Math.max(ringRadius + 10, haloRadius);
      const rInner = Math.max(0, 2 * ringRadius - rOuter);

      const gradient = ctx.createRadialGradient(center, center, rInner, center, center, rOuter);
      gradient.addColorStop(0, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0)`);
      gradient.addColorStop(0.5, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${haloOpacity})`);
      gradient.addColorStop(1, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0)`);

      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(center, center, rOuter, 0, Math.PI * 2);
      ctx.fill();
    }

    if (showGuides) {
      ctx.strokeStyle = backdrop === 'dark' ? 'rgba(255, 255, 255, 0.15)' : 'rgba(15, 23, 42, 0.12)';
      ctx.lineWidth = 2;
      ctx.setLineDash([8, 8]);

      ctx.beginPath();
      ctx.arc(center, center, ringRadius, 0, Math.PI * 2);
      ctx.stroke();

      ringLogos.forEach((_, index) => {
        const angle = getRingAngle(index, ringLogos.length, ringRotation, centerLateralAnchors);
        const spokeX = center + ringRadius * Math.cos(angle);
        const spokeY = center + ringRadius * Math.sin(angle);

        ctx.beginPath();
        ctx.moveTo(center, center);
        ctx.lineTo(spokeX, spokeY);
        ctx.stroke();
      });

      ctx.setLineDash([]);
    }

    drawLogoOnCanvas(ctx, imageCache[centerLogo], center, center, LOGO_VIEWBOX_SIZE * effectiveCenterScale);

    ringLogos.forEach((id, index) => {
      const ringImageEntry = imageCache[id];
      if (!ringImageEntry) return;

      const angle = getRingAngle(index, ringLogos.length, ringRotation, centerLateralAnchors);
      const x = center + ringRadius * Math.cos(angle);
      const y = center + ringRadius * Math.sin(angle);

      drawLogoOnCanvas(ctx, ringImageEntry, x, y, LOGO_VIEWBOX_SIZE * effectiveRingScale);
    });

    setIsRendering(false);
  }, [
    backdrop,
    backdropFill,
    centerLogo,
    effectiveCenterScale,
    effectiveRingScale,
    haloColor,
    haloOpacity,
    haloRadius,
    imageCache,
    ringLogos,
    ringRadius,
    ringRotation,
    showGuides,
    showHalo,
    centerLateralAnchors
  ]);

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

  function generateVectorSvg() {
    return generateWheelSvg({
      backdrop,
      backdropFill,
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

  function downloadPNG() {
    downloadCanvasPng(canvasRef.current, `wikimedia-wheel-${centerLogo}.png`);
  }

  return (
    <div className={`app-shell theme-${theme}`}>
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
        <aside className="sidebar control-scrollbar">
          <div className="sidebar-body">
            <section className="control-section">
              <SectionHeader accent="blue" icon={<Sliders className="h-4 w-4" />} title="1. Visual Presets" />
              <div className="preset-grid">
                {PRESETS.map((preset) => (
                  <button key={preset.name} onClick={() => applyPreset(preset)} className="preset-button">
                    <strong>{preset.name}</strong>
                    <span>
                      {preset.ring.length} ring items / Center: {preset.center}
                    </span>
                  </button>
                ))}
              </div>
            </section>

            <section className="control-section">
              <SectionHeader accent="red" title="2. Central Logo" meta={`ID: ${centerLogo}`} />
              <CentralLogoPicker logos={allLogos} selectedLogo={selectedCenterLogo} value={centerLogo} onChange={selectCenterLogo} />
            </section>

            <section className="control-section">
              <SectionHeader accent="green" title="3. Surround Ring Distribution" meta={`Active: ${ringLogos.length}`} />
              <p className="section-note">
                Current spacing <strong>{(360 / ringLogos.length).toFixed(1)} deg</strong>. Commons-backed logos are marked with a small blue source dot.
              </p>

              <div className="logo-grid">
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
                <div className="sequence-panel">
                  <strong>Sequence Order Clockwise</strong>
                  <div className="sequence-list control-scrollbar">
                    {ringLogos.map((id, index) => {
                      const item = logoById.get(id);
                      if (!item) return null;

                      return (
                        <div key={id} className="sequence-row">
                          <span>
                            {index + 1}. {item.name}
                          </span>
                          <div>
                            <button disabled={index === 0} onClick={() => shiftRingItem(index, -1)} aria-label={`Move ${item.name} earlier`}>
                              <ArrowUp className="h-3.5 w-3.5" />
                            </button>
                            <button disabled={index === ringLogos.length - 1} onClick={() => shiftRingItem(index, 1)} aria-label={`Move ${item.name} later`}>
                              <ArrowDown className="h-3.5 w-3.5" />
                            </button>
                            <button onClick={() => toggleRingItem(id)} aria-label={`Remove ${item.name}`}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </section>

            <section className="halo-panel">
              <div className="panel-title-row">
                <div>
                  <Sparkles className="h-4 w-4" />
                  <h3>Surround Halo</h3>
                </div>
                <ToggleSwitch checked={showHalo} onChange={setShowHalo} label="" />
              </div>

              {showHalo && (
                <div className="panel-controls">
                  <div>
                    <label className="compact-label">Halo hue</label>
                    <div className="color-row">
                      {HALO_COLORS.map((color) => (
                        <button
                          key={color.hex}
                          onClick={() => setHaloColor(color.hex)}
                          style={{ backgroundColor: color.hex }}
                          className={haloColor === color.hex ? 'active' : ''}
                          title={color.name}
                          aria-label={color.name}
                        />
                      ))}
                      <input type="color" value={haloColor} onChange={(event) => setHaloColor(event.target.value)} aria-label="Custom halo color" />
                    </div>
                  </div>

                  <RangeControl label="Glow intensity" valueLabel={`${Math.round(haloOpacity * 100)}%`}>
                    <input type="range" min="0.1" max="1" step="0.05" value={haloOpacity} onChange={(event) => setHaloOpacity(parseFloat(event.target.value))} />
                  </RangeControl>

                  <RangeControl label="Outer glow boundary" valueLabel={`${haloRadius}px`}>
                    <input type="range" min="100" max="400" value={haloRadius} onChange={(event) => setHaloRadius(parseInt(event.target.value, 10))} />
                  </RangeControl>
                </div>
              )}
            </section>

            <section className="control-section">
              <SectionHeader accent="amber" icon={<Sliders className="h-4 w-4" />} title="4. Layout Dimensions" />

              <RangeControl label="Ring spread radius" valueLabel={`${ringRadius}px`}>
                <input type="range" min="100" max="300" value={ringRadius} onChange={(event) => setRingRadius(parseInt(event.target.value, 10))} />
              </RangeControl>

              <RangeControl label="Ring angle rotation" valueLabel={`${ringRotation} deg`}>
                <input type="range" min="0" max="360" value={ringRotation} onChange={(event) => setRingRotation(parseInt(event.target.value, 10))} />
              </RangeControl>

              <div className="alignment-row">
                <div>
                  <strong>Center side anchors</strong>
                  <span>Align the strongest lateral ring position with the center logo.</span>
                </div>
                <ToggleSwitch checked={centerLateralAnchors} onChange={setCenterLateralAnchors} label="" />
              </div>

              <div className="alignment-row">
                <div>
                  <strong>Auto scale logo size</strong>
                  <span>Fit the current logo count and ring radius without collisions.</span>
                </div>
                <ToggleSwitch checked={autoScaleLogos} onChange={setAutoScaleLogos} label="" />
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
                  />
                </RangeControl>
              )}
            </section>

            <section className="upload-panel">
              <h3>
                <Upload className="h-3.5 w-3.5" />
                Upload Custom Logo
              </h3>
              <p>SVG, PNG, or JPG files become local-only custom nodes.</p>
              <label>
                <ImageIcon className="h-8 w-8" />
                <span>Click to select file</span>
                <small>SVG vector formats recommended</small>
                <input type="file" accept=".svg,image/png,image/jpeg" onChange={handleUpload} />
              </label>
              {uploadError && <p className="error-text">{uploadError}</p>}
            </section>
          </div>
        </aside>

        <main className="workspace">
          <div className="workspace-toolbar">
            <div className="backdrop-controls">
              <span>Backdrop</span>
              <div>
                {BACKDROP_THEMES.map((backdropTheme) => (
                  <button key={backdropTheme.id} onClick={() => setBackdrop(backdropTheme.id)} className={backdrop === backdropTheme.id ? 'active' : ''}>
                    {backdropTheme.label}
                  </button>
                ))}
              </div>
            </div>

            <ToggleSwitch checked={showGuides} onChange={setShowGuides} label="Guides" />
          </div>

          <div className="canvas-stage">
            <div className="canvas-frame">
              <div className={backdrop === 'transparent' ? 'bg-checkerboard canvas-backdrop' : 'canvas-backdrop'} />
              <canvas ref={canvasRef} />

              {isRendering && (
                <div className="render-overlay">
                  <RefreshCw className="h-8 w-8 animate-spin" />
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
            <div>
              <strong>Publish Design Assets</strong>
              <span>Exports use the currently rendered logo source.</span>
            </div>

            <div>
              <button onClick={downloadPNG} className="secondary-action">
                <ImageIcon className="h-4 w-4" />
                <span>Download PNG</span>
              </button>

              <button onClick={downloadSVG} className="primary-action">
                <Download className="h-4 w-4" />
                <span>Download SVG</span>
              </button>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
