import type { Point, SketchObject, ViewState } from '../types';
import { GRID_PX } from './constants';
import { intrinsicRectCorners, objectBounds, objectCenter, rotatePoint, textCorners, type Bounds } from './bounds';
import { worldToScreen } from './geometry';

export function drawEditBox(ctx: CanvasRenderingContext2D, bounds: Bounds, view: ViewState, metersPerSquare: number) {
  const topLeft = worldToScreen({ x: bounds.left, y: bounds.top }, view);
  const bottomRight = worldToScreen({ x: bounds.right, y: bounds.bottom }, view);
  const padding = 7;
  ctx.save();
  ctx.strokeStyle = '#F2A63C';
  ctx.fillStyle = '#F2A63C';
  ctx.lineWidth = 1.5;
  ctx.setLineDash([4, 3]);
  ctx.strokeRect(topLeft.x - padding, topLeft.y - padding, bottomRight.x - topLeft.x + padding * 2, bottomRight.y - topLeft.y + padding * 2);
  ctx.setLineDash([]);
  for (const [x, y] of [
    [topLeft.x - padding, topLeft.y - padding],
    [bottomRight.x + padding, topLeft.y - padding],
    [topLeft.x - padding, bottomRight.y + padding],
    [bottomRight.x + padding, bottomRight.y + padding],
  ]) {
    ctx.fillRect(x - 4, y - 4, 8, 8);
  }
  const centerX = (topLeft.x + bottomRight.x) / 2;
  const rotateY = topLeft.y - padding - 28;
  ctx.strokeStyle = '#F2A63C';
  ctx.beginPath();
  ctx.moveTo(centerX, topLeft.y - padding);
  ctx.lineTo(centerX, rotateY);
  ctx.stroke();
  ctx.fillRect(centerX - 6, rotateY - 6, 12, 12);
  const label = `${((bounds.right - bounds.left) / 24 * metersPerSquare).toFixed(2)} × ${((bounds.bottom - bounds.top) / 24 * metersPerSquare).toFixed(2)} ม.`;
  ctx.font = '12px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const width = ctx.measureText(label).width + 12;
  ctx.fillStyle = 'rgba(242,166,60,0.95)';
  ctx.fillRect(centerX - width / 2, rotateY - 31, width, 20);
  ctx.fillStyle = '#14181D';
  ctx.fillText(label, centerX, rotateY - 21);
  ctx.restore();
}

export function drawPolyPoints(ctx: CanvasRenderingContext2D, points: Point[], view: ViewState) {
  points.forEach((point, index) => {
    const screen = worldToScreen(point, view);
    ctx.beginPath();
    ctx.fillStyle = index === points.length - 1 ? '#2E9B62' : '#F2A63C';
    ctx.arc(screen.x, screen.y, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  });
}

export function drawSelectionBox(ctx: CanvasRenderingContext2D, start: Point, end: Point, view: ViewState) {
  const a = worldToScreen(start, view);
  const b = worldToScreen(end, view);
  ctx.save();
  ctx.strokeStyle = '#0E3050';
  ctx.fillStyle = 'rgba(14,48,80,0.08)';
  ctx.setLineDash([6, 4]);
  ctx.lineWidth = 1.5;
  ctx.fillRect(Math.min(a.x, b.x), Math.min(a.y, b.y), Math.abs(b.x - a.x), Math.abs(b.y - a.y));
  ctx.strokeRect(Math.min(a.x, b.x), Math.min(a.y, b.y), Math.abs(b.x - a.x), Math.abs(b.y - a.y));
  ctx.restore();
}

export function drawEraserPreview(ctx: CanvasRenderingContext2D, points: Point[], view: ViewState, width: number) {
  ctx.save();
  ctx.strokeStyle = 'rgba(228,87,46,0.55)';
  ctx.lineWidth = Math.max(1, width * view.s);
  ctx.setLineDash([5, 5]);
  ctx.lineCap = 'round';
  ctx.beginPath();
  points.forEach((point, index) => {
    const screen = worldToScreen(point, view);
    if (index === 0) ctx.moveTo(screen.x, screen.y);
    else ctx.lineTo(screen.x, screen.y);
  });
  ctx.stroke();
  ctx.restore();
}


function metersFromWorld(value: number, metersPerSquare: number): number {
  return Math.abs(value) / GRID_PX * metersPerSquare;
}

function axisBoundsCorners(bounds: Bounds): Point[] {
  return [
    { x: bounds.left, y: bounds.top },
    { x: bounds.right, y: bounds.top },
    { x: bounds.right, y: bounds.bottom },
    { x: bounds.left, y: bounds.bottom },
  ];
}

function drawDimensionSegment(
  ctx: CanvasRenderingContext2D,
  startWorld: Point,
  endWorld: Point,
  view: ViewState,
  label: string,
  objectCenterWorld: Point,
  offsetPx = 18,
) {
  const start = worldToScreen(startWorld, view);
  const end = worldToScreen(endWorld, view);
  const center = worldToScreen(objectCenterWorld, view);
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const length = Math.hypot(dx, dy);
  if (length < 1) return;

  let nx = -dy / length;
  let ny = dx / length;
  const mid = { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 };
  // Choose the normal that points away from the object center.
  if ((mid.x - center.x) * nx + (mid.y - center.y) * ny < 0) {
    nx *= -1;
    ny *= -1;
  }

  const a = { x: start.x + nx * offsetPx, y: start.y + ny * offsetPx };
  const b = { x: end.x + nx * offsetPx, y: end.y + ny * offsetPx };
  const tick = 5;

  ctx.save();
  ctx.strokeStyle = '#2E9B62';
  ctx.fillStyle = '#2E9B62';
  ctx.lineWidth = 1.25;
  ctx.setLineDash([]);

  // Extension lines.
  ctx.globalAlpha = 0.55;
  ctx.beginPath();
  ctx.moveTo(start.x, start.y);
  ctx.lineTo(a.x, a.y);
  ctx.moveTo(end.x, end.y);
  ctx.lineTo(b.x, b.y);
  ctx.stroke();
  ctx.globalAlpha = 1;

  // Main dimension line and terminal ticks.
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(b.x, b.y);
  ctx.moveTo(a.x - nx * tick, a.y - ny * tick);
  ctx.lineTo(a.x + nx * tick, a.y + ny * tick);
  ctx.moveTo(b.x - nx * tick, b.y - ny * tick);
  ctx.lineTo(b.x + nx * tick, b.y + ny * tick);
  ctx.stroke();

  const labelX = (a.x + b.x) / 2 + nx * 11;
  const labelY = (a.y + b.y) / 2 + ny * 11;
  ctx.font = '600 11px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const textWidth = ctx.measureText(label).width;
  ctx.fillStyle = 'rgba(255,255,255,0.94)';
  ctx.fillRect(labelX - textWidth / 2 - 5, labelY - 9, textWidth + 10, 18);
  ctx.fillStyle = '#1D6E49';
  ctx.fillText(label, labelX, labelY);
  ctx.restore();
}

/** Draws width/length information for the object selected by Dim mode. */
export function drawObjectDimensions(
  ctx: CanvasRenderingContext2D,
  object: SketchObject,
  view: ViewState,
  metersPerSquare: number,
) {
  const center = objectCenter(object);

  if (object.type === 'line' || object.type === 'measure') {
    const length = Math.hypot(object.x2 - object.x1, object.y2 - object.y1);
    drawDimensionSegment(
      ctx,
      { x: object.x1, y: object.y1 },
      { x: object.x2, y: object.y2 },
      view,
      `ยาว ${metersFromWorld(length, metersPerSquare).toFixed(2)} ม.`,
      center,
      16,
    );
    return;
  }

  let corners: Point[];
  let widthWorld: number;
  let heightWorld: number;

  if (object.type === 'rect' || object.type === 'image') {
    corners = intrinsicRectCorners(object);
    widthWorld = Math.abs(object.x2 - object.x1);
    heightWorld = Math.abs(object.y2 - object.y1);
  } else if (object.type === 'text') {
    corners = textCorners(object);
    widthWorld = Math.hypot(corners[1].x - corners[0].x, corners[1].y - corners[0].y);
    heightWorld = Math.hypot(corners[2].x - corners[1].x, corners[2].y - corners[1].y);
  } else if (object.type === 'circle') {
    const rx = Math.max(0.001, object.rx ?? object.r ?? 0);
    const ry = Math.max(0.001, object.ry ?? object.r ?? 0);
    const rotation = object.rotation ?? 0;
    const c = { x: object.cx, y: object.cy };
    corners = [
      rotatePoint({ x: c.x - rx, y: c.y - ry }, rotation, c),
      rotatePoint({ x: c.x + rx, y: c.y - ry }, rotation, c),
      rotatePoint({ x: c.x + rx, y: c.y + ry }, rotation, c),
      rotatePoint({ x: c.x - rx, y: c.y + ry }, rotation, c),
    ];
    widthWorld = rx * 2;
    heightWorld = ry * 2;
  } else {
    const bounds = objectBounds(object);
    corners = axisBoundsCorners(bounds);
    widthWorld = bounds.right - bounds.left;
    heightWorld = bounds.bottom - bounds.top;
  }

  drawDimensionSegment(
    ctx,
    corners[0],
    corners[1],
    view,
    `กว้าง ${metersFromWorld(widthWorld, metersPerSquare).toFixed(2)} ม.`,
    center,
  );
  drawDimensionSegment(
    ctx,
    corners[1],
    corners[2],
    view,
    `ยาว ${metersFromWorld(heightWorld, metersPerSquare).toFixed(2)} ม.`,
    center,
  );
}

export function drawSnapCloseHint(ctx: CanvasRenderingContext2D, point: Point, view: ViewState) {
  const screen = worldToScreen(point, view);
  ctx.save();
  ctx.strokeStyle = '#2E9B62';
  ctx.fillStyle = 'rgba(46,155,98,0.18)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(screen.x, screen.y, 10, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.fillStyle = '#2E9B62';
  ctx.arc(screen.x, screen.y, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

export function drawCalibrationGuide(
  ctx: CanvasRenderingContext2D,
  start: Point,
  end: Point,
  view: ViewState,
) {
  const a = worldToScreen(start, view);
  const b = worldToScreen(end, view);
  ctx.save();
  ctx.strokeStyle = '#2E9B62';
  ctx.fillStyle = '#2E9B62';
  ctx.lineWidth = 2;
  ctx.setLineDash([7, 5]);
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(b.x, b.y);
  ctx.stroke();
  ctx.setLineDash([]);
  for (const point of [a, b]) {
    ctx.beginPath();
    ctx.arc(point.x, point.y, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 2;
    ctx.stroke();
  }
  const length = Math.hypot(end.x - start.x, end.y - start.y);
  ctx.font = '12px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.fillStyle = '#2E9B62';
  ctx.fillText(`${length.toFixed(1)} px`, (a.x + b.x) / 2, (a.y + b.y) / 2 - 8);
  ctx.restore();
}
