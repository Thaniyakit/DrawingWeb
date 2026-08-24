import type { Point, SketchObject } from '../types';

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

function boundsFromPoints(points: Point[]): Bounds {
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

function rotatedRectBounds(bounds: Bounds, rotation: number): Bounds {
  if (!rotation) return bounds;
  const center = {
    x: (bounds.left + bounds.right) / 2,
    y: (bounds.top + bounds.bottom) / 2,
  };
  return boundsFromPoints([
    rotatePoint({ x: bounds.left, y: bounds.top }, rotation, center),
    rotatePoint({ x: bounds.right, y: bounds.top }, rotation, center),
    rotatePoint({ x: bounds.right, y: bounds.bottom }, rotation, center),
    rotatePoint({ x: bounds.left, y: bounds.bottom }, rotation, center),
  ]);
}

export function getTextSize(object: SketchObject): { width: number; height: number } {
  const height = Math.max(1, object.fontSize ?? 14);
  const width = Math.max(height * 0.6, (object.text ?? '').length * height * 0.6);
  return { width, height };
}

export function objectBounds(object: SketchObject): Bounds {
  if (object.type === 'text') {
    const { width, height } = getTextSize(object);
    const local = {
      left: object.x1 ?? 0,
      top: (object.y1 ?? 0) - height,
      right: (object.x1 ?? 0) + width,
      bottom: object.y1 ?? 0,
    };
    return rotatedRectBounds(local, object.rotation ?? 0);
  }

  if (object.type === 'curve') {
    return boundsFromPoints([
      { x: object.x1 ?? 0, y: object.y1 ?? 0 },
      { x: object.x2 ?? 0, y: object.y2 ?? 0 },
      { x: object.controlX ?? 0, y: object.controlY ?? 0 },
    ]);
  }

  if (object.type === 'circle') {
    const cx = object.cx ?? 0;
    const cy = object.cy ?? 0;
    const rx = Math.max(0, object.rx ?? object.r ?? 0);
    const ry = Math.max(0, object.ry ?? object.r ?? 0);
    const rotation = object.rotation ?? 0;

    if (!rotation || Math.abs(rx - ry) < 0.000001) {
      return { left: cx - rx, top: cy - ry, right: cx + rx, bottom: cy + ry };
    }

    const cos = Math.cos(rotation);
    const sin = Math.sin(rotation);
    const halfWidth = Math.sqrt(rx * rx * cos * cos + ry * ry * sin * sin);
    const halfHeight = Math.sqrt(rx * rx * sin * sin + ry * ry * cos * cos);
    return {
      left: cx - halfWidth,
      top: cy - halfHeight,
      right: cx + halfWidth,
      bottom: cy + halfHeight,
    };
  }

  if (object.points?.length || object.segments?.length) {
    return boundsFromPoints(object.segments?.flat() ?? object.points ?? []);
  }

  const local = normalizeBounds(
    { x: object.x1 ?? 0, y: object.y1 ?? 0 },
    { x: object.x2 ?? object.x1 ?? 0, y: object.y2 ?? object.y1 ?? 0 },
  );

  if (object.type === 'rect' || object.type === 'image') {
    return rotatedRectBounds(local, object.rotation ?? 0);
  }

  return local;
}

export function objectCenter(object: SketchObject): Point {
  if (object.type === 'circle') return { x: object.cx ?? 0, y: object.cy ?? 0 };

  if (object.type === 'text') {
    const { width, height } = getTextSize(object);
    return {
      x: (object.x1 ?? 0) + width / 2,
      y: (object.y1 ?? 0) - height / 2,
    };
  }

  if (object.type === 'rect' || object.type === 'image') {
    return {
      x: ((object.x1 ?? 0) + (object.x2 ?? object.x1 ?? 0)) / 2,
      y: ((object.y1 ?? 0) + (object.y2 ?? object.y1 ?? 0)) / 2,
    };
  }

  const bounds = objectBounds(object);
  return {
    x: (bounds.left + bounds.right) / 2,
    y: (bounds.top + bounds.bottom) / 2,
  };
}
