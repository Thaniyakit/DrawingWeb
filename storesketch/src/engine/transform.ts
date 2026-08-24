import type { Point, SketchObject, ViewState } from '../types';
import { objectCenter, rotatePoint, type Bounds } from './bounds';
import { measureSketchText } from './textMetrics';

export type ResizeHandle = 'nw' | 'ne' | 'sw' | 'se';

export type EditState = {
  mode: 'move' | 'resize' | 'curve' | 'rotate';
  start: Point;
  initial: SketchObject;
  bounds: Bounds;
  handle?: ResizeHandle;
};

export type MultiEditState = {
  mode: 'move' | 'resize' | 'rotate';
  start: Point;
  initial: SketchObject[];
  bounds: Bounds;
  handle?: ResizeHandle;
};

export function findHandle(point: Point, bounds: Bounds, view: Pick<ViewState, 's'>): ResizeHandle | null {
  const tolerance = 10 / view.s;
  const handles: { name: ResizeHandle; x: number; y: number }[] = [
    { name: 'nw', x: bounds.left, y: bounds.top },
    { name: 'ne', x: bounds.right, y: bounds.top },
    { name: 'sw', x: bounds.left, y: bounds.bottom },
    { name: 'se', x: bounds.right, y: bounds.bottom },
  ];
  return handles.find((handle) => (
    Math.abs(point.x - handle.x) <= tolerance && Math.abs(point.y - handle.y) <= tolerance
  ))?.name ?? null;
}

export function nearRotateHandle(point: Point, bounds: Bounds, view: Pick<ViewState, 's'>): boolean {
  const centerX = (bounds.left + bounds.right) / 2;
  const handleY = bounds.top - 28 / view.s;
  return Math.hypot(point.x - centerX, point.y - handleY) <= 12 / view.s;
}

export function nearCurveControl(
  point: Point,
  object: Extract<SketchObject, { type: 'curve' }>,
  view: Pick<ViewState, 's'>,
): boolean {
  return Math.hypot(point.x - object.controlX, point.y - object.controlY) <= 10 / view.s;
}

export function rotateObject(object: SketchObject, angle: number, center: Point): SketchObject {
  switch (object.type) {
    case 'rect':
    case 'image': {
      const currentCenter = objectCenter(object);
      const nextCenter = rotatePoint(currentCenter, angle, center);
      const width = Math.abs(object.x2 - object.x1);
      const height = Math.abs(object.y2 - object.y1);
      return {
        ...object,
        x1: nextCenter.x - width / 2,
        y1: nextCenter.y - height / 2,
        x2: nextCenter.x + width / 2,
        y2: nextCenter.y + height / 2,
        rotation: (object.rotation ?? 0) + angle,
      };
    }
    case 'circle': {
      const nextCenter = rotatePoint({ x: object.cx, y: object.cy }, angle, center);
      return {
        ...object,
        cx: nextCenter.x,
        cy: nextCenter.y,
        rotation: (object.rotation ?? 0) + angle,
      };
    }
    case 'text': {
      const currentCenter = objectCenter(object);
      const nextCenter = rotatePoint(currentCenter, angle, center);
      const metrics = measureSketchText(object.text, object.fontSize);
      return {
        ...object,
        x1: nextCenter.x - metrics.centerOffsetX,
        y1: nextCenter.y - metrics.centerOffsetY,
        rotation: (object.rotation ?? 0) + angle,
      };
    }
    case 'stroke':
      return {
        ...object,
        points: object.points.map((point) => rotatePoint(point, angle, center)),
        segments: object.segments?.map((segment) => segment.map((point) => rotatePoint(point, angle, center))),
      };
    case 'poly':
      return {
        ...object,
        points: object.points.map((point) => rotatePoint(point, angle, center)),
        segments: object.segments?.map((segment) => segment.map((point) => rotatePoint(point, angle, center))),
      };
    case 'erase':
      return {
        ...object,
        points: object.points?.map((point) => rotatePoint(point, angle, center)),
        segments: object.segments?.map((segment) => segment.map((point) => rotatePoint(point, angle, center))),
      };
    case 'line':
    case 'measure': {
      const first = rotatePoint({ x: object.x1, y: object.y1 }, angle, center);
      const second = rotatePoint({ x: object.x2, y: object.y2 }, angle, center);
      return { ...object, x1: first.x, y1: first.y, x2: second.x, y2: second.y };
    }
    case 'curve': {
      const first = rotatePoint({ x: object.x1, y: object.y1 }, angle, center);
      const second = rotatePoint({ x: object.x2, y: object.y2 }, angle, center);
      const control = rotatePoint({ x: object.controlX, y: object.controlY }, angle, center);
      return {
        ...object,
        x1: first.x,
        y1: first.y,
        x2: second.x,
        y2: second.y,
        controlX: control.x,
        controlY: control.y,
      };
    }
  }
}

export function transformObject(
  object: SketchObject,
  from: Bounds,
  to: Bounds,
  scaleX = (to.right - to.left) / Math.max(from.right - from.left, 0.001),
  scaleY = (to.bottom - to.top) / Math.max(from.bottom - from.top, 0.001),
): SketchObject {
  const mapPoint = (point: Point): Point => ({
    x: to.left + (point.x - from.left) * scaleX,
    y: to.top + (point.y - from.top) * scaleY,
  });

  switch (object.type) {
    case 'stroke':
      return {
        ...object,
        points: object.points.map(mapPoint),
        segments: object.segments?.map((segment) => segment.map(mapPoint)),
      };
    case 'poly':
      return {
        ...object,
        points: object.points.map(mapPoint),
        segments: object.segments?.map((segment) => segment.map(mapPoint)),
      };
    case 'erase':
      return {
        ...object,
        points: object.points?.map(mapPoint),
        segments: object.segments?.map((segment) => segment.map(mapPoint)),
      };
    case 'text': {
      // A pure move must translate the baseline anchor directly. Rebuilding the
      // anchor from an estimated bounding-box center caused visible drift.
      const fromWidth = from.right - from.left;
      const fromHeight = from.bottom - from.top;
      const toWidth = to.right - to.left;
      const toHeight = to.bottom - to.top;
      const isTranslation = Math.abs(fromWidth - toWidth) < 1e-7
        && Math.abs(fromHeight - toHeight) < 1e-7;
      if (isTranslation) {
        return {
          ...object,
          x1: object.x1 + (to.left - from.left),
          y1: object.y1 + (to.top - from.top),
        };
      }

      const nextCenter = mapPoint(objectCenter(object));
      const nextFontSize = Math.max(1, object.fontSize * Math.max(Math.abs(scaleX), Math.abs(scaleY)));
      const metrics = measureSketchText(object.text, nextFontSize);
      return {
        ...object,
        x1: nextCenter.x - metrics.centerOffsetX,
        y1: nextCenter.y - metrics.centerOffsetY,
        fontSize: nextFontSize,
      };
    }
    case 'circle': {
      const center = mapPoint({ x: object.cx, y: object.cy });
      const rx = Math.max(0.001, (object.rx ?? object.r ?? 0) * Math.abs(scaleX));
      const ry = Math.max(0.001, (object.ry ?? object.r ?? 0) * Math.abs(scaleY));
      return { ...object, cx: center.x, cy: center.y, rx, ry, r: undefined };
    }
    case 'rect':
    case 'image': {
      const center = mapPoint(objectCenter(object));
      const width = Math.max(0.001, Math.abs(object.x2 - object.x1) * Math.abs(scaleX));
      const height = Math.max(0.001, Math.abs(object.y2 - object.y1) * Math.abs(scaleY));
      return {
        ...object,
        x1: center.x - width / 2,
        y1: center.y - height / 2,
        x2: center.x + width / 2,
        y2: center.y + height / 2,
      };
    }
    case 'curve': {
      const start = mapPoint({ x: object.x1, y: object.y1 });
      const end = mapPoint({ x: object.x2, y: object.y2 });
      const control = mapPoint({ x: object.controlX, y: object.controlY });
      return {
        ...object,
        x1: start.x,
        y1: start.y,
        x2: end.x,
        y2: end.y,
        controlX: control.x,
        controlY: control.y,
      };
    }
    case 'line':
    case 'measure': {
      const first = mapPoint({ x: object.x1, y: object.y1 });
      const second = mapPoint({ x: object.x2, y: object.y2 });
      return { ...object, x1: first.x, y1: first.y, x2: second.x, y2: second.y };
    }
  }
}

export function editObject(state: EditState, point: Point): SketchObject {
  const object = state.initial;
  if (state.mode === 'curve') {
    if (object.type !== 'curve') return object;
    return { ...object, controlX: point.x, controlY: point.y };
  }
  if (state.mode === 'rotate') {
    const center = {
      x: (state.bounds.left + state.bounds.right) / 2,
      y: (state.bounds.top + state.bounds.bottom) / 2,
    };
    const angle = Math.atan2(point.y - center.y, point.x - center.x)
      - Math.atan2(state.start.y - center.y, state.start.x - center.x);
    return rotateObject(object, angle, center);
  }
  if (state.mode === 'move') {
    const dx = point.x - state.start.x;
    const dy = point.y - state.start.y;
    if (object.type === 'text') {
      return { ...object, x1: object.x1 + dx, y1: object.y1 + dy };
    }
    return transformObject(object, state.bounds, translateBounds(state.bounds, dx, dy));
  }

  if (!state.handle) return object;
  if (object.type === 'text' && Math.abs(object.rotation ?? 0) < 1e-8) {
    return resizeUnrotatedText(object, state.handle, point, state.bounds);
  }
  const nextBounds = resizeBounds(state.bounds, state.handle, point);
  return transformObject(object, state.bounds, nextBounds);
}

function resizeUnrotatedText(
  object: Extract<SketchObject, { type: 'text' }>,
  handle: ResizeHandle,
  point: Point,
  bounds: Bounds,
): SketchObject {
  const opposite = {
    x: handle.includes('w') ? bounds.right : bounds.left,
    y: handle.includes('n') ? bounds.bottom : bounds.top,
  };
  const originalHandle = {
    x: handle.includes('w') ? bounds.left : bounds.right,
    y: handle.includes('n') ? bounds.top : bounds.bottom,
  };
  const originalVector = {
    x: originalHandle.x - opposite.x,
    y: originalHandle.y - opposite.y,
  };
  const pointerVector = { x: point.x - opposite.x, y: point.y - opposite.y };
  const lengthSquared = originalVector.x * originalVector.x + originalVector.y * originalVector.y;
  const projectedScale = lengthSquared > 1e-8
    ? (pointerVector.x * originalVector.x + pointerVector.y * originalVector.y) / lengthSquared
    : 1;
  const scale = Math.max(0.05, projectedScale);
  const fontSize = Math.max(1, object.fontSize * scale);
  const metrics = measureSketchText(object.text, fontSize);

  let x1: number;
  let y1: number;
  if (handle.includes('w')) {
    // East side stays fixed.
    x1 = opposite.x - metrics.right;
  } else {
    // West side stays fixed.
    x1 = opposite.x - metrics.left;
  }

  if (handle.includes('n')) {
    // South side stays fixed.
    y1 = opposite.y - metrics.bottom;
  } else {
    // North side stays fixed.
    y1 = opposite.y - metrics.top;
  }

  return { ...object, x1, y1, fontSize };
}

export function translateBounds(bounds: Bounds, x: number, y: number): Bounds {
  return {
    left: bounds.left + x,
    top: bounds.top + y,
    right: bounds.right + x,
    bottom: bounds.bottom + y,
  };
}

export function resizeBounds(bounds: Bounds, handle: ResizeHandle, point: Point): Bounds {
  const next = { ...bounds };
  if (handle.includes('w')) next.left = point.x;
  if (handle.includes('e')) next.right = point.x;
  if (handle.includes('n')) next.top = point.y;
  if (handle.includes('s')) next.bottom = point.y;
  return next;
}
