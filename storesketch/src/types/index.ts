// ===== Core domain types =====

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

export interface BaseSketchObject {
  id: number;
  color: string;
  width: number;
  dash: DashStyle;
  visible?: boolean;
  locked?: boolean;
  name?: string;
  /** Rotation in radians. Only intrinsic-box objects normally use this directly. */
  rotation?: number;
}

export interface StrokeObject extends BaseSketchObject {
  type: 'stroke';
  points: Point[];
  /** Remaining pieces after partial erasing. */
  segments?: Point[][];
}

/** Legacy object type kept so old project files can still be opened. */
export interface EraseObject extends BaseSketchObject {
  type: 'erase';
  points?: Point[];
  segments?: Point[][];
}

export interface LineObject extends BaseSketchObject {
  type: 'line';
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface RectObject extends BaseSketchObject {
  type: 'rect';
  /** Axis-aligned local box. rotation is applied around its center. */
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface CircleObject extends BaseSketchObject {
  type: 'circle';
  cx: number;
  cy: number;
  /** Legacy radius. New objects use rx/ry. */
  r?: number;
  rx?: number;
  ry?: number;
}

export interface PolyObject extends BaseSketchObject {
  type: 'poly';
  points: Point[];
  /** Remaining pieces after partial erasing. */
  segments?: Point[][];
}

export interface CurveObject extends BaseSketchObject {
  type: 'curve';
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  controlX: number;
  controlY: number;
}

export interface MeasureObject extends BaseSketchObject {
  type: 'measure';
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface TextObject extends BaseSketchObject {
  type: 'text';
  x1: number;
  y1: number;
  text: string;
  fontSize: number;
}

export interface ImageObject extends BaseSketchObject {
  type: 'image';
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  src?: string;
}

/**
 * Discriminated union: after checking object.type, TypeScript knows
 * which geometry fields are available and prevents invalid field access.
 */
export type SketchObject =
  | StrokeObject
  | EraseObject
  | LineObject
  | RectObject
  | CircleObject
  | PolyObject
  | CurveObject
  | MeasureObject
  | TextObject
  | ImageObject;

export type SketchObjectStyle = Pick<BaseSketchObject, 'id' | 'color' | 'width' | 'dash'>
  & Pick<Partial<BaseSketchObject>, 'visible' | 'locked' | 'name' | 'rotation'>;

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
