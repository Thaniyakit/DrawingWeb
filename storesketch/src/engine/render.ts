import { DASH_PATTERNS, type ErasePath, type SketchObject, type ViewState } from '../types';
import { GRID_PX } from './constants';
import { worldToScreen } from './geometry';
import { objectBounds, objectCenter } from './bounds';
import { TEXT_FONT_FAMILY } from './textMetrics';

export function drawGrid(
  ctx: CanvasRenderingContext2D,
  view: ViewState,
  w: number,
  h: number,
  metersPerSquare = 1,
) {
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, w, h);

  const step = GRID_PX * view.s;
  if (step < 4) return;

  const offsetX = view.tx % step;
  const offsetY = view.ty % step;

  ctx.strokeStyle = 'rgba(20,24,29,0.08)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = offsetX; x < w; x += step) {
    ctx.moveTo(x, 0);
    ctx.lineTo(x, h);
  }
  for (let y = offsetY; y < h; y += step) {
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
  }
  ctx.stroke();

  ctx.save();
  ctx.fillStyle = 'rgba(20,24,29,0.62)';
  ctx.font = `${Math.max(10, Math.min(13, 11 * view.s))}px monospace`;
  ctx.textBaseline = 'top';
  const majorEvery = 5;
  const firstColumn = Math.ceil(-offsetX / step);
  for (let index = firstColumn; ; index += 1) {
    const x = offsetX + index * step;
    if (x > w) break;
    if (index % majorEvery === 0 && x >= 0) {
      ctx.fillText(`${(index * metersPerSquare).toFixed(1)} m.`, x + 3, 3);
    }
  }
  ctx.textBaseline = 'middle';
  const firstRow = Math.ceil(-offsetY / step);
  for (let index = firstRow; ; index += 1) {
    const y = offsetY + index * step;
    if (y > h) break;
    if (index % majorEvery === 0 && y >= 0) {
      ctx.fillText(`${(index * metersPerSquare).toFixed(1)} m.`, 5, y);
    }
  }
  ctx.restore();
}

export function drawObjects(
  ctx: CanvasRenderingContext2D,
  objects: SketchObject[],
  view: ViewState,
  w: number,
  h: number,
  selectedId: number | null,
  selectedIds: number[] = [],
  metersPerSquare = 1,
  _erasePaths: ErasePath[] = [],
  clearCanvas = true,
) {
  if (clearCanvas) ctx.clearRect(0, 0, w, h);

  for (const obj of objects) {
    if (obj.visible === false || obj.type === 'erase') continue;

    ctx.save();
    ctx.globalCompositeOperation = 'source-over';
    ctx.strokeStyle = obj.color || '#14181D';
    ctx.fillStyle = obj.color || '#14181D';
    ctx.lineWidth = (obj.width || 1) * view.s;
    ctx.setLineDash((DASH_PATTERNS[obj.dash] ?? []).map((distance) => distance * view.s));
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    switch (obj.type) {
      case 'stroke':
      case 'poly': {
        const segments = obj.segments ?? [obj.points];
        for (const segment of segments) {
          if (segment.length < 2) continue;
          ctx.beginPath();
          segment.forEach((point, index) => {
            const screen = worldToScreen(point, view);
            if (index === 0) ctx.moveTo(screen.x, screen.y);
            else ctx.lineTo(screen.x, screen.y);
          });
          ctx.stroke();
        }
        break;
      }
      case 'line': {
        const start = worldToScreen({ x: obj.x1, y: obj.y1 }, view);
        const end = worldToScreen({ x: obj.x2, y: obj.y2 }, view);
        ctx.beginPath();
        ctx.moveTo(start.x, start.y);
        ctx.lineTo(end.x, end.y);
        ctx.stroke();
        break;
      }
      case 'measure': {
        const start = worldToScreen({ x: obj.x1, y: obj.y1 }, view);
        const end = worldToScreen({ x: obj.x2, y: obj.y2 }, view);
        const dx = end.x - start.x;
        const dy = end.y - start.y;
        const length = Math.hypot(dx, dy) || 1;
        const normalX = -dy / length;
        const normalY = dx / length;
        const tick = 8;

        ctx.setLineDash([]);
        ctx.beginPath();
        ctx.moveTo(start.x, start.y);
        ctx.lineTo(end.x, end.y);
        ctx.moveTo(start.x + normalX * tick, start.y + normalY * tick);
        ctx.lineTo(start.x - normalX * tick, start.y - normalY * tick);
        ctx.moveTo(end.x + normalX * tick, end.y + normalY * tick);
        ctx.lineTo(end.x - normalX * tick, end.y - normalY * tick);
        ctx.stroke();

        ctx.save();
        ctx.font = `${12 * view.s}px monospace`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = obj.color;
        ctx.fillText(
          `${(Math.hypot(obj.x2 - obj.x1, obj.y2 - obj.y1) / 24 * metersPerSquare).toFixed(2)} ม.`,
          (start.x + end.x) / 2 + normalX * 16,
          (start.y + end.y) / 2 + normalY * 16,
        );
        ctx.restore();
        break;
      }
      case 'curve': {
        const start = worldToScreen({ x: obj.x1, y: obj.y1 }, view);
        const end = worldToScreen({ x: obj.x2, y: obj.y2 }, view);
        const control = worldToScreen({ x: obj.controlX, y: obj.controlY }, view);
        ctx.beginPath();
        ctx.moveTo(start.x, start.y);
        ctx.quadraticCurveTo(control.x, control.y, end.x, end.y);
        ctx.stroke();
        break;
      }
      case 'rect': {
        const center = worldToScreen(objectCenter(obj), view);
        const width = Math.abs(obj.x2 - obj.x1) * view.s;
        const height = Math.abs(obj.y2 - obj.y1) * view.s;
        ctx.save();
        ctx.translate(center.x, center.y);
        ctx.rotate(obj.rotation ?? 0);
        ctx.strokeRect(-width / 2, -height / 2, width, height);
        ctx.restore();
        break;
      }
      case 'circle': {
        const center = worldToScreen({ x: obj.cx, y: obj.cy }, view);
        const rx = Math.max(0.001, obj.rx ?? obj.r ?? 0);
        const ry = Math.max(0.001, obj.ry ?? obj.r ?? 0);
        ctx.beginPath();
        ctx.ellipse(center.x, center.y, rx * view.s, ry * view.s, obj.rotation ?? 0, 0, Math.PI * 2);
        ctx.stroke();
        break;
      }
      case 'text': {
        const centerWorld = objectCenter(obj);
        const center = worldToScreen(centerWorld, view);
        ctx.save();
        ctx.translate(center.x, center.y);
        ctx.rotate(obj.rotation ?? 0);
        ctx.font = `${obj.fontSize * view.s}px ${TEXT_FONT_FAMILY}`;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'alphabetic';
        ctx.fillText(
          obj.text,
          (obj.x1 - centerWorld.x) * view.s,
          (obj.y1 - centerWorld.y) * view.s,
        );
        ctx.restore();
        break;
      }
      case 'image':
        // Image import/rendering is intentionally not part of P1.
        break;
    }

    if (selectedIds.length <= 1 && (obj.id === selectedId || selectedIds.includes(obj.id))) {
      drawSingleSelection(ctx, obj, view, metersPerSquare);
    }
    ctx.restore();
  }
}

function drawSingleSelection(
  ctx: CanvasRenderingContext2D,
  obj: SketchObject,
  view: ViewState,
  metersPerSquare: number,
) {
  const bounds = objectBounds(obj);
  const topLeft = worldToScreen({ x: bounds.left, y: bounds.top }, view);
  const bottomRight = worldToScreen({ x: bounds.right, y: bounds.bottom }, view);
  // Text bounds already use the visible glyph ink box, so do not add the
  // generic drawing padding that made the right side look oversized.
  const padding = obj.type === 'text' ? 5 : Math.max(5, obj.width * view.s + 2);

  ctx.strokeStyle = '#F2A63C';
  ctx.lineWidth = 1.5;
  ctx.setLineDash([4, 3]);
  ctx.strokeRect(
    topLeft.x - padding,
    topLeft.y - padding,
    Math.max(1, bottomRight.x - topLeft.x) + padding * 2,
    Math.max(1, bottomRight.y - topLeft.y) + padding * 2,
  );
  ctx.setLineDash([]);

  ctx.fillStyle = '#F2A63C';
  const handleSize = 7;
  for (const [x, y] of [
    [topLeft.x - padding, topLeft.y - padding],
    [bottomRight.x + padding, topLeft.y - padding],
    [topLeft.x - padding, bottomRight.y + padding],
    [bottomRight.x + padding, bottomRight.y + padding],
  ]) {
    ctx.fillRect(x - handleSize / 2, y - handleSize / 2, handleSize, handleSize);
  }

  const centerX = (topLeft.x + bottomRight.x) / 2;
  const rotateY = topLeft.y - padding - 28;
  ctx.strokeStyle = '#F2A63C';
  ctx.beginPath();
  ctx.moveTo(centerX, topLeft.y - padding);
  ctx.lineTo(centerX, rotateY);
  ctx.stroke();
  ctx.fillStyle = '#F2A63C';
  ctx.fillRect(centerX - 6, rotateY - 6, 12, 12);

  const widthMeters = Math.abs(bounds.right - bounds.left) / 24 * metersPerSquare;
  const heightMeters = Math.abs(bounds.bottom - bounds.top) / 24 * metersPerSquare;
  const label = `${widthMeters.toFixed(2)} × ${heightMeters.toFixed(2)} ม.`;
  ctx.font = '12px monospace';
  const labelWidth = ctx.measureText(label).width + 12;
  ctx.fillStyle = 'rgba(242,166,60,0.95)';
  ctx.fillRect(centerX - labelWidth / 2, rotateY - 31, labelWidth, 20);
  ctx.fillStyle = '#14181D';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, centerX, rotateY - 21);

  if (obj.type === 'curve') {
    const control = worldToScreen({ x: obj.controlX, y: obj.controlY }, view);
    ctx.fillStyle = '#F2A63C';
    ctx.fillRect(control.x - 5, control.y - 5, 10, 10);
  }
}
