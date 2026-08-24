import { GRID_PX } from './constants';
import type { Point, ViewState } from '../types';

// screen = world * s + t   (same convention as the original app)
export function worldToScreen(p: Point, view: ViewState): Point {
  return { x: p.x * view.s + view.tx, y: p.y * view.s + view.ty };
}

export function screenToWorld(p: Point, view: ViewState): Point {
  return { x: (p.x - view.tx) / view.s, y: (p.y - view.ty) / view.s };
}

// Snap a world-space point to the nearest grid intersection.
export function snapToGrid(p: Point, enabled: boolean): Point {
  if (!enabled) return p;
  return {
    x: Math.round(p.x / GRID_PX) * GRID_PX,
    y: Math.round(p.y / GRID_PX) * GRID_PX,
  };
}

// Convert a metric length (meters) to world px for a given scale (e.g. 1:100)
// and squares-per-meter setting.
export function metersToWorldPx(meters: number, metersPerSquare: number): number {
  return (meters / metersPerSquare) * GRID_PX;
}

export function distance(a: Point, b: Point): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

// Clamp pan so the board can't be dragged infinitely off-screen — mirrors
// the `Math.min(0, tx)` clamp used when restoring a saved view.
export function clampPan(view: ViewState): ViewState {
  return { s: view.s, tx: Math.min(0, view.tx), ty: Math.min(0, view.ty) };
}
