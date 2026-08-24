export const TEXT_FONT_FAMILY = 'Inter, sans-serif';

export type SketchTextMetrics = {
  /** Visual ink bounds relative to the fillText(x, y) baseline anchor. */
  left: number;
  right: number;
  top: number;
  bottom: number;
  width: number;
  height: number;
  centerOffsetX: number;
  centerOffsetY: number;
};

let measureContext: CanvasRenderingContext2D | null | undefined;

function getMeasureContext(): CanvasRenderingContext2D | null {
  if (measureContext !== undefined) return measureContext;
  if (typeof document === 'undefined') {
    measureContext = null;
    return measureContext;
  }

  const canvas = document.createElement('canvas');
  measureContext = canvas.getContext('2d');
  return measureContext;
}

/**
 * Measures the visible glyph bounds using the same font used by render.ts.
 * x/y offsets are relative to a left-aligned, alphabetic-baseline fillText anchor.
 */
export function measureSketchText(text: string, fontSize: number): SketchTextMetrics {
  const size = Math.max(1, Number.isFinite(fontSize) ? fontSize : 1);
  const fallbackWidth = Math.max(size * 0.55, Array.from(text || ' ').length * size * 0.55);
  const fallbackAscent = size * 0.8;
  const fallbackDescent = size * 0.2;

  const ctx = getMeasureContext();
  if (!ctx) {
    const left = 0;
    const right = fallbackWidth;
    const top = -fallbackAscent;
    const bottom = fallbackDescent;
    return {
      left,
      right,
      top,
      bottom,
      width: right - left,
      height: bottom - top,
      centerOffsetX: (left + right) / 2,
      centerOffsetY: (top + bottom) / 2,
    };
  }

  ctx.save();
  ctx.font = `${size}px ${TEXT_FONT_FAMILY}`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  const measured = ctx.measureText(text || ' ');
  ctx.restore();

  const bboxLeft = Number.isFinite(measured.actualBoundingBoxLeft)
    ? measured.actualBoundingBoxLeft
    : 0;
  const bboxRight = Number.isFinite(measured.actualBoundingBoxRight) && measured.actualBoundingBoxRight > 0
    ? measured.actualBoundingBoxRight
    : Math.max(measured.width, fallbackWidth);
  const ascent = Number.isFinite(measured.actualBoundingBoxAscent) && measured.actualBoundingBoxAscent > 0
    ? measured.actualBoundingBoxAscent
    : fallbackAscent;
  const descent = Number.isFinite(measured.actualBoundingBoxDescent) && measured.actualBoundingBoxDescent >= 0
    ? measured.actualBoundingBoxDescent
    : fallbackDescent;

  // actualBoundingBoxLeft is a distance to the left of the baseline anchor.
  const left = -bboxLeft;
  const right = Math.max(left + 0.5, bboxRight);
  const top = -ascent;
  const bottom = Math.max(top + 0.5, descent);

  return {
    left,
    right,
    top,
    bottom,
    width: right - left,
    height: bottom - top,
    centerOffsetX: (left + right) / 2,
    centerOffsetY: (top + bottom) / 2,
  };
}
