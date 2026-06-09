import { LOGO_VIEWBOX_SIZE } from './svg.js';

export const MIN_LOGO_SCALE = 0.12;
export const MAX_LOGO_SCALE = 1.5;
export const MAX_CENTER_LOGO_SCALE = 1.35;
export const CENTER_LOGO_SCALE_RATIO = 1.45;
export const LOGO_COLLISION_GAP = 6;

export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function getLateralAlignmentOffset(count) {
  if (count <= 2) return 0;
  const rightAnchorIndex = Math.round(count / 4);
  const rightAnchorDegrees = (rightAnchorIndex / count) * 360 - 90;
  return -rightAnchorDegrees;
}

export function getRingAngle(index, count, rotationDegrees, centerLateralAnchors) {
  const lateralOffset = centerLateralAnchors ? getLateralAlignmentOffset(count) : 0;
  return (index / count) * 2 * Math.PI - Math.PI / 2 + ((rotationDegrees + lateralOffset) * Math.PI) / 180;
}

export function getRingPoint(center, radius, angle) {
  return {
    x: center + radius * Math.cos(angle),
    y: center + radius * Math.sin(angle)
  };
}

const HALO_RING_PADDING = 10;

// Shared halo geometry for the canvas renderer and the SVG exporter so both
// produce an identical glow. Stops are expressed as 0..1 ratios of rOuter:
// transparent at the center and at innerStop, peaking at the ring radius,
// then fading back to transparent at the outer edge.
export function getHaloGeometry(ringRadius, haloRadius) {
  const rOuter = Math.max(ringRadius + HALO_RING_PADDING, haloRadius);
  const rInner = Math.max(0, 2 * ringRadius - rOuter);

  return {
    rOuter,
    rInner,
    innerStop: rInner / rOuter,
    peakStop: ringRadius / rOuter
  };
}

// Diameter available to the center logo once the collision gap on each side is
// reserved, i.e. how wide a logo can grow before it touches the ring at ringRadius.
function usableDiameter(ringRadius) {
  return 2 * Math.max(0, ringRadius - LOGO_COLLISION_GAP);
}

export function getDensityScaleCap(count) {
  if (count >= 18) return 0.54;
  if (count >= 13) return 0.68;
  if (count >= 10) return 0.76;
  if (count >= 7) return 0.82;
  return 0.92;
}

export function getCollisionSafeLogoScale(ringRadius, ringCount) {
  const adjacentChord = ringCount > 1 ? 2 * ringRadius * Math.sin(Math.PI / ringCount) : Number.POSITIVE_INFINITY;
  const adjacentLimit = Number.isFinite(adjacentChord) ? (adjacentChord - LOGO_COLLISION_GAP) / LOGO_VIEWBOX_SIZE : MAX_LOGO_SCALE;
  const centerLimit = usableDiameter(ringRadius) / (LOGO_VIEWBOX_SIZE * (1 + CENTER_LOGO_SCALE_RATIO));

  return clamp(Math.min(adjacentLimit, centerLimit, MAX_LOGO_SCALE), MIN_LOGO_SCALE, MAX_LOGO_SCALE);
}

export function getAutoLogoScale(ringRadius, ringCount) {
  const collisionSafeScale = getCollisionSafeLogoScale(ringRadius, ringCount);
  return clamp(Math.min(collisionSafeScale * 0.94, getDensityScaleCap(ringCount)), MIN_LOGO_SCALE, collisionSafeScale);
}

export function getCenterLogoScale(ringRadius, ringScale) {
  const centerLimit = usableDiameter(ringRadius) / LOGO_VIEWBOX_SIZE - ringScale;
  return clamp(ringScale * CENTER_LOGO_SCALE_RATIO, MIN_LOGO_SCALE, Math.min(MAX_CENTER_LOGO_SCALE, centerLimit));
}
