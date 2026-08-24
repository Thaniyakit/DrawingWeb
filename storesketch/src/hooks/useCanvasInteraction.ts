import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type WheelEvent as ReactWheelEvent } from 'react';
import type { Point, SketchObject, SketchObjectStyle, TextObject, ToolType } from '../types';
import { containsBounds, containsPoint, groupBounds, normalizeBounds, objectBounds } from '../engine/bounds';
import { cutObjectsWithEraser } from '../engine/eraser';
import { hitTestObject, hitTestObjects } from '../engine/hitTest';
import { recognizeAutoShape } from '../engine/recognizeShape';
import { buildDragShape, type DragShapeTool } from '../engine/shapes';
import {
  editObject,
  findHandle,
  nearCurveControl,
  nearRotateHandle,
  resizeBounds,
  rotateObject,
  transformObject,
  translateBounds,
  type EditState,
  type MultiEditState,
} from '../engine/transform';
import type { useCanvasEngine } from './useCanvasEngine';

type Engine = ReturnType<typeof useCanvasEngine>;
type DrawingTool = 'pen' | 'auto' | 'eraser' | DragShapeTool;

export type DraftingState = {
  tool: DrawingTool;
  start: Point;
  points: Point[];
};

export type MultiBox = { start: Point; end: Point };
export type TextDialogState = { point: Point; objectId: number | null; text: string; fontSize: number };
type CanvasRef = { current: HTMLCanvasElement | null };

function isDragShapeTool(tool: ToolType): tool is DragShapeTool {
  return tool === 'line' || tool === 'rect' || tool === 'circle' || tool === 'curve' || tool === 'measure';
}

export function useCanvasInteraction(engine: Engine, drawRef: CanvasRef) {
  const {
    objects,
    setObjects,
    layers,
    view,
    tool,
    color,
    lineWidth,
    dash,
    activeLayerId,
    canEditActiveLayer,
    selectedId,
    setSelectedId,
    selectedIds,
    setSelectedIds,
    pointerToWorld,
    pointerToWorldRaw,
    snapLineEnabled,
    dimEnabled,
    toggleDimensionObject,
    applyCalibration,
    pushHistory,
    addObject,
    nextId,
    setView,
    eraserSize,
    setErasePaths,
    clearSelection,
  } = engine;

  const editableObjects = canEditActiveLayer
    ? objects.filter((object) => (
      object.layerId === activeLayerId
      && object.type !== 'erase'
      && object.visible !== false
      && object.locked !== true
    ))
    : [];

  // Used by Dim only. Keep the same bottom -> top order as rendering, then
  // hitTestObjects() reverses it so the visually topmost object wins.
  const visibleObjects = layers.flatMap((layer) => (
    layer.visible
      ? objects.filter((object) => (
        object.layerId === layer.id
        && object.type !== 'erase'
        && object.visible !== false
      ))
      : []
  ));

  const drafting = useRef<DraftingState | null>(null);
  const panStart = useRef<{ x: number; y: number; tx: number; ty: number } | null>(null);
  const multiStart = useRef<Point | null>(null);
  const [multiBox, setMultiBox] = useState<MultiBox | null>(null);
  const [polyPoints, setPolyPoints] = useState<Point[]>([]);
  const [draftVersion, setDraftVersion] = useState(0);
  const [penSnapClosing, setPenSnapClosing] = useState(false);
  const penSnapClosingRef = useRef(false);
  const [textDialog, setTextDialog] = useState<TextDialogState | null>(null);
  const [calibrationPoints, setCalibrationPoints] = useState<Point[]>([]);
  const [calibrationHover, setCalibrationHover] = useState<Point | null>(null);
  const [calibrationDialog, setCalibrationDialog] = useState<{ worldDistance: number } | null>(null);
  const edit = useRef<EditState | null>(null);
  const multiEdit = useRef<MultiEditState | null>(null);
  const editPoint = useRef<Point | null>(null);
  const editFrame = useRef<number | null>(null);
  const draftHistoryPushed = useRef(false);
  const editHistoryPushed = useRef(false);
  const multiEditHistoryPushed = useRef(false);

  useEffect(() => () => {
    if (editFrame.current !== null) cancelAnimationFrame(editFrame.current);
  }, []);

  useEffect(() => {
    if (tool !== 'calib') {
      setCalibrationPoints([]);
      setCalibrationHover(null);
      setCalibrationDialog(null);
    }
  }, [tool]);

  // Switching/locking/hiding a layer must cancel any in-progress operation from the old layer.
  useEffect(() => {
    drafting.current = null;
    edit.current = null;
    multiEdit.current = null;
    multiStart.current = null;
    setMultiBox(null);
    setPolyPoints([]);
    penSnapClosingRef.current = false;
    setPenSnapClosing(false);
    setTextDialog(null);
    setCalibrationPoints([]);
    setCalibrationHover(null);
    setCalibrationDialog(null);
    setDraftVersion((value) => value + 1);
  }, [activeLayerId, canEditActiveLayer, dimEnabled]);

  function getPos(e: ReactPointerEvent): Point {
    const rect = drawRef.current!.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function baseStyle(): SketchObjectStyle {
    return {
      id: nextId(),
      layerId: activeLayerId,
      color,
      width: lineWidth,
      dash,
      visible: true,
      locked: false,
    };
  }

  function onPointerDown(e: ReactPointerEvent) {
    (e.target as Element).setPointerCapture(e.pointerId);
    const screen = getPos(e);
    const rawWorld = pointerToWorldRaw(screen);
    const snappedWorld = pointerToWorld(screen);
    const tolerance = 8 / view.s;

    if (e.button === 1 || (e.button === 0 && e.shiftKey)) {
      panStart.current = { x: e.clientX, y: e.clientY, tx: view.tx, ty: view.ty };
      return;
    }

    if (tool === 'calib') {
      if (calibrationDialog) return;
      if (calibrationPoints.length === 0) {
        setCalibrationPoints([rawWorld]);
        setCalibrationHover(rawWorld);
      } else {
        const first = calibrationPoints[0];
        const worldDistance = Math.hypot(rawWorld.x - first.x, rawWorld.y - first.y);
        if (worldDistance > 0.001) {
          setCalibrationPoints([first, rawWorld]);
          setCalibrationHover(null);
          setCalibrationDialog({ worldDistance });
        }
      }
      clearSelection();
      return;
    }

    if (dimEnabled) {
      const hit = hitTestObjects(visibleObjects, rawWorld, tolerance);
      if (hit) toggleDimensionObject(hit.id);
      clearSelection();
      return;
    }

    if (!canEditActiveLayer) {
      clearSelection();
      return;
    }

    if (tool === 'objeraser') {
      const hit = hitTestObjects(editableObjects, rawWorld, tolerance);
      if (hit) engine.removeObject(hit.id);
      return;
    }

    if (tool === 'eraser' || tool === 'pen' || tool === 'auto') {
      draftHistoryPushed.current = false;
      penSnapClosingRef.current = false;
      setPenSnapClosing(false);
      const startPoint = tool === 'pen' ? snappedWorld : rawWorld;
      drafting.current = { tool, start: startPoint, points: [startPoint] };
      return;
    }

    if (tool === 'poly') {
      setPolyPoints((current) => [...current, snappedWorld]);
      return;
    }

    if (tool === 'text') {
      const existing = [...editableObjects].reverse().find((object): object is TextObject => (
        object.type === 'text' && hitTestObject(object, rawWorld, tolerance)
      ));
      setTextDialog({
        point: existing ? { x: existing.x1, y: existing.y1 } : snappedWorld,
        objectId: existing?.id ?? null,
        text: existing?.text ?? '',
        fontSize: existing?.fontSize ?? 80,
      });
      return;
    }

    if (tool === 'select') {
      const selected = editableObjects.find((object) => object.id === selectedId);
      if (selected) {
        const bounds = objectBounds(selected);
        const handle = findHandle(rawWorld, bounds, view);
        if (selected.type === 'curve' && nearCurveControl(rawWorld, selected, view)) {
          editHistoryPushed.current = false;
          edit.current = { mode: 'curve', start: rawWorld, initial: selected, bounds };
          return;
        }
        if (nearRotateHandle(rawWorld, bounds, view)) {
          editHistoryPushed.current = false;
          edit.current = { mode: 'rotate', start: rawWorld, initial: selected, bounds };
          return;
        }
        if (handle || containsPoint(bounds, rawWorld)) {
          editHistoryPushed.current = false;
          edit.current = {
            mode: handle ? 'resize' : 'move',
            handle: handle ?? undefined,
            start: rawWorld,
            initial: selected,
            bounds,
          };
          return;
        }
      }

      const hit = hitTestObjects(editableObjects, rawWorld, tolerance);
      setSelectedId(hit?.id ?? null);
      setSelectedIds(hit ? [hit.id] : []);
      return;
    }

    if (tool === 'multi') {
      const selectedObjects = editableObjects.filter((object) => selectedIds.includes(object.id));
      const selectedBounds = selectedObjects.length ? groupBounds(selectedObjects) : null;
      const handle = selectedBounds ? findHandle(rawWorld, selectedBounds, view) : null;
      const onRotate = selectedBounds ? nearRotateHandle(rawWorld, selectedBounds, view) : false;
      const insideSelectedFrame = selectedBounds ? containsPoint(selectedBounds, rawWorld) : false;

      if (selectedBounds && (handle || onRotate || insideSelectedFrame)) {
        multiEditHistoryPushed.current = false;
        multiEdit.current = {
          mode: onRotate ? 'rotate' : handle ? 'resize' : 'move',
          handle: handle ?? undefined,
          start: rawWorld,
          initial: selectedObjects,
          bounds: selectedBounds,
        };
      } else {
        multiStart.current = rawWorld;
        setMultiBox({ start: rawWorld, end: rawWorld });
        clearSelection();
      }
      return;
    }

    if (isDragShapeTool(tool)) {
      draftHistoryPushed.current = false;
      drafting.current = { tool, start: snappedWorld, points: [snappedWorld] };
    }
  }

  function onPointerMove(e: ReactPointerEvent) {
    if (panStart.current) {
      setView((current) => ({
        ...current,
        tx: panStart.current!.tx + e.clientX - panStart.current!.x,
        ty: panStart.current!.ty + e.clientY - panStart.current!.y,
      }));
      return;
    }

    const screen = getPos(e);
    const rawWorld = pointerToWorldRaw(screen);

    if (tool === 'calib' && calibrationPoints.length === 1 && !calibrationDialog) {
      setCalibrationHover(rawWorld);
      return;
    }

    if (multiStart.current) {
      setMultiBox({ start: multiStart.current, end: rawWorld });
      return;
    }
    if (edit.current) {
      if (!editHistoryPushed.current) {
        pushHistory();
        editHistoryPushed.current = true;
      }
      editPoint.current = rawWorld;
      scheduleEditFrame();
      return;
    }
    if (multiEdit.current) {
      if (!multiEditHistoryPushed.current) {
        pushHistory();
        multiEditHistoryPushed.current = true;
      }
      editPoint.current = rawWorld;
      scheduleEditFrame();
      return;
    }
    if (!drafting.current || !canEditActiveLayer) return;

    const draftingTool = drafting.current.tool;
    if (draftingTool === 'pen') {
      // Lock Point uses the same grid snapping as the shape tools. When it is
      // off, pointerToWorld() returns the raw world coordinate.
      const penPoint = pointerToWorld(screen);
      const previous = drafting.current.points[drafting.current.points.length - 1];
      const closeThreshold = 14 / view.s;
      const willClose = snapLineEnabled
        && drafting.current.points.length >= 3
        && Math.hypot(rawWorld.x - drafting.current.start.x, rawWorld.y - drafting.current.start.y) <= closeThreshold;
      penSnapClosingRef.current = willClose;
      setPenSnapClosing(willClose);

      // Snapped pen input can stay on the same grid node for many pointermove
      // events. Do not store duplicate points.
      if (Math.hypot(penPoint.x - previous.x, penPoint.y - previous.y) > 0.001) {
        drafting.current.points.push(penPoint);
      }
    } else if (draftingTool === 'auto') {
      // Auto Draw intentionally records the raw gesture. Snapping the trace to
      // the grid makes shape recognition less reliable, especially for circles
      // and curves. The resulting vector object remains fully editable.
      const previous = drafting.current.points[drafting.current.points.length - 1];
      if (Math.hypot(rawWorld.x - previous.x, rawWorld.y - previous.y) > 0.75 / view.s) {
        drafting.current.points.push(rawWorld);
      }
    } else if (draftingTool === 'eraser') {
      const previous = drafting.current.points[drafting.current.points.length - 1];
      drafting.current.points.push(rawWorld);
      if (!draftHistoryPushed.current) {
        pushHistory();
        draftHistoryPushed.current = true;
      }
      setObjects((current) => cutObjectsWithEraser(
        current,
        previous,
        rawWorld,
        eraserSize / view.s,
        activeLayerId,
      ));
    } else {
      const snappedWorld = pointerToWorld(screen);
      drafting.current.points = [drafting.current.start, snappedWorld];
    }
    setDraftVersion((value) => value + 1);
  }

  function onPointerUp() {
    panStart.current = null;
    flushEditFrame();

    if (multiStart.current && multiBox) {
      const bounds = normalizeBounds(multiStart.current, multiBox.end);
      const ids = editableObjects
        .filter((object) => containsBounds(bounds, objectBounds(object)))
        .map((object) => object.id);
      setSelectedIds(ids);
      setSelectedId(ids[0] ?? null);
      multiStart.current = null;
      setMultiBox(null);
      return;
    }

    edit.current = null;
    multiEdit.current = null;
    editHistoryPushed.current = false;
    multiEditHistoryPushed.current = false;
    if (!drafting.current || !canEditActiveLayer) return;

    const { tool: draftingTool, start, points } = drafting.current;
    const end = points[points.length - 1];
    if (draftingTool === 'pen' && points.length > 1) {
      const last = points[points.length - 1];
      const closedPoints = penSnapClosingRef.current
        && Math.hypot(last.x - start.x, last.y - start.y) > 0.001
        ? [...points, start]
        : points;
      pushHistory();
      addObject({ ...baseStyle(), type: 'stroke', points: closedPoints });
    } else if (draftingTool === 'auto' && points.length > 2) {
      const recognized = recognizeAutoShape(points, baseStyle());
      if (recognized) {
        pushHistory();
        addObject(recognized);
      }
    } else if (draftingTool === 'eraser') {
      setErasePaths([]);
    } else if (isDragShapeTool(draftingTool) && points.length > 1) {
      pushHistory();
      addObject(buildDragShape(draftingTool, start, end, baseStyle()));
    }
    drafting.current = null;
    draftHistoryPushed.current = false;
    penSnapClosingRef.current = false;
    setPenSnapClosing(false);
    setDraftVersion((value) => value + 1);
  }

  function scheduleEditFrame() {
    if (editFrame.current !== null) return;
    editFrame.current = requestAnimationFrame(() => {
      editFrame.current = null;
      applyEditPoint();
    });
  }

  function flushEditFrame() {
    if (editFrame.current !== null) cancelAnimationFrame(editFrame.current);
    editFrame.current = null;
    applyEditPoint();
  }

  function applyEditPoint() {
    const point = editPoint.current;
    if (!point || !canEditActiveLayer) return;
    editPoint.current = null;

    if (edit.current) {
      const state = edit.current;
      setObjects((current) => current.map((object) => (
        object.id === state.initial.id && object.layerId === activeLayerId
          ? editObject(state, point)
          : object
      )));
      return;
    }

    if (multiEdit.current) {
      const state = multiEdit.current;
      if (state.mode === 'rotate') {
        const center = {
          x: (state.bounds.left + state.bounds.right) / 2,
          y: (state.bounds.top + state.bounds.bottom) / 2,
        };
        const angle = Math.atan2(point.y - center.y, point.x - center.x)
          - Math.atan2(state.start.y - center.y, state.start.x - center.x);
        setObjects((current) => current.map((object) => {
          if (object.layerId !== activeLayerId) return object;
          const original = state.initial.find((item) => item.id === object.id);
          return original ? rotateObject(original, angle, center) : object;
        }));
        return;
      }

      const nextBounds = state.mode === 'move'
        ? translateBounds(state.bounds, point.x - state.start.x, point.y - state.start.y)
        : state.handle
          ? resizeBounds(state.bounds, state.handle, point)
          : state.bounds;
      const scaleX = (nextBounds.right - nextBounds.left) / Math.max(state.bounds.right - state.bounds.left, 0.001);
      const scaleY = (nextBounds.bottom - nextBounds.top) / Math.max(state.bounds.bottom - state.bounds.top, 0.001);
      setObjects((current) => current.map((object) => {
        if (object.layerId !== activeLayerId) return object;
        const original = state.initial.find((item) => item.id === object.id);
        return original ? transformObject(original, state.bounds, nextBounds, scaleX, scaleY) : object;
      }));
    }
  }

  function cancelPolyline() {
    setPolyPoints([]);
  }

  function finishPolyline(closeShape: boolean) {
    if (!canEditActiveLayer || polyPoints.length < 2) {
      setPolyPoints([]);
      return;
    }
    const points = closeShape ? [...polyPoints, polyPoints[0]] : polyPoints;
    pushHistory();
    addObject({ ...baseStyle(), type: 'poly', points });
    setPolyPoints([]);
  }

  function saveText() {
    if (!canEditActiveLayer || !textDialog || !textDialog.text.trim()) return;
    const fontSize = Math.max(1, textDialog.fontSize);

    if (textDialog.objectId === null) {
      pushHistory();
      addObject({
        ...baseStyle(),
        type: 'text',
        x1: textDialog.point.x,
        y1: textDialog.point.y,
        text: textDialog.text,
        fontSize,
      });
    } else {
      const original = editableObjects.find((object): object is TextObject => (
        object.id === textDialog.objectId && object.type === 'text'
      ));
      if (!original) {
        setTextDialog(null);
        return;
      }
      if (original.text !== textDialog.text || original.fontSize !== fontSize) {
        pushHistory();
        setObjects((current) => current.map((object) => (
          object.id === textDialog.objectId && object.type === 'text' && object.layerId === activeLayerId
            ? { ...object, text: textDialog.text, fontSize }
            : object
        )));
      }
    }
    setTextDialog(null);
  }

  function cancelCalibration() {
    setCalibrationPoints([]);
    setCalibrationHover(null);
    setCalibrationDialog(null);
  }

  function saveCalibration(meters: number) {
    if (!calibrationDialog) return;
    applyCalibration(calibrationDialog.worldDistance, meters);
    cancelCalibration();
    engine.setTool('select');
  }

  function onWheel(e: ReactWheelEvent) {
    e.preventDefault();
    const rect = drawRef.current!.getBoundingClientRect();
    const cursor = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    setView((current) => {
      const factor = e.deltaY < 0 ? 1.1 : 0.9;
      const nextScale = Math.max(0.2, Math.min(5, current.s * factor));
      const world = { x: (cursor.x - current.tx) / current.s, y: (cursor.y - current.ty) / current.s };
      return {
        s: nextScale,
        tx: cursor.x - world.x * nextScale,
        ty: cursor.y - world.y * nextScale,
      };
    });
  }

  return {
    drafting,
    multiBox,
    polyPoints,
    draftVersion,
    penSnapClosing,
    textDialog,
    setTextDialog,
    calibrationPoints,
    calibrationHover,
    calibrationDialog,
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onWheel,
    cancelPolyline,
    finishPolyline,
    saveText,
    cancelCalibration,
    saveCalibration,
  };
}
