import type {
  CircleObject,
  CurveObject,
  LineObject,
  MeasureObject,
  Point,
  RectObject,
  SketchObjectStyle,
} from '../types';

export type DragShapeTool = 'line' | 'rect' | 'circle' | 'curve' | 'measure';
export type DragShapeObject = LineObject | RectObject | CircleObject | CurveObject | MeasureObject;

export function buildDragShape(tool: DragShapeTool, start: Point, end: Point, style: SketchObjectStyle): DragShapeObject {
  switch (tool) {
    case 'circle':
      return {
        ...style,
        type: 'circle',
        cx: (start.x + end.x) / 2,
        cy: (start.y + end.y) / 2,
        rx: Math.abs(end.x - start.x) / 2,
        ry: Math.abs(end.y - start.y) / 2,
      };
    case 'curve':
      return {
        ...style,
        type: 'curve',
        x1: start.x,
        y1: start.y,
        x2: end.x,
        y2: end.y,
        controlX: (start.x + end.x) / 2,
        controlY: (start.y + end.y) / 2,
      };
    case 'measure':
      return { ...style, type: 'measure', x1: start.x, y1: start.y, x2: end.x, y2: end.y };
    case 'line':
      return { ...style, type: 'line', x1: start.x, y1: start.y, x2: end.x, y2: end.y };
    case 'rect':
      return { ...style, type: 'rect', x1: start.x, y1: start.y, x2: end.x, y2: end.y };
  }
}

export function scaleToMetersPerSquare(scale: number): number {
  const safeScale = Number.isFinite(scale) && scale > 0 ? scale : 100;
  return safeScale / 100;
}

export function metersPerSquareToScale(metersPerSquare: number): number {
  const safeMeters = Number.isFinite(metersPerSquare) && metersPerSquare > 0 ? metersPerSquare : 1;
  return safeMeters * 100;
}

export function formatScaleValue(scale: number): string {
  if (!Number.isFinite(scale) || scale <= 0) return '100';
  const rounded = Math.round(scale * 100) / 100;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
}
