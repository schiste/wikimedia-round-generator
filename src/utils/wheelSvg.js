import { CANVAS_SIZE, LOGO_VIEWBOX_SIZE, escapeAttribute, fitIntoSquare, formatNumber, getSvgParts, hexToRgb } from './svg.js';
import { getRingAngle } from './layout.js';

function renderLogoSvg(logoById, logoId, x, y, scale) {
  const logo = logoById.get(logoId);
  if (!logo) return '';

  const size = LOGO_VIEWBOX_SIZE * scale;
  const { viewBox, inner, aspectRatio } = getSvgParts(logo.svg);
  const fitted = fitIntoSquare(size, aspectRatio);

  return `<svg x="${formatNumber(x - fitted.width / 2)}" y="${formatNumber(y - fitted.height / 2)}" width="${formatNumber(fitted.width)}" height="${formatNumber(fitted.height)}" viewBox="${escapeAttribute(viewBox)}" preserveAspectRatio="xMidYMid meet">${inner}</svg>`;
}

export function generateWheelSvg({
  backdrop,
  backdropFill,
  centerLateralAnchors,
  centerLogo,
  centerScale,
  haloColor,
  haloOpacity,
  haloRadius,
  logoById,
  ringLogos,
  ringRadius,
  ringRotation,
  ringScale,
  showGuides,
  showHalo
}) {
  const center = CANVAS_SIZE / 2;
  let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${CANVAS_SIZE} ${CANVAS_SIZE}" width="${CANVAS_SIZE}" height="${CANVAS_SIZE}">`;

  if (backdropFill) {
    svg += `<rect width="${CANVAS_SIZE}" height="${CANVAS_SIZE}" fill="${backdropFill}"/>`;
  }

  if (showHalo) {
    const rgb = hexToRgb(haloColor);
    const rOuter = Math.max(ringRadius + 10, haloRadius);
    const rInner = Math.max(0, 2 * ringRadius - rOuter);
    const rInnerRatio = rInner / rOuter;
    const rPeakRatio = ringRadius / rOuter;

    svg += `<defs>
      <radialGradient id="vectorHalo" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stop-color="rgb(${rgb.r},${rgb.g},${rgb.b})" stop-opacity="0"/>
        <stop offset="${formatNumber(rInnerRatio * 100)}%" stop-color="rgb(${rgb.r},${rgb.g},${rgb.b})" stop-opacity="0"/>
        <stop offset="${formatNumber(rPeakRatio * 100)}%" stop-color="rgb(${rgb.r},${rgb.g},${rgb.b})" stop-opacity="${haloOpacity}"/>
        <stop offset="100%" stop-color="rgb(${rgb.r},${rgb.g},${rgb.b})" stop-opacity="0"/>
      </radialGradient>
    </defs>`;
    svg += `<circle cx="${center}" cy="${center}" r="${formatNumber(rOuter)}" fill="url(#vectorHalo)"/>`;
  }

  if (showGuides) {
    const strokeColor = backdrop === 'dark' ? 'rgba(255,255,255,0.15)' : 'rgba(15,23,42,0.12)';
    svg += `<circle cx="${center}" cy="${center}" r="${ringRadius}" fill="none" stroke="${strokeColor}" stroke-width="2" stroke-dasharray="8,8"/>`;

    ringLogos.forEach((_, index) => {
      const angle = getRingAngle(index, ringLogos.length, ringRotation, centerLateralAnchors);
      const spokeX = center + ringRadius * Math.cos(angle);
      const spokeY = center + ringRadius * Math.sin(angle);
      svg += `<line x1="${center}" y1="${center}" x2="${formatNumber(spokeX)}" y2="${formatNumber(spokeY)}" stroke="${strokeColor}" stroke-width="2" stroke-dasharray="8,8"/>`;
    });
  }

  svg += renderLogoSvg(logoById, centerLogo, center, center, centerScale);

  ringLogos.forEach((id, index) => {
    const angle = getRingAngle(index, ringLogos.length, ringRotation, centerLateralAnchors);
    const x = center + ringRadius * Math.cos(angle);
    const y = center + ringRadius * Math.sin(angle);
    svg += renderLogoSvg(logoById, id, x, y, ringScale);
  });

  svg += '</svg>';
  return svg;
}
