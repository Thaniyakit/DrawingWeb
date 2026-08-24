// ===== Core domain types, ported from the vanilla-JS object model =====

export type ToolType =
  | 'select'
  | 'multi'
  | 'pen'
  | 'auto'
  | 'line'
  | 'rect'
  | 'circle'
  | 'poly'
  | 'curve'
  | 'measure'
  | 'calib'
  | 'text'
  | 'eraser'
  | 'objeraser';

export type DashStyle = 'solid' | 'dash' | 'dot' | 'dashdot';

export const DASH_PATTERNS: Record<DashStyle, number[]> = {
  solid: [],
  dash: [12, 7],
  dot: [2, 6],
  dashdot: [14, 6, 2, 6],
};

export interface Point {
  x: number;
  y: number;
}

export interface ErasePath {
  width: number;
  points: Point[];
  maxObjectId?: number;
}

export interface SketchObject {
  id: number;
  type: 'stroke' | 'erase' | 'line' | 'rect' | 'circle' | 'poly' | 'curve' | 'measure' | 'text' | 'image';
  color: string;
  width: number;
  dash: DashStyle;
  points?: Point[];
  segments?: Point[][];
  x1?: number;
  y1?: number;
  x2?: number;
  y2?: number;
  cx?: number;
  cy?: number;
  r?: number;
  rx?: number;
  ry?: number;
  controlX?: number;
  controlY?: number;
  text?: string;
  fontSize?: number;
  /** Rotation in radians for shapes that keep an intrinsic local box. */
  rotation?: number;
  visible?: boolean;
  locked?: boolean;
  name?: string;
}

export interface ViewState {
  s: number;
  tx: number;
  ty: number;
}

export interface ChecklistItemState {
  done: boolean;
  inputs: Record<string, string>;
  opts: Record<string, boolean>;
}

export interface ProjectState {
  projectName: string;
  application: string;
  shopName: string;
  requirement: string;
  north: number;
  checklist: ChecklistItemState[];
}

export interface ProjectMeta extends ProjectState {
  // Kept as a string in the file format for backward compatibility with v1.
  scale: string;
  view: ViewState;
}

export interface ProjectFile {
  app: 'StoreSketch';
  /** v1 = original format, v2 = centralized project state + fixed rotation model. */
  version: 1 | 2;
  meta: ProjectMeta;
  objects: SketchObject[];
}
