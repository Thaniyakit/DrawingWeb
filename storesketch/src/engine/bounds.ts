import type { Point, RectObject, ImageObject, SketchObject, TextObject } from '../types';
import { measureSketchText } from './textMetrics';

export type Bounds = { left: number; top: number; right: number; bottom: number };

export function normalizeBounds(a: Point, b: Point): Bounds {
  return {
    left: Math.min(a.x, b.x),
    top: Math.min(a.y, b.y),
    right: Math.max(a.x, b.x),
    bottom: Math.max(a.y, b.y),
  };
}

export function rotatePoint(point: Point, angle: number, center: Point): Point {
  const dx = point.x - center.x;
  const dy = point.y - center.y;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return {
    x: center.x + dx * cos - dy * sin,
    y: center.y + dx * sin + dy * cos,
  };
}

export function boundsFromPoints(points: Point[]): Bounds {
  if (!points.length) return { left: 0, top: 0, right: 0, bottom: 0 };
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  return {
    left: Math.min(...xs),
    top: Math.min(...ys),
    right: Math.max(...xs),
    bottom: Math.max(...ys),
  };
}

export function containsPoint(bounds: Bounds, point: Point): boolean {
  return point.x >= bounds.left && point.x <= bounds.right
    && point.y >= bounds.top && point.y <= bounds.bottom;
}

export function containsBounds(container: Bounds, candidate: Bounds): boolean {
  return candidate.left >= container.left && candidate.top >= container.top
    && candidate.right <= container.right && candidate.bottom <= container.bottom;
}

export function groupBounds(objects: SketchObject[]): Bounds {
  if (!objects.length) return { left: 0, top: 0, right: 0, bottom: 0 };
  const bounds = objects.map(objectBounds);
  return {
    left: Math.min(...bounds.map((item) => item.left)),
    top: Math.min(...bounds.map((item) => item.top)),
    right: Math.max(...bounds.map((item) => item.right)),
    bottom: Math.max(...bounds.map((item) => item.bottom)),
  };
}

export function getTextSize(object: Pick<TextObject, 'text' | 'fontSize'>): { width: number; height: number } {
  const metrics = measureSketchText(object.text, object.fontSize);
  return { width: metrics.width, height: metrics.height };
}

/** Visual glyph box before object.rotation is applied. */
export function textUnrotatedBounds(object: TextObject): Bounds {
  const metrics = measureSketchText(object.text, object.fontSize);
  return {
    left: object.x1 + metrics.left,
    top: object.y1 + metrics.top,
    right: object.x1 + metrics.right,
    bottom: object.y1 + metrics.bottom,
  };
}

export function objectCenter(object: SketchObject): Point {
  switch (object.type) {
    case 'circle':
      return { x: object.cx, y: object.cy };
    case 'text': {
      const metrics = measureSketchText(object.text, object.fontSize);
      return {
        x: object.x1 + metrics.centerOffsetX,
        y: object.y1 + metrics.centerOffsetY,
      };
    }
    case 'rect':
    case 'image':
      return { x: (object.x1 + object.x2) / 2, y: (object.y1 + object.y2) / 2 };
    default: {
      const bounds = objectBounds(object);
      return { x: (bounds.left + bounds.right) / 2, y: (bounds.top + bounds.bottom) / 2 };
    }
  }
}

export function intrinsicRectCorners(object: RectObject | ImageObject): Point[] {
  const local = normalizeBounds({ x: object.x1, y: object.y1 }, { x: object.x2, y: object.y2 });
  const center = { x: (local.left + local.right) / 2, y: (local.top + local.bottom) / 2 };
  const rotation = object.rotation ?? 0;
  const corners = [
    { x: local.left, y: local.top },
    { x: local.right, y: local.top },
    { x: local.right, y: local.bottom },
    { x: local.left, y: local.bottom },
  ];
  return rotation ? corners.map((point) => rotatePoint(point, rotation, center)) : corners;
}

export function textCorners(object: TextObject): Point[] {
  const bounds = textUnrotatedBounds(object);
  const center = objectCenter(object);
  const rotation = object.rotation ?? 0;
  const corners = [
    { x: bounds.left, y: bounds.top },
    { x: bounds.right, y: bounds.top },
    { x: bounds.right, y: bounds.bottom },
    { x: bounds.left, y: bounds.bottom },
  ];
  return rotation ? corners.map((point) => rotatePoint(point, rotation, center)) : corners;
}

export function objectBounds(object: SketchObject): Bounds {
  switch (object.type) {
    case 'text':
      return boundsFromPoints(textCorners(object));
    case 'curve':
      return boundsFromPoints([
        { x: object.x1, y: object.y1 },
        { x: object.x2, y: object.y2 },
        { x: object.controlX, y: object.controlY },
      ]);
    case 'circle': {
      const rx = Math.max(0, object.rx ?? object.r ?? 0);
      const ry = Math.max(0, object.ry ?? object.r ?? 0);
      const rotation = object.rotation ?? 0;
      if (!rotation || Math.abs(rx - ry) < 0.000001) {
        return { left: object.cx - rx, top: object.cy - ry, right: object.cx + rx, bottom: object.cy + ry };
      }
      const cos = Math.cos(rotation);
      const sin = Math.sin(rotation);
      const halfWidth = Math.sqrt(rx * rx * cos * cos + ry * ry * sin * sin);
      const halfHeight = Math.sqrt(rx * rx * sin * sin + ry * ry * cos * cos);
      return {
        left: object.cx - halfWidth,
        top: object.cy - halfHeight,
        right: object.cx + halfWidth,
        bottom: object.cy + halfHeight,
      };
    }
    case 'stroke':
    case 'poly':
      return boundsFromPoints(object.segments?.flat() ?? object.points);
    case 'erase':
      return boundsFromPoints(object.segments?.flat() ?? object.points ?? []);
    case 'rect':
    case 'image':
      return boundsFromPoints(intrinsicRectCorners(object));
    case 'line':
    case 'measure':
      return normalizeBounds({ x: object.x1, y: object.y1 }, { x: object.x2, y: object.y2 });
  }
}
