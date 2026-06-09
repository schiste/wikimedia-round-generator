export const DEFAULT_LOGOS = [
  {
    id: 'wikimedia',
    name: 'Wikimedia',
    commonsTitle: 'File:Wikimedia-logo.svg',
    color: '#3366cc',
    svg: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
      <circle cx="50" cy="52" r="14" fill="#d32f2f"/>
      <path d="M15,50 A35,35 0 0,0 85,50" fill="none" stroke="#3f51b5" stroke-width="12" stroke-linecap="round"/>
      <path d="M30,28 A25,25 0 0,1 70,28" fill="none" stroke="#4caf50" stroke-width="10" stroke-linecap="round"/>
    </svg>`
  },
  {
    id: 'wikipedia',
    name: 'Wikipedia',
    commonsTitle: 'File:Wikipedia-logo-v2.svg',
    color: '#000000',
    svg: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
      <circle cx="50" cy="50" r="45" fill="none" stroke="#dddddd" stroke-width="2" stroke-dasharray="4,4"/>
      <path d="M18,25 L38,80 L50,38 L62,80 L82,25" fill="none" stroke="#111111" stroke-width="9" stroke-linejoin="round" stroke-linecap="round"/>
      <circle cx="50" cy="50" r="4" fill="#111111"/>
    </svg>`
  },
  {
    id: 'commons',
    name: 'Wikimedia Commons',
    commonsTitle: 'File:Commons-logo.svg',
    color: '#006699',
    svg: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
      <circle cx="50" cy="50" r="34" fill="none" stroke="#006699" stroke-width="8"/>
      <path d="M18,18 L36,36 M36,25 L36,36 L25,36" fill="none" stroke="#339966" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M82,18 L64,36 M64,25 L64,36 L75,36" fill="none" stroke="#339966" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M50,50 L50,84 M42,76 L50,84 L58,76" fill="none" stroke="#006699" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>
      <circle cx="50" cy="50" r="9" fill="#d32f2f"/>
    </svg>`
  },
  {
    id: 'wikidata',
    name: 'Wikidata',
    commonsTitle: 'File:Wikidata-logo.svg',
    color: '#005588',
    svg: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
      <rect x="15" y="15" width="12" height="70" fill="#d32f2f" rx="3"/>
      <rect x="33" y="25" width="8" height="50" fill="#d32f2f" rx="2"/>
      <rect x="47" y="15" width="10" height="70" fill="#4caf50" rx="3"/>
      <rect x="63" y="25" width="10" height="50" fill="#2196f3" rx="3"/>
      <rect x="79" y="15" width="8" height="70" fill="#2196f3" rx="2"/>
    </svg>`
  },
  {
    id: 'wikisource',
    name: 'Wikisource',
    commonsTitle: 'File:Wikisource-logo.svg',
    color: '#0d47a1',
    svg: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
      <polygon points="50,12 82,72 18,72" fill="#90caf9" stroke="#0d47a1" stroke-width="6" stroke-linejoin="round"/>
      <polygon points="50,12 66,72 34,72" fill="#42a5f5" stroke="#0d47a1" stroke-width="4" stroke-linejoin="round"/>
      <path d="M10,82 L90,82" stroke="#0d47a1" stroke-width="7" stroke-linecap="round"/>
    </svg>`
  },
  {
    id: 'wikibooks',
    name: 'Wikibooks',
    commonsTitle: 'File:Wikibooks-logo.svg',
    color: '#00a0b0',
    svg: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
      <path d="M18,74 L50,86 L82,74 L82,22 L50,34 L18,22 Z" fill="#fafafa" stroke="#222" stroke-width="6" stroke-linejoin="round"/>
      <path d="M50,34 L50,86" stroke="#222" stroke-width="6"/>
      <path d="M28,34 L44,39 M28,47 L44,52 M28,60 L44,65" stroke="#00a0b0" stroke-width="4" stroke-linecap="round"/>
      <path d="M72,34 L56,39 M72,47 L56,52 M72,60 L56,65" stroke="#4caf50" stroke-width="4" stroke-linecap="round"/>
    </svg>`
  },
  {
    id: 'wikiquote',
    name: 'Wikiquote',
    commonsTitle: 'File:Wikiquote-logo.svg',
    color: '#8b0000',
    svg: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
      <path d="M22,62 C22,42 32,25 48,20 L42,36 C32,41 32,51 37,56 C42,61 40,76 27,76 C17,76 12,66 22,62 Z" fill="#b30000"/>
      <path d="M62,62 C62,42 72,25 88,20 L82,36 C72,41 72,51 77,56 C82,61 80,76 67,76 C57,76 52,66 62,62 Z" fill="#b30000"/>
    </svg>`
  },
  {
    id: 'wiktionary',
    name: 'Wiktionary',
    commonsTitle: 'File:Wiktionary-logo-v2.svg',
    color: '#4a4a4a',
    svg: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
      <rect x="15" y="15" width="70" height="70" rx="12" fill="#ffffff" stroke="#333333" stroke-width="7"/>
      <text x="50" y="67" font-family="serif" font-weight="bold" font-size="52" text-anchor="middle" fill="#333333">W</text>
    </svg>`
  },
  {
    id: 'wikivoyage',
    name: 'Wikivoyage',
    commonsTitle: 'File:Wikivoyage-Logo-v3-icon.svg',
    color: '#ff9800',
    svg: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
      <g transform="rotate(35 50 50)">
        <path d="M50,12 L80,44 L64,44 L64,82 L36,82 L36,44 L20,44 Z" fill="#ff9800" stroke="#e65100" stroke-width="4" stroke-linejoin="round"/>
        <path d="M50,30 L68,52 L58,52 L58,74 L42,74 L42,52 L32,52 Z" fill="#4caf50" stroke="#1b5e20" stroke-width="2" stroke-linejoin="round"/>
      </g>
    </svg>`
  },
  {
    id: 'wikiversity',
    name: 'Wikiversity',
    commonsTitle: 'File:Wikiversity logo 2017.svg',
    color: '#3366cc',
    svg: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
      <circle cx="50" cy="18" r="9" fill="#3366cc"/>
      <circle cx="25" cy="62" r="9" fill="#ffcc33"/>
      <circle cx="75" cy="62" r="9" fill="#cc3333"/>
      <path d="M50,27 L25,53 M50,27 L75,53 M34,62 L66,62" fill="none" stroke="#555555" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M50,35 L50,84" stroke="#555555" stroke-width="7" stroke-linecap="round"/>
      <circle cx="50" cy="84" r="7" fill="#555555"/>
    </svg>`
  },
  {
    id: 'wikispecies',
    name: 'Wikispecies',
    commonsTitle: 'File:Wikispecies-logo.svg',
    color: '#3f7f42',
    svg: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
      <path d="M50,84 C50,58 43,39 29,22" fill="none" stroke="#2f6f44" stroke-width="7" stroke-linecap="round"/>
      <path d="M51,80 C61,63 70,51 84,40" fill="none" stroke="#2f6f44" stroke-width="6" stroke-linecap="round"/>
      <ellipse cx="30" cy="28" rx="13" ry="21" fill="#7cc36b" stroke="#2f6f44" stroke-width="4" transform="rotate(-38 30 28)"/>
      <ellipse cx="73" cy="43" rx="12" ry="20" fill="#9bd36f" stroke="#2f6f44" stroke-width="4" transform="rotate(47 73 43)"/>
      <ellipse cx="50" cy="53" rx="11" ry="18" fill="#5aa85c" stroke="#2f6f44" stroke-width="4" transform="rotate(-8 50 53)"/>
    </svg>`
  },
  {
    id: 'wikifunctions',
    name: 'Wikifunctions',
    commonsTitle: 'File:Wikifunctions-logo.svg',
    color: '#9c27b0',
    svg: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
      <path d="M30,30 C50,8 82,38 50,50 C18,62 50,92 70,70" fill="none" stroke="#9c27b0" stroke-width="10" stroke-linecap="round"/>
      <path d="M30,70 C50,92 82,62 50,50 C18,38 50,8 70,30" fill="none" stroke="#e91e63" stroke-width="7" stroke-linecap="round"/>
    </svg>`
  },
  {
    id: 'mediawiki',
    name: 'MediaWiki',
    commonsTitle: 'File:MediaWiki-2020-icon.svg',
    color: '#334466',
    svg: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
      <path d="M22,18 L8,18 L8,82 L22,82" fill="none" stroke="#334466" stroke-width="9" stroke-linecap="square"/>
      <path d="M78,18 L92,18 L92,82 L78,82" fill="none" stroke="#334466" stroke-width="9" stroke-linecap="square"/>
      <text x="50" y="58" font-family="monospace" font-weight="bold" font-size="34" text-anchor="middle" fill="#006699">mw</text>
    </svg>`
  },
  {
    id: 'meta',
    name: 'Meta-Wiki',
    commonsTitle: 'File:Wikimedia Community Logo.svg',
    color: '#00bcd4',
    svg: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
      <circle cx="32" cy="50" r="18" fill="none" stroke="#009688" stroke-width="8"/>
      <circle cx="68" cy="50" r="18" fill="none" stroke="#00bcd4" stroke-width="8"/>
      <path d="M50,22 L50,78" stroke="#ff5722" stroke-width="8" stroke-linecap="round"/>
    </svg>`
  }
];

export const PRESETS = [
  {
    name: 'Classic Wikimedia Family',
    center: 'wikimedia',
    ring: ['wikipedia', 'commons', 'wikidata', 'wikisource', 'wikibooks', 'wikiquote', 'wiktionary', 'wikiversity', 'wikispecies', 'wikifunctions', 'wikivoyage'],
    haloColor: '#3470ff',
    haloOpacity: 0.2,
    haloRadius: 260,
    ringRadius: 220,
    ringScale: 0.66
  },
  {
    name: 'Core Knowledge Circle',
    center: 'wikimedia',
    ring: ['wikipedia', 'commons', 'wikidata', 'wiktionary', 'wikiversity', 'wikispecies', 'meta'],
    haloColor: '#8b5cf6',
    haloOpacity: 0.2,
    haloRadius: 260,
    ringRadius: 195,
    ringScale: 0.78
  },
  {
    name: 'Developer & Data Hub',
    center: 'wikimedia',
    ring: ['wikidata', 'mediawiki', 'meta', 'wikifunctions'],
    haloColor: '#34d399',
    haloOpacity: 0.2,
    haloRadius: 260,
    ringRadius: 195,
    ringScale: 0.8
  },
  {
    name: 'All Logos',
    center: 'wikimedia',
    ring: ['wikipedia', 'commons', 'wikidata', 'wikisource', 'wikibooks', 'wikiquote', 'wiktionary', 'wikiversity', 'wikispecies', 'wikifunctions', 'wikivoyage', 'mediawiki', 'meta'],
    haloColor: '#3470ff',
    haloOpacity: 0.2,
    haloRadius: 260,
    ringRadius: 230,
    ringScale: 0.6
  }
];

export const BACKDROP_THEMES = [
  { id: 'transparent', label: 'Transparency Grid', fill: null },
  { id: 'white', label: 'Plain White', fill: '#ffffff' },
  { id: 'dark', label: 'Midnight Blue', fill: '#0f172a' },
  { id: 'light', label: 'Soft Alabaster', fill: '#f8fafc' }
];

export function getBackdropFill(backdropId) {
  return BACKDROP_THEMES.find((backdropTheme) => backdropTheme.id === backdropId)?.fill;
}

export const HALO_COLORS = [
  { name: 'Sky Blue', hex: '#3470ff' },
  { name: 'Royal Purple', hex: '#8b5cf6' },
  { name: 'Emerald', hex: '#10b981' },
  { name: 'Golden Glow', hex: '#f59e0b' },
  { name: 'Crimson Warmth', hex: '#ef4444' }
];
