import type { Point, SketchObject, SketchObjectStyle } from '../types';

function distance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function distanceToSegment(point: Point, start: Point, end: Point): number {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared <= 1e-9) return distance(point, start);
  const t = Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared));
  return Math.hypot(point.x - (start.x + t * dx), point.y - (start.y + t * dy));
}

function simplifyInput(points: Point[]): Point[] {
  if (points.length <= 2) return points;
  const out: Point[] = [points[0]];
  for (let index = 1; index < points.length; index += 1) {
    const point = points[index];
    if (distance(point, out[out.length - 1]) >= 1.5 || index === points.length - 1) out.push(point);
  }
  return out;
}

function cumulativeParameters(points: Point[]): number[] {
  const lengths = [0];
  for (let index = 1; index < points.length; index += 1) {
    lengths.push(lengths[index - 1] + distance(points[index - 1], points[index]));
  }
  const total = lengths[lengths.length - 1] || 1;
  return lengths.map((value) => value / total);
}

function fitQuadratic(points: Point[]): { control: Point } {
  const p0 = points[0];
  const p2 = points[points.length - 1];
  const ts = cumulativeParameters(points);
  let numeratorX = 0;
  let numeratorY = 0;
  let denominator = 0;

  points.forEach((point, index) => {
    const t = ts[index];
    const mt = 1 - t;
    const b = 2 * mt * t;
    if (b <= 1e-9) return;
    const ax = mt * mt * p0.x + t * t * p2.x;
    const ay = mt * mt * p0.y + t * t * p2.y;
    numeratorX += b * (point.x - ax);
    numeratorY += b * (point.y - ay);
    denominator += b * b;
  });

  return {
    control: denominator > 1e-9
      ? { x: numeratorX / denominator, y: numeratorY / denominator }
      : { x: (p0.x + p2.x) / 2, y: (p0.y + p2.y) / 2 },
  };
}

function principalAxes(points: Point[]) {
  const center = points.reduce((sum, point) => ({ x: sum.x + point.x, y: sum.y + point.y }), { x: 0, y: 0 });
  center.x /= points.length;
  center.y /= points.length;

  let xx = 0;
  let xy = 0;
  let yy = 0;
  for (const point of points) {
    const dx = point.x - center.x;
    const dy = point.y - center.y;
    xx += dx * dx;
    xy += dx * dy;
    yy += dy * dy;
  }
  const angle = 0.5 * Math.atan2(2 * xy, xx - yy);
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const local = points.map((point) => {
    const dx = point.x - center.x;
    const dy = point.y - center.y;
    return { x: dx * cos + dy * sin, y: -dx * sin + dy * cos };
  });
  const xs = local.map((point) => point.x);
  const ys = local.map((point) => point.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  return {
    center,
    angle,
    local,
    width: Math.max(0.001, maxX - minX),
    height: Math.max(0.001, maxY - minY),
    localCenter: { x: (minX + maxX) / 2, y: (minY + maxY) / 2 },
  };
}

function snapCardinalAngle(angle: number): number {
  const step = Math.PI / 2;
  const snapped = Math.round(angle / step) * step;
  return Math.abs(angle - snapped) <= 8 * Math.PI / 180 ? snapped : angle;
}

function localToWorld(local: Point, center: Point, angle: number): Point {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return {
    x: center.x + local.x * cos - local.y * sin,
    y: center.y + local.x * sin + local.y * cos,
  };
}

function closedShapeScores(points: Point[]) {
  const axes = principalAxes(points);
  const halfW = axes.width / 2;
  const halfH = axes.height / 2;
  const centerLocal = axes.localCenter;
  let rectError = 0;
  let ellipseError = 0;

  for (const point of axes.local) {
    const x = point.x - centerLocal.x;
    const y = point.y - centerLocal.y;
    const sideError = Math.min(Math.abs(Math.abs(x) - halfW), Math.abs(Math.abs(y) - halfH));
    rectError += sideError / Math.max(1, Math.min(halfW, halfH));

    const radial = Math.sqrt((x * x) / Math.max(1e-9, halfW * halfW) + (y * y) / Math.max(1e-9, halfH * halfH));
    ellipseError += Math.abs(radial - 1);
  }

  rectError /= points.length;
  ellipseError /= points.length;
  const trueCenter = localToWorld(centerLocal, axes.center, axes.angle);
  return { ...axes, center: trueCenter, rectError, ellipseError };
}

/** Turn a rough freehand gesture into a simple editable vector shape. */
export function recognizeAutoShape(rawPoints: Point[], style: SketchObjectStyle): SketchObject | null {
  const points = simplifyInput(rawPoints);
  if (points.length < 3) return null;

  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  const width = Math.max(...xs) - Math.min(...xs);
  const height = Math.max(...ys) - Math.min(...ys);
  const diagonal = Math.hypot(width, height);
  if (diagonal < 8) return null;

  const start = points[0];
  const end = points[points.length - 1];
  const endpointGap = distance(start, end);
  const closed = endpointGap <= Math.max(10, diagonal * 0.24);

  if (!closed) {
    const chord = Math.max(1, endpointGap);
    let maxDeviation = 0;
    let meanDeviation = 0;
    for (const point of points) {
      const deviation = distanceToSegment(point, start, end);
      maxDeviation = Math.max(maxDeviation, deviation);
      meanDeviation += deviation;
    }
    meanDeviation /= points.length;

    if (maxDeviation / chord < 0.095 && meanDeviation / chord < 0.045) {
      return { ...style, type: 'line', x1: start.x, y1: start.y, x2: end.x, y2: end.y };
    }

    const fit = fitQuadratic(points);
    return {
      ...style,
      type: 'curve',
      x1: start.x,
      y1: start.y,
      x2: end.x,
      y2: end.y,
      controlX: fit.control.x,
      controlY: fit.control.y,
    };
  }

  const shape = closedShapeScores(points);
  const halfW = shape.width / 2;
  const halfH = shape.height / 2;
  const aspect = Math.max(shape.width, shape.height) / Math.max(0.001, Math.min(shape.width, shape.height));

  if (shape.rectError <= shape.ellipseError * 1.08) {
    return {
      ...style,
      type: 'rect',
      x1: shape.center.x - halfW,
      y1: shape.center.y - halfH,
      x2: shape.center.x + halfW,
      y2: shape.center.y + halfH,
      rotation: snapCardinalAngle(shape.angle),
    };
  }

  if (aspect < 1.18) {
    const radius = (halfW + halfH) / 2;
    return {
      ...style,
      type: 'circle',
      cx: shape.center.x,
      cy: shape.center.y,
      rx: radius,
      ry: radius,
      rotation: 0,
    };
  }

  return {
    ...style,
    type: 'circle',
    cx: shape.center.x,
    cy: shape.center.y,
    rx: halfW,
    ry: halfH,
    rotation: snapCardinalAngle(shape.angle),
  };
}
