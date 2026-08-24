import type { Point, SketchObject } from '../types';
import { intrinsicRectCorners, objectCenter, rotatePoint, textUnrotatedBounds } from './bounds';

export function distanceToSegment(point: Point, start: Point, end: Point): number {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lengthSquared = dx * dx + dy * dy;
  if (!lengthSquared) return Math.hypot(point.x - start.x, point.y - start.y);
  const t = Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared));
  return Math.hypot(point.x - (start.x + t * dx), point.y - (start.y + t * dy));
}

export function distanceBetweenSegments(a1: Point, a2: Point, b1: Point, b2: Point): number {
  if (segmentsIntersect(a1, a2, b1, b2)) return 0;
  return Math.min(
    distanceToSegment(a1, b1, b2),
    distanceToSegment(a2, b1, b2),
    distanceToSegment(b1, a1, a2),
    distanceToSegment(b2, a1, a2),
  );
}

function orientation(a: Point, b: Point, c: Point): number {
  return (b.y - a.y) * (c.x - b.x) - (b.x - a.x) * (c.y - b.y);
}

function onSegment(a: Point, b: Point, p: Point): boolean {
  const epsilon = 1e-9;
  return p.x <= Math.max(a.x, b.x) + epsilon
    && p.x >= Math.min(a.x, b.x) - epsilon
    && p.y <= Math.max(a.y, b.y) + epsilon
    && p.y >= Math.min(a.y, b.y) - epsilon;
}

function segmentsIntersect(a1: Point, a2: Point, b1: Point, b2: Point): boolean {
  const o1 = orientation(a1, a2, b1);
  const o2 = orientation(a1, a2, b2);
  const o3 = orientation(b1, b2, a1);
  const o4 = orientation(b1, b2, a2);
  const epsilon = 1e-9;

  if (Math.abs(o1) < epsilon && onSegment(a1, a2, b1)) return true;
  if (Math.abs(o2) < epsilon && onSegment(a1, a2, b2)) return true;
  if (Math.abs(o3) < epsilon && onSegment(b1, b2, a1)) return true;
  if (Math.abs(o4) < epsilon && onSegment(b1, b2, a2)) return true;
  return (o1 > 0) !== (o2 > 0) && (o3 > 0) !== (o4 > 0);
}

export function sampledQuadratic(p0: Point, p1: Point, p2: Point, steps = 28): Point[] {
  const out: Point[] = [];
  for (let i = 0; i <= steps; i += 1) {
    const t = i / steps;
    const mt = 1 - t;
    out.push({
      x: mt * mt * p0.x + 2 * mt * t * p1.x + t * t * p2.x,
      y: mt * mt * p0.y + 2 * mt * t * p1.y + t * t * p2.y,
    });
  }
  return out;
}

export function sampledEllipse(cx: number, cy: number, rx: number, ry: number, rotation = 0, steps = 56): Point[] {
  const center = { x: cx, y: cy };
  const out: Point[] = [];
  for (let i = 0; i <= steps; i += 1) {
    const t = (i / steps) * Math.PI * 2;
    const local = { x: cx + Math.cos(t) * rx, y: cy + Math.sin(t) * ry };
    out.push(rotation ? rotatePoint(local, rotation, center) : local);
  }
  return out;
}

function polylineDistance(points: Point[], point: Point): number {
  if (points.length === 1) return Math.hypot(point.x - points[0].x, point.y - points[0].y);
  let best = Number.POSITIVE_INFINITY;
  for (let i = 0; i < points.length - 1; i += 1) {
    best = Math.min(best, distanceToSegment(point, points[i], points[i + 1]));
  }
  return best;
}

function polylineHitsSegment(points: Point[], start: Point, end: Point, tolerance: number): boolean {
  for (let i = 0; i < points.length - 1; i += 1) {
    if (distanceBetweenSegments(points[i], points[i + 1], start, end) <= tolerance) return true;
  }
  return false;
}

function pointInPolygon(point: Point, polygon: Point[]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
    const a = polygon[i];
    const b = polygon[j];
    const intersects = ((a.y > point.y) !== (b.y > point.y))
      && point.x < ((b.x - a.x) * (point.y - a.y)) / ((b.y - a.y) || Number.EPSILON) + a.x;
    if (intersects) inside = !inside;
  }
  return inside;
}

function pointInRotatedText(object: Extract<SketchObject, { type: 'text' }>, point: Point, tolerance: number): boolean {
  const center = objectCenter(object);
  const localPoint = rotatePoint(point, -(object.rotation ?? 0), center);
  const bounds = textUnrotatedBounds(object);
  return localPoint.x >= bounds.left - tolerance
    && localPoint.x <= bounds.right + tolerance
    && localPoint.y >= bounds.top - tolerance
    && localPoint.y <= bounds.bottom + tolerance;
}

function pointInEllipse(object: Extract<SketchObject, { type: 'circle' }>, point: Point, tolerance: number): boolean {
  const center = { x: object.cx, y: object.cy };
  const local = rotatePoint(point, -(object.rotation ?? 0), center);
  const rx = Math.max(0.001, object.rx ?? object.r ?? 0);
  const ry = Math.max(0.001, object.ry ?? object.r ?? 0);
  const expandedRx = rx + tolerance;
  const expandedRy = ry + tolerance;
  const nx = (local.x - object.cx) / expandedRx;
  const ny = (local.y - object.cy) / expandedRy;
  return nx * nx + ny * ny <= 1;
}

function isClosedPolyline(points: Point[]): boolean {
  if (points.length < 3) return false;
  const first = points[0];
  const last = points[points.length - 1];
  return Math.hypot(first.x - last.x, first.y - last.y) < 0.001;
}

/** Precise point hit-test used by select, text edit and object eraser. */
export function hitTestObject(object: SketchObject, point: Point, tolerance = 6): boolean {
  if (object.visible === false || object.locked === true || object.type === 'erase') return false;
  const strokeTolerance = tolerance + Math.max(1, object.width) / 2;

  switch (object.type) {
    case 'line':
    case 'measure':
      return distanceToSegment(point, { x: object.x1, y: object.y1 }, { x: object.x2, y: object.y2 }) <= strokeTolerance;
    case 'stroke': {
      const segments = object.segments ?? [object.points];
      return segments.some((segment) => polylineDistance(segment, point) <= strokeTolerance);
    }
    case 'poly': {
      const segments = object.segments ?? [object.points];
      if (segments.some((segment) => polylineDistance(segment, point) <= strokeTolerance)) return true;
      return !object.segments && isClosedPolyline(object.points) && pointInPolygon(point, object.points);
    }
    case 'curve': {
      const points = sampledQuadratic(
        { x: object.x1, y: object.y1 },
        { x: object.controlX, y: object.controlY },
        { x: object.x2, y: object.y2 },
      );
      return polylineDistance(points, point) <= strokeTolerance;
    }
    case 'rect':
    case 'image': {
      const corners = intrinsicRectCorners(object);
      return pointInPolygon(point, corners)
        || corners.some((corner, index) => distanceToSegment(point, corner, corners[(index + 1) % corners.length]) <= strokeTolerance);
    }
    case 'circle':
      return pointInEllipse(object, point, strokeTolerance);
    case 'text':
      return pointInRotatedText(object, point, tolerance);
  }
}

export function hitTestObjects(objects: SketchObject[], point: Point, tolerance = 6): SketchObject | undefined {
  return [...objects].reverse().find((object) => hitTestObject(object, point, tolerance));
}

/** Path hit-test used by the free eraser for non-stroke objects. */
export function eraserHitsObject(object: SketchObject, eraserStart: Point, eraserEnd: Point, radius: number): boolean {
  if (object.type === 'erase' || object.visible === false || object.locked === true) return false;
  const thickness = radius + Math.max(1, object.width) / 2;

  switch (object.type) {
    case 'line':
    case 'measure':
      return distanceBetweenSegments(
        { x: object.x1, y: object.y1 },
        { x: object.x2, y: object.y2 },
        eraserStart,
        eraserEnd,
      ) <= thickness;
    case 'stroke': {
      const segments = object.segments ?? [object.points];
      return segments.some((segment) => polylineHitsSegment(segment, eraserStart, eraserEnd, thickness));
    }
    case 'poly': {
      const segments = object.segments ?? [object.points];
      return segments.some((segment) => polylineHitsSegment(segment, eraserStart, eraserEnd, thickness));
    }
    case 'curve': {
      const points = sampledQuadratic(
        { x: object.x1, y: object.y1 },
        { x: object.controlX, y: object.controlY },
        { x: object.x2, y: object.y2 },
      );
      return polylineHitsSegment(points, eraserStart, eraserEnd, thickness);
    }
    case 'circle': {
      const rx = Math.max(0.001, object.rx ?? object.r ?? 0);
      const ry = Math.max(0.001, object.ry ?? object.r ?? 0);
      const outline = sampledEllipse(object.cx, object.cy, rx, ry, object.rotation ?? 0);
      return polylineHitsSegment(outline, eraserStart, eraserEnd, thickness)
        || pointInEllipse(object, eraserStart, radius)
        || pointInEllipse(object, eraserEnd, radius);
    }
    case 'rect':
    case 'image': {
      const corners = intrinsicRectCorners(object);
      const edgeHit = corners.some((corner, index) => (
        distanceBetweenSegments(corner, corners[(index + 1) % corners.length], eraserStart, eraserEnd) <= thickness
      ));
      return edgeHit || pointInPolygon(eraserStart, corners) || pointInPolygon(eraserEnd, corners);
    }
    case 'text': {
      const center = objectCenter(object);
      const localStart = rotatePoint(eraserStart, -(object.rotation ?? 0), center);
      const localEnd = rotatePoint(eraserEnd, -(object.rotation ?? 0), center);
      const bounds = textUnrotatedBounds(object);
      const corners = [
        { x: bounds.left, y: bounds.top },
        { x: bounds.right, y: bounds.top },
        { x: bounds.right, y: bounds.bottom },
        { x: bounds.left, y: bounds.bottom },
      ];
      return corners.some((corner, index) => (
        distanceBetweenSegments(corner, corners[(index + 1) % corners.length], localStart, localEnd) <= thickness
      )) || pointInPolygon(localStart, corners) || pointInPolygon(localEnd, corners);
    }
  }
}
