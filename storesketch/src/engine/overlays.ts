import type { Point, ViewState } from '../types';
import type { Bounds } from './bounds';
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
