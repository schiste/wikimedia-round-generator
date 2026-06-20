import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Check, Library, Minus, Plus, RefreshCw, Search, X } from 'lucide-react';
import { AFFILIATE_LOGO_KIND_COUNTS, AFFILIATE_LOGO_KIND_LABELS } from '../data/affiliateLogos.js';
import { LogoGlyph } from './LogoGlyph.jsx';

const LOGO_LIBRARY_FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'core', label: 'Core' },
  { id: 'chapter', label: AFFILIATE_LOGO_KIND_LABELS.chapter },
  { id: 'thematic', label: AFFILIATE_LOGO_KIND_LABELS.thematic },
  { id: 'user-group', label: AFFILIATE_LOGO_KIND_LABELS['user-group'] }
];

function normalizeSearchText(value) {
  return String(value || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function LibraryLogoMark({ entry, logo }) {
  if (logo?.svg) {
    return <LogoGlyph logo={logo} className="library-logo-glyph" />;
  }

  return (
    <span className="library-logo-placeholder" aria-hidden="true">
      {(entry.code || entry.name || '?').slice(0, 3)}
    </span>
  );
}

export function LogoLibraryDialog({
  centerLogo,
  entries,
  errorById,
  loadingById,
  logoById,
  onAddToRing,
  onClose,
  onRemoveFromRing,
  onSetCenter,
  open,
  ringLogos
}) {
  const [query, setQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('all');
  const searchRef = useRef(null);

  const counts = useMemo(() => {
    const next = { all: entries.length, core: 0, ...AFFILIATE_LOGO_KIND_COUNTS };
    entries.forEach((entry) => {
      if (entry.kind === 'core') next.core += 1;
    });
    return next;
  }, [entries]);

  const filteredEntries = useMemo(() => {
    const tokens = normalizeSearchText(query).split(/\s+/).filter(Boolean);

    return entries.filter((entry) => {
      if (activeFilter !== 'all' && entry.kind !== activeFilter) return false;
      if (tokens.length === 0) return true;

      const searchText = normalizeSearchText(`${entry.name} ${entry.code} ${entry.kindLabel} ${entry.commonsTitle}`);
      return tokens.every((token) => searchText.includes(token));
    });
  }, [activeFilter, entries, query]);

  useEffect(() => {
    if (!open) return undefined;

    const timer = window.setTimeout(() => searchRef.current?.focus(), 0);
    function handleKey(event) {
      if (event.key === 'Escape') onClose();
    }

    document.addEventListener('keydown', handleKey);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener('keydown', handleKey);
    };
  }, [onClose, open]);

  if (!open) return null;

  return (
    <div
      className="library-dialog-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section className="library-dialog" role="dialog" aria-modal="true" aria-labelledby="logo-library-title">
        <header className="library-dialog-header">
          <div>
            <Library className="h-4 w-4" aria-hidden="true" focusable="false" />
            <h2 id="logo-library-title">Logo library</h2>
          </div>
          <button type="button" className="library-close-button" onClick={onClose} aria-label="Close logo library">
            <X className="h-4 w-4" aria-hidden="true" focusable="false" />
          </button>
        </header>

        <div className="library-toolbar">
          <label className="library-search">
            <Search className="h-4 w-4" aria-hidden="true" focusable="false" />
            <input
              ref={searchRef}
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search by name, code, or project"
              aria-label="Search logo library"
            />
          </label>

          <div className="library-filter-row" role="group" aria-label="Logo library filters">
            {LOGO_LIBRARY_FILTERS.map((filter) => (
              <button
                key={filter.id}
                type="button"
                aria-pressed={activeFilter === filter.id}
                className={activeFilter === filter.id ? 'active' : ''}
                onClick={() => setActiveFilter(filter.id)}
              >
                <span>{filter.label}</span>
                <b>{counts[filter.id] || 0}</b>
              </button>
            ))}
          </div>
        </div>

        <div className="library-results-summary" role="status" aria-live="polite">
          <span>{filteredEntries.length} logos</span>
          <span>SVG affiliate logos only</span>
        </div>

        <div className="library-results control-scrollbar">
          {filteredEntries.length === 0 ? (
            <p className="library-empty">No matching logos.</p>
          ) : (
            filteredEntries.map((entry) => {
              const loadedLogo = logoById.get(entry.id);
              const isCenter = entry.id === centerLogo;
              const isInRing = ringLogos.includes(entry.id);
              const isLoading = Boolean(loadingById[entry.id]);
              const error = errorById[entry.id];

              return (
                <article key={entry.id} className={`library-card${isCenter || isInRing ? ' library-card-active' : ''}`}>
                  <LibraryLogoMark entry={entry} logo={loadedLogo} />
                  <div className="library-card-main">
                    <div className="library-card-title">
                      <strong title={entry.name}>{entry.name}</strong>
                      {entry.code && <span>{entry.code}</span>}
                    </div>
                    <div className="library-card-meta">
                      <span>{entry.kindLabel}</span>
                      {entry.metaPageUrl && (
                        <a href={entry.metaPageUrl} target="_blank" rel="noreferrer">
                          Meta
                        </a>
                      )}
                    </div>
                    {error && <p className="library-card-error">{error}</p>}
                  </div>
                  <div className="library-card-actions">
                    <button type="button" onClick={() => onSetCenter(entry)} disabled={isCenter || isLoading}>
                      {isLoading ? (
                        <RefreshCw className="h-3.5 w-3.5 animate-spin" aria-hidden="true" focusable="false" />
                      ) : (
                        <Check className="h-3.5 w-3.5" aria-hidden="true" focusable="false" />
                      )}
                      <span>{isCenter ? 'Center' : 'Set center'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => (isInRing ? onRemoveFromRing(entry.id) : onAddToRing(entry))}
                      disabled={isCenter || isLoading}
                    >
                      {isInRing ? (
                        <Minus className="h-3.5 w-3.5" aria-hidden="true" focusable="false" />
                      ) : (
                        <Plus className="h-3.5 w-3.5" aria-hidden="true" focusable="false" />
                      )}
                      <span>{isInRing ? 'Remove' : 'Add'}</span>
                    </button>
                  </div>
                </article>
              );
            })
          )}
        </div>
      </section>
    </div>
  );
}
