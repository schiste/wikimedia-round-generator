import { useEffect, useRef, useState } from 'react';
import { getHaloGeometry, getRingAngle, getRingPoint } from '../utils/layout.js';
import { CANVAS_SIZE, LOGO_VIEWBOX_SIZE, fitIntoSquare, hexToRgb } from '../utils/svg.js';

function drawLogoOnCanvas(ctx, imageEntry, x, y, size) {
  if (!imageEntry?.image) return;
  const fitted = fitIntoSquare(size, imageEntry.aspectRatio);
  ctx.drawImage(imageEntry.image, x - fitted.width / 2, y - fitted.height / 2, fitted.width, fitted.height);
}

export function useWheelCanvas({
  backdrop,
  backdropFill,
  centerLateralAnchors,
  centerLogo,
  centerScale,
  haloColor,
  haloOpacity,
  haloRadius,
  imageCache,
  ringLogos,
  ringRadius,
  ringRotation,
  ringScale,
  showGuides,
  showHalo
}) {
  const canvasRef = useRef(null);
  const [isRendering, setIsRendering] = useState(false);

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
      const { rOuter, innerStop, peakStop } = getHaloGeometry(ringRadius, haloRadius);

      const gradient = ctx.createRadialGradient(center, center, 0, center, center, rOuter);
      gradient.addColorStop(0, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0)`);
      gradient.addColorStop(innerStop, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0)`);
      gradient.addColorStop(peakStop, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${haloOpacity})`);
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
        const { x: spokeX, y: spokeY } = getRingPoint(center, ringRadius, angle);

        ctx.beginPath();
        ctx.moveTo(center, center);
        ctx.lineTo(spokeX, spokeY);
        ctx.stroke();
      });

      ctx.setLineDash([]);
    }

    drawLogoOnCanvas(ctx, imageCache[centerLogo], center, center, LOGO_VIEWBOX_SIZE * centerScale);

    ringLogos.forEach((id, index) => {
      const ringImageEntry = imageCache[id];
      if (!ringImageEntry) return;

      const angle = getRingAngle(index, ringLogos.length, ringRotation, centerLateralAnchors);
      const { x, y } = getRingPoint(center, ringRadius, angle);

      drawLogoOnCanvas(ctx, ringImageEntry, x, y, LOGO_VIEWBOX_SIZE * ringScale);
    });

    setIsRendering(false);
  }, [
    backdrop,
    backdropFill,
    centerLateralAnchors,
    centerLogo,
    centerScale,
    haloColor,
    haloOpacity,
    haloRadius,
    imageCache,
    ringLogos,
    ringRadius,
    ringRotation,
    ringScale,
    showGuides,
    showHalo
  ]);

  return { canvasRef, isRendering };
}
