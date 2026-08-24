// src/hooks/useCanvasEngine.ts
import { useCallback, useRef, useState } from 'react';
import type {
  ChecklistItemState,
  DashStyle,
  ErasePath,
  Point,
  ProjectFile,
  ProjectState,
  SketchObject,
  ToolType,
  ViewState,
} from '../types';
import { screenToWorld, snapToGrid } from '../engine/geometry';

const HISTORY_LIMIT = 50;

const DEFAULT_VIEW: ViewState = { s: 1, tx: 0, ty: 0 };
const DEFAULT_PROJECT: ProjectState = {
  projectName: '',
  application: '',
  shopName: '',
  requirement: '',
  north: 0,
  checklist: [],
};

function cloneProjectState(project: ProjectState): ProjectState {
  return {
    ...project,
    checklist: project.checklist.map((item) => ({
      done: item.done,
      inputs: { ...item.inputs },
      opts: { ...item.opts },
    })),
  };
}

function emptyChecklistItem(): ChecklistItemState {
  return { done: false, inputs: {}, opts: {} };
}

function safeString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function safeNumber(value: unknown, fallback: number): number {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function sanitizeView(value: unknown): ViewState {
  if (!value || typeof value !== 'object') return { ...DEFAULT_VIEW };
  const view = value as Partial<ViewState>;
  return {
    s: Math.max(0.2, Math.min(5, safeNumber(view.s, 1))),
    tx: safeNumber(view.tx, 0),
    ty: safeNumber(view.ty, 0),
  };
}

function sanitizeChecklist(value: unknown): ChecklistItemState[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => {
    if (!item || typeof item !== 'object') return emptyChecklistItem();
    const source = item as Partial<ChecklistItemState>;
    return {
      done: source.done === true,
      inputs: source.inputs && typeof source.inputs === 'object' ? { ...source.inputs } : {},
      opts: source.opts && typeof source.opts === 'object' ? { ...source.opts } : {},
    };
  });
}

/**
 * v1 rotated rectangles stored rotated diagonal endpoints plus a rotation value.
 * v2 stores an axis-aligned local rectangle and applies rotation only while rendering.
 * This converts old rectangles so opening a v1 file does not double-rotate them.
 */
function migrateV1Object(object: SketchObject): SketchObject {
  if (
    object.type !== 'rect'
    || !object.rotation
    || object.x1 === undefined
    || object.y1 === undefined
    || object.x2 === undefined
    || object.y2 === undefined
  ) {
    return object;
  }

  const rotation = object.rotation;
  const center = {
    x: (object.x1 + object.x2) / 2,
    y: (object.y1 + object.y2) / 2,
  };
  const dx = object.x2 - object.x1;
  const dy = object.y2 - object.y1;
  const cos = Math.cos(rotation);
  const sin = Math.sin(rotation);

  // Rotate the stored diagonal back into the rectangle's local coordinate system.
  const localDx = dx * cos + dy * sin;
  const localDy = -dx * sin + dy * cos;
  const width = Math.abs(localDx);
  const height = Math.abs(localDy);

  return {
    ...object,
    x1: center.x - width / 2,
    y1: center.y - height / 2,
    x2: center.x + width / 2,
    y2: center.y + height / 2,
  };
}

function validateProjectFile(value: unknown): ProjectFile {
  if (!value || typeof value !== 'object') throw new Error('Invalid project file');
  const file = value as Partial<ProjectFile>;
  if (file.app !== 'StoreSketch' || !Array.isArray(file.objects)) {
    throw new Error('Invalid StoreSketch project');
  }
  return file as ProjectFile;
}

export function useCanvasEngine() {
  const [objects, setObjects] = useState<SketchObject[]>([]);
  const [erasePaths, setErasePaths] = useState<ErasePath[]>([]);
  const [view, setView] = useState<ViewState>({ ...DEFAULT_VIEW });
  const [project, setProject] = useState<ProjectState>(() => cloneProjectState(DEFAULT_PROJECT));
  const [tool, setTool] = useState<ToolType>('pen');
  const [color, setColor] = useState('#14181D');
  const [lineWidth, setLineWidth] = useState(2);
  const [eraserSize, setEraserSize] = useState(26);
  const [dash, setDash] = useState<DashStyle>('solid');
  const [snapEnabled, setSnapEnabled] = useState(true);
  const [gridVisible, setGridVisible] = useState(true);
  const [scale, setScale] = useState(100);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);

  const historyRef = useRef<{ objects: SketchObject[]; erasePaths: ErasePath[] }[]>([]);
  const redoRef = useRef<{ objects: SketchObject[]; erasePaths: ErasePath[] }[]>([]);
  const idCounterRef = useRef(1);

  const pushHistory = useCallback(() => {
    historyRef.current.push(JSON.parse(JSON.stringify({ objects, erasePaths })));
    if (historyRef.current.length > HISTORY_LIMIT) historyRef.current.shift();
    redoRef.current = [];
  }, [objects, erasePaths]);

  const undo = useCallback(() => {
    const prev = historyRef.current.pop();
    if (!prev) return;
    redoRef.current.push(JSON.parse(JSON.stringify({ objects, erasePaths })));
    setObjects(prev.objects);
    setErasePaths(prev.erasePaths);
  }, [objects, erasePaths]);

  const redo = useCallback(() => {
    const next = redoRef.current.pop();
    if (!next) return;
    historyRef.current.push(JSON.parse(JSON.stringify({ objects, erasePaths })));
    setObjects(next.objects);
    setErasePaths(next.erasePaths);
  }, [objects, erasePaths]);

  const nextId = useCallback(() => idCounterRef.current++, []);

  const addObject = useCallback((obj: SketchObject) => {
    setObjects((prev) => [...prev, obj]);
  }, []);

  const removeObject = useCallback((id: number) => {
    pushHistory();
    setObjects((prev) => prev.filter((obj) => obj.id !== id));
    setSelectedId((prev) => (prev === id ? null : prev));
    setSelectedIds((prev) => prev.filter((i) => i !== id));
  }, [pushHistory]);

  const clearAll = useCallback(() => {
    pushHistory();
    setObjects([]);
    setErasePaths([]);
    setSelectedId(null);
    setSelectedIds([]);
  }, [pushHistory]);

  const updateProject = useCallback((patch: Partial<ProjectState>) => {
    setProject((current) => ({ ...current, ...patch }));
  }, []);

  const setChecklistDone = useCallback((index: number, done: boolean) => {
    setProject((current) => {
      const checklist = current.checklist.map((item) => ({
        done: item.done,
        inputs: { ...item.inputs },
        opts: { ...item.opts },
      }));
      while (checklist.length <= index) checklist.push(emptyChecklistItem());
      checklist[index] = { ...checklist[index], done };
      return { ...current, checklist };
    });
  }, []);

  const newProject = useCallback(() => {
    historyRef.current = [];
    redoRef.current = [];
    idCounterRef.current = 1;
    setObjects([]);
    setErasePaths([]);
    setView({ ...DEFAULT_VIEW });
    setProject(cloneProjectState(DEFAULT_PROJECT));
    setScale(100);
    setSelectedId(null);
    setSelectedIds([]);
  }, []);

  const exportProject = useCallback((): ProjectFile => ({
    app: 'StoreSketch',
    version: 2,
    meta: {
      ...cloneProjectState(project),
      scale: String(scale),
      view: { ...view },
    },
    objects: JSON.parse(JSON.stringify(objects)) as SketchObject[],
  }), [objects, project, scale, view]);

  const loadProject = useCallback((raw: unknown) => {
    const data = validateProjectFile(raw);
    const version = data.version === 2 ? 2 : 1;
    const loadedObjects = (data.objects as SketchObject[]).map((object) => (
      version === 1 ? migrateV1Object({ ...object }) : { ...object }
    ));

    const maxObjectId = loadedObjects.reduce((max, object) => (
      Number.isFinite(object.id) ? Math.max(max, object.id) : max
    ), 0);

    // P0.1: the next object must never reuse an ID from the opened project.
    idCounterRef.current = maxObjectId + 1;

    // Opening a file starts a new editing history.
    historyRef.current = [];
    redoRef.current = [];

    const meta = data.meta ?? ({} as ProjectFile['meta']);
    setObjects(loadedObjects);
    setErasePaths([]);
    setView(sanitizeView(meta.view));
    setScale(Math.max(1, safeNumber(meta.scale, 100)));
    setProject({
      projectName: safeString(meta.projectName),
      application: safeString(meta.application),
      shopName: safeString(meta.shopName),
      requirement: safeString(meta.requirement),
      north: safeNumber(meta.north, 0),
      checklist: sanitizeChecklist(meta.checklist),
    });
    setSelectedId(null);
    setSelectedIds([]);
  }, []);

  const pointerToWorld = useCallback(
    (screenPt: Point): Point => snapToGrid(screenToWorld(screenPt, view), snapEnabled),
    [view, snapEnabled],
  );

  return {
    objects, setObjects, erasePaths, setErasePaths,
    view, setView,
    project, updateProject, setChecklistDone,
    tool, setTool,
    color, setColor,
    lineWidth, setLineWidth,
    eraserSize, setEraserSize,
    dash, setDash,
    snapEnabled, setSnapEnabled,
    gridVisible, setGridVisible,
    scale, setScale,
    selectedId, setSelectedId, selectedIds, setSelectedIds,
    pushHistory, undo, redo,
    nextId, addObject, removeObject, clearAll, newProject,
    exportProject, loadProject,
    pointerToWorld,
    canUndo: historyRef.current.length > 0,
    canRedo: redoRef.current.length > 0,
  };
}
