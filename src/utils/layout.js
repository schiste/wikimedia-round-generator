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
  const centerLimit = (2 * Math.max(0, ringRadius - LOGO_COLLISION_GAP)) / (LOGO_VIEWBOX_SIZE * (1 + CENTER_LOGO_SCALE_RATIO));

  return clamp(Math.min(adjacentLimit, centerLimit, MAX_LOGO_SCALE), MIN_LOGO_SCALE, MAX_LOGO_SCALE);
}

export function getAutoLogoScale(ringRadius, ringCount) {
  const collisionSafeScale = getCollisionSafeLogoScale(ringRadius, ringCount);
  return clamp(Math.min(collisionSafeScale * 0.94, getDensityScaleCap(ringCount)), MIN_LOGO_SCALE, collisionSafeScale);
}

export function getCenterLogoScale(ringRadius, ringScale) {
  const centerLimit = (2 * Math.max(0, ringRadius - LOGO_COLLISION_GAP)) / LOGO_VIEWBOX_SIZE - ringScale;
  return clamp(ringScale * CENTER_LOGO_SCALE_RATIO, MIN_LOGO_SCALE, Math.min(MAX_CENTER_LOGO_SCALE, centerLimit));
}
