import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type {
  ChecklistItemState,
  DashStyle,
  ErasePath,
  Point,
  ProjectFile,
  ProjectState,
  SketchLayer,
  SketchObject,
  ToolType,
  ViewState,
} from '../types';
import { objectBounds } from '../engine/bounds';
import { GRID_PX } from '../engine/constants';
import { screenToWorld, snapToGrid } from '../engine/geometry';
import { scaleToMetersPerSquare } from '../engine/shapes';
import { transformObject, translateBounds } from '../engine/transform';
import { useHistory } from './useHistory';

const HISTORY_LIMIT = 50;
const DUPLICATE_OFFSET = 24;
const DEFAULT_LAYER_ID = 1;

const DEFAULT_VIEW: ViewState = { s: 1, tx: 0, ty: 0 };
const DEFAULT_PROJECT: ProjectState = {
  projectName: '',
  application: '',
  shopName: '',
  requirement: '',
  north: 0,
  checklist: [],
};

function createDefaultLayer(): SketchLayer {
  return { id: DEFAULT_LAYER_ID, name: 'Layer 1', visible: true, locked: false };
}

type CanvasSnapshot = {
  objects: SketchObject[];
  erasePaths: ErasePath[];
  layers: SketchLayer[];
  activeLayerId: number;
  dimensionObjectIds: number[];
  calibrationMetersPerSquare: number | null;
};

function cloneValue<T>(value: T): T {
  if (typeof structuredClone === 'function') return structuredClone(value);
  return JSON.parse(JSON.stringify(value)) as T;
}

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

function sanitizeLayers(value: unknown): SketchLayer[] {
  if (!Array.isArray(value)) return [createDefaultLayer()];
  const seen = new Set<number>();
  const result: SketchLayer[] = [];

  value.forEach((item, index) => {
    if (!item || typeof item !== 'object') return;
    const source = item as Partial<SketchLayer>;
    const id = Math.max(1, Math.floor(safeNumber(source.id, index + 1)));
    if (seen.has(id)) return;
    seen.add(id);
    result.push({
      id,
      name: safeString(source.name).trim() || `Layer ${index + 1}`,
      visible: source.visible !== false,
      locked: source.locked === true,
    });
  });

  return result.length ? result : [createDefaultLayer()];
}

/**
 * v1 rotated rectangles stored rotated diagonal endpoints plus a rotation value.
 * v2/v3 store an axis-aligned local rectangle and apply rotation while rendering.
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

function nextLayerName(layers: SketchLayer[]): string {
  let index = layers.length + 1;
  const names = new Set(layers.map((layer) => layer.name));
  while (names.has(`Layer ${index}`)) index += 1;
  return `Layer ${index}`;
}

export function useCanvasEngine() {
  const [objects, setObjects] = useState<SketchObject[]>([]);
  const [erasePaths, setErasePaths] = useState<ErasePath[]>([]);
  const [layers, setLayers] = useState<SketchLayer[]>(() => [createDefaultLayer()]);
  const [activeLayerId, setActiveLayerId] = useState(DEFAULT_LAYER_ID);
  const [view, setView] = useState<ViewState>({ ...DEFAULT_VIEW });
  const [project, setProject] = useState<ProjectState>(() => cloneProjectState(DEFAULT_PROJECT));
  const [tool, setTool] = useState<ToolType>('pen');
  const [color, setColor] = useState('#14181D');
  const [lineWidth, setLineWidth] = useState(2);
  const [eraserSize, setEraserSize] = useState(26);
  const [dash, setDash] = useState<DashStyle>('solid');
  const [snapEnabled, setSnapEnabled] = useState(true);
  const [snapLineEnabled, setSnapLineEnabled] = useState(false);
  const [dimEnabled, setDimEnabledState] = useState(false);
  const [dimensionObjectIds, setDimensionObjectIds] = useState<number[]>([]);
  const [gridVisible, setGridVisible] = useState(true);
  const [scale, setScaleState] = useState(100);
  const [calibrationMetersPerSquare, setCalibrationMetersPerSquare] = useState<number | null>(null);
  const canvasViewportRef = useRef({ w: 1000, h: 700 });
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const idCounterRef = useRef(1);
  const layerCounterRef = useRef(DEFAULT_LAYER_ID + 1);
  const selectedStyleEditRef = useRef({ active: false, historyPushed: false });

  useEffect(() => {
    if (!dimensionObjectIds.length) return;
    const existingIds = new Set(objects.map((object) => object.id));
    setDimensionObjectIds((current) => {
      const next = current.filter((id) => existingIds.has(id));
      return next.length === current.length ? current : next;
    });
  }, [dimensionObjectIds.length, objects]);

  const activeLayer = useMemo(
    () => layers.find((layer) => layer.id === activeLayerId) ?? layers[0],
    [activeLayerId, layers],
  );
  const canEditActiveLayer = Boolean(activeLayer && activeLayer.visible && !activeLayer.locked);

  const {
    push: pushSnapshot,
    undo: undoSnapshot,
    redo: redoSnapshot,
    reset: resetHistory,
    canUndo,
    canRedo,
  } = useHistory<CanvasSnapshot>(HISTORY_LIMIT);

  const currentSnapshot = useCallback((): CanvasSnapshot => ({
    objects,
    erasePaths,
    layers,
    activeLayerId,
    dimensionObjectIds,
    calibrationMetersPerSquare,
  }), [activeLayerId, calibrationMetersPerSquare, dimensionObjectIds, erasePaths, layers, objects]);

  const pushHistory = useCallback(() => {
    pushSnapshot(currentSnapshot());
  }, [currentSnapshot, pushSnapshot]);

  const clearSelection = useCallback(() => {
    setSelectedId(null);
    setSelectedIds([]);
  }, []);

  const setDimEnabled = useCallback((enabled: boolean) => {
    setDimEnabledState(enabled);
    if (enabled) clearSelection();
  }, [clearSelection]);

  const toggleDimensionObject = useCallback((id: number) => {
    setDimensionObjectIds((current) => (
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id]
    ));
  }, []);

  const clearDimensions = useCallback(() => setDimensionObjectIds([]), []);

  const applySnapshot = useCallback((snapshot: CanvasSnapshot) => {
    const safeLayers = snapshot.layers.length ? snapshot.layers : [createDefaultLayer()];
    const safeActiveId = safeLayers.some((layer) => layer.id === snapshot.activeLayerId)
      ? snapshot.activeLayerId
      : safeLayers[safeLayers.length - 1].id;
    setObjects(snapshot.objects);
    setErasePaths(snapshot.erasePaths);
    setLayers(safeLayers);
    setActiveLayerId(safeActiveId);
    const restoredIds = new Set(snapshot.objects.map((object) => object.id));
    setDimensionObjectIds(snapshot.dimensionObjectIds.filter((id) => restoredIds.has(id)));
    setCalibrationMetersPerSquare(snapshot.calibrationMetersPerSquare);
    clearSelection();
  }, [clearSelection]);

  const undo = useCallback(() => {
    const previous = undoSnapshot(currentSnapshot());
    if (previous) applySnapshot(previous);
  }, [applySnapshot, currentSnapshot, undoSnapshot]);

  const redo = useCallback(() => {
    const next = redoSnapshot(currentSnapshot());
    if (next) applySnapshot(next);
  }, [applySnapshot, currentSnapshot, redoSnapshot]);

  const nextId = useCallback(() => idCounterRef.current++, []);

  const addObject = useCallback((object: SketchObject) => {
    if (!canEditActiveLayer) return;
    setObjects((current) => [...current, {
      ...object,
      layerId: activeLayerId,
      // New layer system owns visibility/locking. Keep legacy flags neutral.
      visible: true,
      locked: false,
      opacity: Math.max(0, Math.min(1, object.opacity ?? 1)),
    } as SketchObject]);
  }, [activeLayerId, canEditActiveLayer]);

  const activateLayer = useCallback((id: number) => {
    if (!layers.some((layer) => layer.id === id)) return;
    setActiveLayerId(id);
    clearSelection();
  }, [clearSelection, layers]);

  const createLayer = useCallback(() => {
    pushHistory();
    const layer: SketchLayer = {
      id: layerCounterRef.current++,
      name: nextLayerName(layers),
      visible: true,
      locked: false,
    };
    setLayers((current) => [...current, layer]);
    setActiveLayerId(layer.id);
    clearSelection();
  }, [clearSelection, layers, pushHistory]);

  const renameLayer = useCallback((id: number, name: string) => {
    const target = layers.find((layer) => layer.id === id);
    if (!target) return;
    const normalized = name.trim() || target.name;
    if (normalized === target.name) return;
    pushHistory();
    setLayers((current) => current.map((layer) => (
      layer.id === id ? { ...layer, name: normalized } : layer
    )));
  }, [layers, pushHistory]);

  const toggleLayerVisibility = useCallback((id: number) => {
    const target = layers.find((layer) => layer.id === id);
    if (!target) return;
    pushHistory();
    setLayers((current) => current.map((layer) => (
      layer.id === id ? { ...layer, visible: !layer.visible } : layer
    )));
    if (id === activeLayerId) clearSelection();
  }, [activeLayerId, clearSelection, layers, pushHistory]);

  const toggleLayerLock = useCallback((id: number) => {
    const target = layers.find((layer) => layer.id === id);
    if (!target) return;
    pushHistory();
    setLayers((current) => current.map((layer) => (
      layer.id === id ? { ...layer, locked: !layer.locked } : layer
    )));
    if (id === activeLayerId) clearSelection();
  }, [activeLayerId, clearSelection, layers, pushHistory]);

  const moveLayer = useCallback((id: number, direction: 'up' | 'down' | 'front' | 'back') => {
    const index = layers.findIndex((layer) => layer.id === id);
    if (index < 0) return;

    let nextIndex = index;
    if (direction === 'up') nextIndex = Math.min(layers.length - 1, index + 1);
    if (direction === 'down') nextIndex = Math.max(0, index - 1);
    if (direction === 'front') nextIndex = layers.length - 1;
    if (direction === 'back') nextIndex = 0;
    if (nextIndex === index) return;

    pushHistory();
    setLayers((current) => {
      const next = [...current];
      const [layer] = next.splice(index, 1);
      next.splice(nextIndex, 0, layer);
      return next;
    });
  }, [layers, pushHistory]);

  const deleteLayer = useCallback((id: number) => {
    if (layers.length <= 1) return;
    const index = layers.findIndex((layer) => layer.id === id);
    if (index < 0) return;

    pushHistory();
    const remaining = layers.filter((layer) => layer.id !== id);
    const fallbackIndex = Math.min(index, remaining.length - 1);
    const fallbackLayer = remaining[Math.max(0, fallbackIndex)];

    setLayers(remaining);
    const deletedObjectIds = new Set(objects.filter((object) => object.layerId === id).map((object) => object.id));
    setDimensionObjectIds((current) => current.filter((objectId) => !deletedObjectIds.has(objectId)));
    setObjects((current) => current.filter((object) => object.layerId !== id));
    if (activeLayerId === id) setActiveLayerId(fallbackLayer.id);
    clearSelection();
  }, [activeLayerId, clearSelection, layers, objects, pushHistory]);

  const selectObject = useCallback((id: number, additive = false) => {
    if (!canEditActiveLayer) return;
    const object = objects.find((item) => item.id === id);
    if (!object || object.layerId !== activeLayerId || object.visible === false || object.locked === true) return;

    if (!additive) {
      setSelectedId(id);
      setSelectedIds([id]);
      return;
    }

    const exists = selectedIds.includes(id);
    const next = exists ? selectedIds.filter((item) => item !== id) : [...selectedIds, id];
    setSelectedIds(next);
    setSelectedId(exists ? (next[0] ?? null) : id);
  }, [activeLayerId, canEditActiveLayer, objects, selectedIds]);

  const selectAllObjects = useCallback(() => {
    if (!canEditActiveLayer) {
      clearSelection();
      return;
    }
    const ids = objects
      .filter((object) => (
        object.type !== 'erase'
        && object.layerId === activeLayerId
        && object.visible !== false
        && object.locked !== true
      ))
      .map((object) => object.id);
    setSelectedIds(ids);
    setSelectedId(ids[0] ?? null);
  }, [activeLayerId, canEditActiveLayer, clearSelection, objects]);

  const removeObjects = useCallback((ids: number[]) => {
    if (!canEditActiveLayer) return;
    const idSet = new Set(ids);
    const deletableIds = new Set(
      objects
        .filter((object) => (
          idSet.has(object.id)
          && object.layerId === activeLayerId
          && object.locked !== true
        ))
        .map((object) => object.id),
    );
    if (!deletableIds.size) return;

    pushHistory();
    setDimensionObjectIds((current) => current.filter((objectId) => !deletableIds.has(objectId)));
    setObjects((current) => current.filter((object) => !deletableIds.has(object.id)));
    setSelectedIds((current) => current.filter((id) => !deletableIds.has(id)));
    setSelectedId((current) => (current !== null && deletableIds.has(current) ? null : current));
  }, [activeLayerId, canEditActiveLayer, objects, pushHistory]);

  const removeObject = useCallback((id: number) => {
    removeObjects([id]);
  }, [removeObjects]);

  const deleteSelectedObjects = useCallback(() => {
    const ids = selectedIds.length ? selectedIds : selectedId !== null ? [selectedId] : [];
    removeObjects(ids);
  }, [removeObjects, selectedId, selectedIds]);

  const clearAll = useCallback(() => {
    if (!objects.length && !erasePaths.length) return;
    pushHistory();
    setObjects([]);
    setErasePaths([]);
    setDimensionObjectIds([]);
    clearSelection();
  }, [clearSelection, erasePaths.length, objects.length, pushHistory]);

  const duplicateObjects = useCallback((ids: number[]) => {
    if (!canEditActiveLayer) return;
    const idSet = new Set(ids);
    const source = objects.filter((object) => (
      idSet.has(object.id)
      && object.type !== 'erase'
      && object.layerId === activeLayerId
    ));
    if (!source.length) return;

    pushHistory();
    const copies = source.map((object) => {
      const cloned = cloneValue(object);
      const bounds = objectBounds(cloned);
      const moved = transformObject(
        cloned,
        bounds,
        translateBounds(bounds, DUPLICATE_OFFSET, DUPLICATE_OFFSET),
      );
      return {
        ...moved,
        id: idCounterRef.current++,
        layerId: activeLayerId,
      } as SketchObject;
    });

    setObjects((current) => [...current, ...copies]);
    const copyIds = copies.map((object) => object.id);
    setSelectedIds(copyIds);
    setSelectedId(copyIds[0] ?? null);
  }, [activeLayerId, canEditActiveLayer, objects, pushHistory]);

  const duplicateSelectedObjects = useCallback(() => {
    const ids = selectedIds.length ? selectedIds : selectedId !== null ? [selectedId] : [];
    duplicateObjects(ids);
  }, [duplicateObjects, selectedId, selectedIds]);

  const selectedObjectIds = useMemo(() => {
    const ids = selectedIds.length ? selectedIds : selectedId !== null ? [selectedId] : [];
    return ids.filter((id) => objects.some((object) => (
      object.id === id
      && object.layerId === activeLayerId
      && object.type !== 'erase'
      && object.locked !== true
    )));
  }, [activeLayerId, objects, selectedId, selectedIds]);

  const beginSelectedStyleEdit = useCallback(() => {
    selectedStyleEditRef.current = { active: true, historyPushed: false };
  }, []);

  const endSelectedStyleEdit = useCallback(() => {
    selectedStyleEditRef.current = { active: false, historyPushed: false };
  }, []);

  const updateSelectedOpacity = useCallback((transparencyPercent: number) => {
    if (!selectedObjectIds.length || !canEditActiveLayer) return;
    const transparency = Math.max(0, Math.min(100, Number(transparencyPercent) || 0));
    const opacity = 1 - transparency / 100;
    const ids = new Set(selectedObjectIds);
    const changed = objects.some((object) => ids.has(object.id) && Math.abs((object.opacity ?? 1) - opacity) > 0.0001);
    if (!changed) return;

    if (!selectedStyleEditRef.current.historyPushed) {
      pushHistory();
      selectedStyleEditRef.current.historyPushed = true;
    }
    setObjects((current) => current.map((object) => (
      ids.has(object.id) ? { ...object, opacity } : object
    )));
  }, [canEditActiveLayer, objects, pushHistory, selectedObjectIds]);

  const metersPerSquare = calibrationMetersPerSquare ?? scaleToMetersPerSquare(scale);
  const isCalibrated = calibrationMetersPerSquare !== null;

  const setScale = useCallback((value: number) => {
    setScaleState(Math.max(1, Number(value) || 100));
    setCalibrationMetersPerSquare(null);
  }, []);

  const applyCalibration = useCallback((worldDistance: number, realMeters: number) => {
    if (!Number.isFinite(worldDistance) || worldDistance <= 0 || !Number.isFinite(realMeters) || realMeters <= 0) return;
    pushHistory();
    setCalibrationMetersPerSquare(realMeters / (worldDistance / GRID_PX));
  }, [pushHistory]);

  const clearCalibration = useCallback(() => {
    if (calibrationMetersPerSquare === null) return;
    pushHistory();
    setCalibrationMetersPerSquare(null);
  }, [calibrationMetersPerSquare, pushHistory]);

  const setCanvasViewportSize = useCallback((w: number, h: number) => {
    canvasViewportRef.current = { w: Math.max(1, w), h: Math.max(1, h) };
  }, []);

  const viewportCenterWorld = useCallback((): Point => {
    const size = canvasViewportRef.current;
    return screenToWorld({ x: size.w / 2, y: size.h / 2 }, view);
  }, [view]);

  const importImage = useCallback((src: string, naturalWidth: number, naturalHeight: number) => {
    if (!canEditActiveLayer || !src || naturalWidth <= 0 || naturalHeight <= 0) return;
    const size = canvasViewportRef.current;
    const maxWidth = Math.max(120, size.w / Math.max(view.s, 0.001) * 0.72);
    const maxHeight = Math.max(120, size.h / Math.max(view.s, 0.001) * 0.72);
    const fit = Math.min(1, maxWidth / naturalWidth, maxHeight / naturalHeight);
    const width = naturalWidth * fit;
    const height = naturalHeight * fit;
    const center = viewportCenterWorld();
    pushHistory();
    const object: SketchObject = {
      id: idCounterRef.current++, layerId: activeLayerId, type: 'image',
      x1: center.x - width / 2, y1: center.y - height / 2,
      x2: center.x + width / 2, y2: center.y + height / 2,
      src, color: '#14181D', width: 1, dash: 'solid', opacity: 1, visible: true, locked: false,
    };
    setObjects((current) => [...current, object]);
    setSelectedId(object.id);
    setSelectedIds([object.id]);
  }, [activeLayerId, canEditActiveLayer, pushHistory, view.s, viewportCenterWorld]);

  const createAutoRectangle = useCallback((widthMeters: number, heightMeters: number) => {
    if (!canEditActiveLayer || widthMeters <= 0 || heightMeters <= 0) return;
    const widthWorld = (widthMeters / metersPerSquare) * GRID_PX;
    const heightWorld = (heightMeters / metersPerSquare) * GRID_PX;
    const center = viewportCenterWorld();
    pushHistory();
    const object: SketchObject = {
      id: idCounterRef.current++, layerId: activeLayerId, type: 'rect',
      x1: center.x - widthWorld / 2, y1: center.y - heightWorld / 2,
      x2: center.x + widthWorld / 2, y2: center.y + heightWorld / 2,
      color, width: lineWidth, dash, opacity: 1, visible: true, locked: false,
    };
    setObjects((current) => [...current, object]);
    setSelectedId(object.id);
    setSelectedIds([object.id]);
  }, [activeLayerId, canEditActiveLayer, color, dash, lineWidth, metersPerSquare, pushHistory, viewportCenterWorld]);

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
    resetHistory();
    idCounterRef.current = 1;
    layerCounterRef.current = DEFAULT_LAYER_ID + 1;
    const initialLayer = createDefaultLayer();
    setObjects([]);
    setErasePaths([]);
    setLayers([initialLayer]);
    setActiveLayerId(initialLayer.id);
    setView({ ...DEFAULT_VIEW });
    setProject(cloneProjectState(DEFAULT_PROJECT));
    setScaleState(100);
    setCalibrationMetersPerSquare(null);
    setDimensionObjectIds([]);
    clearSelection();
  }, [clearSelection, resetHistory]);

  const exportProject = useCallback((): ProjectFile => ({
    app: 'StoreSketch',
    version: 4,
    meta: {
      ...cloneProjectState(project),
      scale: String(scale),
      view: { ...view },
      metersPerSquare: calibrationMetersPerSquare ?? undefined,
    },
    objects: cloneValue(objects),
    layers: cloneValue(layers),
    activeLayerId,
    dimensionObjectIds: [...dimensionObjectIds],
  }), [activeLayerId, calibrationMetersPerSquare, dimensionObjectIds, layers, objects, project, scale, view]);

  const loadProject = useCallback((raw: unknown) => {
    const data = validateProjectFile(raw);
    const version = data.version === 4 ? 4 : data.version === 3 ? 3 : data.version === 2 ? 2 : 1;
    const loadedLayers = version >= 3 ? sanitizeLayers(data.layers) : [createDefaultLayer()];
    const layerIds = new Set(loadedLayers.map((layer) => layer.id));
    const fallbackLayerId = loadedLayers[loadedLayers.length - 1].id;

    const loadedObjects = (data.objects as SketchObject[]).map((source) => {
      const migrated = version === 1 ? migrateV1Object({ ...source }) : { ...source };
      const requestedLayerId = version >= 3 ? migrated.layerId : fallbackLayerId;
      return {
        ...migrated,
        layerId: requestedLayerId && layerIds.has(requestedLayerId) ? requestedLayerId : fallbackLayerId,
        // v1/v2 used per-object visibility/lock as pseudo-layers. v3 moves those controls to real layers.
        visible: true,
        locked: false,
        opacity: Math.max(0, Math.min(1, safeNumber(migrated.opacity, 1))),
      } as SketchObject;
    });

    const maxObjectId = loadedObjects.reduce((max, object) => (
      Number.isFinite(object.id) ? Math.max(max, object.id) : max
    ), 0);
    const maxLayerId = loadedLayers.reduce((max, layer) => Math.max(max, layer.id), 0);
    const requestedActiveLayerId = version >= 3 ? safeNumber(data.activeLayerId, fallbackLayerId) : fallbackLayerId;
    const nextActiveLayerId = layerIds.has(requestedActiveLayerId) ? requestedActiveLayerId : fallbackLayerId;

    idCounterRef.current = maxObjectId + 1;
    layerCounterRef.current = maxLayerId + 1;
    resetHistory();

    const meta = data.meta ?? ({} as ProjectFile['meta']);
    setObjects(loadedObjects);
    setErasePaths([]);
    setLayers(loadedLayers);
    setActiveLayerId(nextActiveLayerId);
    setView(sanitizeView(meta.view));
    setScaleState(Math.max(1, safeNumber(meta.scale, 100)));
    const loadedCalibration = safeNumber(meta.metersPerSquare, 0);
    setCalibrationMetersPerSquare(version >= 4 && loadedCalibration > 0 ? loadedCalibration : null);
    setProject({
      projectName: safeString(meta.projectName),
      application: safeString(meta.application),
      shopName: safeString(meta.shopName),
      requirement: safeString(meta.requirement),
      north: safeNumber(meta.north, 0),
      checklist: sanitizeChecklist(meta.checklist),
    });
    const existingIds = new Set(loadedObjects.map((object) => object.id));
    setDimensionObjectIds(Array.isArray(data.dimensionObjectIds)
      ? data.dimensionObjectIds.filter((id): id is number => Number.isFinite(id) && existingIds.has(id))
      : []);
    clearSelection();
  }, [clearSelection, resetHistory]);

  const pointerToWorldRaw = useCallback(
    (screenPt: Point): Point => screenToWorld(screenPt, view),
    [view],
  );

  const pointerToWorld = useCallback(
    (screenPt: Point): Point => snapToGrid(pointerToWorldRaw(screenPt), snapEnabled),
    [pointerToWorldRaw, snapEnabled],
  );

  return {
    objects, setObjects, erasePaths, setErasePaths,
    layers, activeLayerId, activeLayer, canEditActiveLayer,
    activateLayer, createLayer, renameLayer, toggleLayerVisibility, toggleLayerLock, moveLayer, deleteLayer,
    view, setView,
    project, updateProject, setChecklistDone,
    tool, setTool,
    color, setColor,
    lineWidth, setLineWidth,
    eraserSize, setEraserSize,
    dash, setDash,
    snapEnabled, setSnapEnabled,
    snapLineEnabled, setSnapLineEnabled,
    dimEnabled, setDimEnabled, dimensionObjectIds, toggleDimensionObject, clearDimensions,
    gridVisible, setGridVisible,
    scale, setScale, metersPerSquare, isCalibrated, calibrationMetersPerSquare, applyCalibration, clearCalibration,
    selectedId, setSelectedId, selectedIds, setSelectedIds,
    selectObject, selectAllObjects, clearSelection,
    selectedObjectIds, beginSelectedStyleEdit, endSelectedStyleEdit, updateSelectedOpacity,
    pushHistory, undo, redo, canUndo, canRedo,
    nextId, addObject, removeObject, removeObjects, deleteSelectedObjects,
    duplicateObjects, duplicateSelectedObjects,
    clearAll, newProject,
    exportProject, loadProject,
    importImage, createAutoRectangle, setCanvasViewportSize,
    pointerToWorld, pointerToWorldRaw,
  };
}
