import type { Point, SketchObject, StrokeObject } from '../types';
import { intrinsicRectCorners } from './bounds';
import { distanceToSegment, sampledEllipse, sampledQuadratic } from './hitTest';

type CutResult = { hit: boolean; segments: Point[][] };

function densifyPath(points: Point[], maxStep: number): Point[] {
  if (points.length < 2) return points;
  const out: Point[] = [points[0]];
  for (let index = 0; index < points.length - 1; index += 1) {
    const a = points[index];
    const b = points[index + 1];
    const length = Math.hypot(b.x - a.x, b.y - a.y);
    const steps = Math.max(1, Math.ceil(length / Math.max(0.5, maxStep)));
    for (let step = 1; step <= steps; step += 1) {
      const t = step / steps;
      out.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
    }
  }
  return out;
}

function cutPaths(paths: Point[][], eraserStart: Point, eraserEnd: Point, thickness: number): CutResult {
  const nextSegments: Point[][] = [];
  let hit = false;
  const sampleStep = Math.max(0.75, Math.min(5, thickness / 3));

  for (const path of paths) {
    const dense = densifyPath(path, sampleStep);
    let remaining: Point[] = [];

    for (const point of dense) {
      const erased = distanceToSegment(point, eraserStart, eraserEnd) <= thickness;
      if (erased) {
        hit = true;
        if (remaining.length > 1) nextSegments.push(remaining);
        remaining = [];
      } else {
        remaining.push(point);
      }
    }

    if (remaining.length > 1) nextSegments.push(remaining);
  }

  return { hit, segments: nextSegments };
}

function objectPaths(object: SketchObject): Point[][] | null {
  switch (object.type) {
    case 'stroke':
    case 'poly':
      return object.segments ?? [object.points];
    case 'line':
    case 'measure':
      return [[{ x: object.x1, y: object.y1 }, { x: object.x2, y: object.y2 }]];
    case 'rect': {
      const corners = intrinsicRectCorners(object);
      return [[...corners, corners[0]]];
    }
    case 'circle': {
      const rx = Math.max(0.001, object.rx ?? object.r ?? 0);
      const ry = Math.max(0.001, object.ry ?? object.r ?? 0);
      const circumference = Math.PI * (3 * (rx + ry) - Math.sqrt((3 * rx + ry) * (rx + 3 * ry)));
      const steps = Math.max(64, Math.min(360, Math.ceil(circumference / 3)));
      return [sampledEllipse(object.cx, object.cy, rx, ry, object.rotation ?? 0, steps)];
    }
    case 'curve': {
      const roughLength = Math.hypot(object.controlX - object.x1, object.controlY - object.y1)
        + Math.hypot(object.x2 - object.controlX, object.y2 - object.controlY);
      const steps = Math.max(48, Math.min(240, Math.ceil(roughLength / 3)));
      return [sampledQuadratic(
        { x: object.x1, y: object.y1 },
        { x: object.controlX, y: object.controlY },
        { x: object.x2, y: object.y2 },
        steps,
      )];
    }
    // Text/image remain semantic objects. Use Object Eraser for those rather
    // than destroying the entire item from a small free-eraser stroke.
    case 'text':
    case 'image':
    case 'erase':
      return null;
  }
}

function asStrokeFragments(object: SketchObject, segments: Point[][]): StrokeObject | null {
  if (!segments.length) return null;
  return {
    id: object.id,
    layerId: object.layerId,
    color: object.color,
    width: object.width,
    dash: object.dash,
    opacity: object.opacity,
    visible: object.visible,
    locked: object.locked,
    name: object.name,
    type: 'stroke',
    points: segments[0],
    segments,
  };
}

/**
 * Free eraser for the active layer.
 * Stroke/poly objects remain segmented vector paths. Geometric shapes are
 * converted to stroke fragments only after the eraser actually cuts them,
 * allowing a rectangle/circle/line/curve to lose just the touched portion.
 */
export function cutObjectsWithEraser(
  objects: SketchObject[],
  start: Point,
  end: Point,
  radius: number,
  activeLayerId?: number,
): SketchObject[] {
  const result: SketchObject[] = [];

  for (const object of objects) {
    if (
      (activeLayerId !== undefined && object.layerId !== activeLayerId)
      || object.type === 'erase'
      || object.visible === false
      || object.locked === true
    ) {
      result.push(object);
      continue;
    }

    const paths = objectPaths(object);
    if (!paths) {
      result.push(object);
      continue;
    }

    const thickness = Math.max(0.1, radius) + Math.max(1, object.width) / 2;
    const cut = cutPaths(paths, start, end, thickness);
    if (!cut.hit) {
      result.push(object);
      continue;
    }

    if (!cut.segments.length) continue;

    if (object.type === 'stroke' || object.type === 'poly') {
      result.push({ ...object, segments: cut.segments });
      continue;
    }

    const fragment = asStrokeFragments(object, cut.segments);
    if (fragment) result.push(fragment);
  }

  return result;
}
