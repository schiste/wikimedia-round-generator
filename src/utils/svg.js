export const CANVAS_SIZE = 800;
export const LOGO_VIEWBOX_SIZE = 100;

export function hexToRgb(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
      }
    : { r: 14, g: 101, b: 192 };
}

export function loadSvgAsImage(svgString) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);

    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };

    img.onerror = (err) => {
      URL.revokeObjectURL(url);
      reject(err);
    };

    img.src = url;
  });
}

function parseSvgRoot(svgString) {
  const doc = new DOMParser().parseFromString(svgString, 'image/svg+xml');
  const root = doc.documentElement;

  if (!root || root.tagName.toLowerCase() !== 'svg' || doc.querySelector('parsererror')) {
    return null;
  }

  return root;
}

export function sanitizeSvgMarkup(svgString) {
  const root = parseSvgRoot(svgString);
  if (!root) return null;

  root.querySelectorAll('script, foreignObject, iframe, object, embed, link').forEach((node) => {
    node.remove();
  });

  [root, ...root.querySelectorAll('*')].forEach((node) => {
    [...node.attributes].forEach((attr) => {
      const name = attr.name.toLowerCase();
      const value = attr.value.trim().toLowerCase();
      const isUrlAttribute = ['href', 'xlink:href', 'src'].includes(name);
      const isExternalUrl = value.startsWith('http:') || value.startsWith('https:') || value.startsWith('//');
      const isUnsafeDataUrl = value.startsWith('data:') && !value.startsWith('data:image/');
      const hasExternalStyleUrl = /url\(\s*['"]?(https?:|\/\/|data:)/i.test(value);
      const isUnsafeStyle = name === 'style' && (value.includes('javascript:') || value.includes('@import') || hasExternalStyleUrl);

      if (name.startsWith('on') || value.startsWith('javascript:') || isUnsafeStyle || (isUrlAttribute && (isExternalUrl || isUnsafeDataUrl))) {
        node.removeAttribute(attr.name);
      }
    });
  });

  if (!root.getAttribute('xmlns')) {
    root.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  }

  if (!root.getAttribute('viewBox')) {
    const derivedViewBox = getViewBoxFromDimensions(root);
    if (derivedViewBox) {
      root.setAttribute('viewBox', derivedViewBox);
    }
  }

  if (!root.getAttribute('preserveAspectRatio')) {
    root.setAttribute('preserveAspectRatio', 'xMidYMid meet');
  }

  return new XMLSerializer().serializeToString(root);
}

export function getSvgParts(svgString) {
  const root = parseSvgRoot(svgString);

  if (!root) {
    return {
      viewBox: `0 0 ${LOGO_VIEWBOX_SIZE} ${LOGO_VIEWBOX_SIZE}`,
      inner: '',
      aspectRatio: 1
    };
  }

  const viewBox = root.getAttribute('viewBox') || getViewBoxFromDimensions(root) || `0 0 ${LOGO_VIEWBOX_SIZE} ${LOGO_VIEWBOX_SIZE}`;
  const [, , width, height] = parseViewBox(viewBox);

  return {
    viewBox,
    inner: root.innerHTML,
    aspectRatio: width > 0 && height > 0 ? width / height : 1
  };
}

export function getSvgAspectRatio(svgString) {
  return getSvgParts(svgString).aspectRatio;
}

export function fitIntoSquare(size, aspectRatio = 1) {
  if (!Number.isFinite(aspectRatio) || aspectRatio <= 0) {
    return { width: size, height: size };
  }

  if (aspectRatio >= 1) {
    return { width: size, height: size / aspectRatio };
  }

  return { width: size * aspectRatio, height: size };
}

function parseViewBox(viewBox) {
  const values = String(viewBox)
    .trim()
    .split(/[\s,]+/)
    .map(Number);

  if (values.length === 4 && values.every(Number.isFinite)) {
    return values;
  }

  return [0, 0, LOGO_VIEWBOX_SIZE, LOGO_VIEWBOX_SIZE];
}

function getViewBoxFromDimensions(root) {
  const width = parseSvgLength(root.getAttribute('width'));
  const height = parseSvgLength(root.getAttribute('height'));

  if (width > 0 && height > 0) {
    return `0 0 ${width} ${height}`;
  }

  return null;
}

function parseSvgLength(value) {
  if (!value) return 0;
  const match = String(value).trim().match(/^([0-9]*\.?[0-9]+)/);
  return match ? Number(match[1]) : 0;
}

export function escapeAttribute(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

export function formatNumber(value) {
  return Number.parseFloat(value.toFixed(3));
}

// Lightweight, render-safe SVG minification for export: drops comments and the
// insignificant whitespace between tags. Only inter-tag whitespace (between `>`
// and `<`) is collapsed, so text content and attribute values are untouched.
export function minifySvg(markup) {
  return markup
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/>\s+</g, '><')
    .trim();
}
