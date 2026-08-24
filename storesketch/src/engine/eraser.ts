import type { Point, SketchObject } from '../types';
import { distanceBetweenSegments, eraserHitsObject } from './hitTest';

/**
 * Pure eraser operation. Stroke/poly objects are split into remaining segments;
 * other supported objects are removed when the eraser path intersects them.
 */
export function cutObjectsWithEraser(objects: SketchObject[], start: Point, end: Point, radius: number): SketchObject[] {
  const result: SketchObject[] = [];

  for (const object of objects) {
    if (object.type === 'stroke' || object.type === 'poly') {
      const source = object.segments ?? [object.points];
      const nextSegments: Point[][] = [];

      for (const segment of source) {
        let remaining: Point[] = [];
        for (let index = 0; index < segment.length - 1; index += 1) {
          const first = segment[index];
          const second = segment[index + 1];
          const hit = distanceBetweenSegments(first, second, start, end)
            <= radius + Math.max(1, object.width) / 2;

          if (hit) {
            if (remaining.length > 1) nextSegments.push(remaining);
            remaining = [];
          } else {
            if (!remaining.length) remaining.push(first);
            remaining.push(second);
          }
        }
        if (remaining.length > 1) nextSegments.push(remaining);
      }

      if (nextSegments.length) result.push({ ...object, segments: nextSegments });
      continue;
    }

    if (object.type === 'erase' || object.visible === false) {
      result.push(object);
      continue;
    }

    if (!eraserHitsObject(object, start, end, radius)) result.push(object);
  }

  return result;
}
