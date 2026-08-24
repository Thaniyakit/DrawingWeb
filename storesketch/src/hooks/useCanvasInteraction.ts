import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type WheelEvent as ReactWheelEvent } from 'react';
import type { Point, SketchObject, SketchObjectStyle, TextObject, ToolType } from '../types';
import { containsBounds, groupBounds, normalizeBounds, objectBounds, type Bounds } from '../engine/bounds';
import { cutObjectsWithEraser } from '../engine/eraser';
import { hitTestObject, hitTestObjects } from '../engine/hitTest';
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
type DrawingTool = 'pen' | 'eraser' | DragShapeTool;

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
    view,
    tool,
    color,
    lineWidth,
    dash,
    selectedId,
    setSelectedId,
    selectedIds,
    setSelectedIds,
    pointerToWorld,
    pointerToWorldRaw,
    pushHistory,
    addObject,
    nextId,
    setView,
    eraserSize,
    setErasePaths,
  } = engine;

  const drafting = useRef<DraftingState | null>(null);
  const panStart = useRef<{ x: number; y: number; tx: number; ty: number } | null>(null);
  const multiStart = useRef<Point | null>(null);
  const [multiBox, setMultiBox] = useState<MultiBox | null>(null);
  const [polyPoints, setPolyPoints] = useState<Point[]>([]);
  const [draftVersion, setDraftVersion] = useState(0);
  const [textDialog, setTextDialog] = useState<TextDialogState | null>(null);
  const edit = useRef<EditState | null>(null);
  const multiEdit = useRef<MultiEditState | null>(null);
  const editPoint = useRef<Point | null>(null);
  const editFrame = useRef<number | null>(null);

  useEffect(() => () => {
    if (editFrame.current !== null) cancelAnimationFrame(editFrame.current);
  }, []);

  function getPos(e: ReactPointerEvent): Point {
    const rect = drawRef.current!.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function baseStyle(): SketchObjectStyle {
    return { id: nextId(), color, width: lineWidth, dash, visible: true };
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

    if (tool === 'objeraser') {
      const hit = hitTestObjects(objects, rawWorld, tolerance);
      if (hit) engine.removeObject(hit.id);
      return;
    }

    if (tool === 'eraser' || tool === 'pen') {
      pushHistory();
      drafting.current = { tool, start: rawWorld, points: [rawWorld] };
      return;
    }

    if (tool === 'poly') {
      setPolyPoints((current) => [...current, snappedWorld]);
      return;
    }

    if (tool === 'text') {
      const existing = [...objects].reverse().find((object): object is TextObject => (
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
      const selected = objects.find((object) => object.id === selectedId);
      if (selected) {
        const bounds = objectBounds(selected);
        const handle = findHandle(rawWorld, bounds, view);
        if (selected.type === 'curve' && nearCurveControl(rawWorld, selected, view)) {
          pushHistory();
          edit.current = { mode: 'curve', start: rawWorld, initial: selected, bounds };
          return;
        }
        if (nearRotateHandle(rawWorld, bounds, view)) {
          pushHistory();
          edit.current = { mode: 'rotate', start: rawWorld, initial: selected, bounds };
          return;
        }
        if (handle || hitTestObject(selected, rawWorld, tolerance)) {
          pushHistory();
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

      const hit = hitTestObjects(objects, rawWorld, tolerance);
      setSelectedId(hit?.id ?? null);
      setSelectedIds(hit ? [hit.id] : []);
      return;
    }

    if (tool === 'multi') {
      const selectedObjects = objects.filter((object) => selectedIds.includes(object.id));
      const selectedBounds = selectedObjects.length ? groupBounds(selectedObjects) : null;
      const handle = selectedBounds ? findHandle(rawWorld, selectedBounds, view) : null;
      const onRotate = selectedBounds ? nearRotateHandle(rawWorld, selectedBounds, view) : false;
      const hitsSelectedObject = selectedObjects.some((object) => hitTestObject(object, rawWorld, tolerance));

      if (selectedBounds && (handle || onRotate || hitsSelectedObject)) {
        pushHistory();
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
        setSelectedId(null);
        setSelectedIds([]);
      }
      return;
    }

    if (isDragShapeTool(tool)) {
      pushHistory();
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

    if (multiStart.current) {
      setMultiBox({ start: multiStart.current, end: rawWorld });
      return;
    }
    if (edit.current || multiEdit.current) {
      editPoint.current = rawWorld;
      scheduleEditFrame();
      return;
    }
    if (!drafting.current) return;

    const draftingTool = drafting.current.tool;
    if (draftingTool === 'pen' || draftingTool === 'eraser') {
      const previous = drafting.current.points[drafting.current.points.length - 1];
      drafting.current.points.push(rawWorld);
      if (draftingTool === 'eraser') {
        setObjects((current) => cutObjectsWithEraser(current, previous, rawWorld, eraserSize / view.s));
      }
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
      const ids = objects
        .filter((object) => object.type !== 'erase' && object.visible !== false && containsBounds(bounds, objectBounds(object)))
        .map((object) => object.id);
      setSelectedIds(ids);
      setSelectedId(ids[0] ?? null);
      multiStart.current = null;
      setMultiBox(null);
      return;
    }

    edit.current = null;
    multiEdit.current = null;
    if (!drafting.current) return;

    const { tool: draftingTool, start, points } = drafting.current;
    const end = points[points.length - 1];
    if (draftingTool === 'pen' && points.length > 1) {
      addObject({ ...baseStyle(), type: 'stroke', points });
    } else if (draftingTool === 'eraser') {
      setErasePaths([]);
    } else if (isDragShapeTool(draftingTool) && points.length > 1) {
      addObject(buildDragShape(draftingTool, start, end, baseStyle()));
    }
    drafting.current = null;
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
    if (!point) return;
    editPoint.current = null;

    if (edit.current) {
      const state = edit.current;
      setObjects((current) => current.map((object) => (
        object.id === state.initial.id ? editObject(state, point) : object
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
        const original = state.initial.find((item) => item.id === object.id);
        return original ? transformObject(original, state.bounds, nextBounds, scaleX, scaleY) : object;
      }));
    }
  }

  function cancelPolyline() {
    setPolyPoints([]);
  }

  function finishPolyline(closeShape: boolean) {
    if (polyPoints.length < 2) {
      setPolyPoints([]);
      return;
    }
    const points = closeShape ? [...polyPoints, polyPoints[0]] : polyPoints;
    pushHistory();
    addObject({ ...baseStyle(), type: 'poly', points });
    setPolyPoints([]);
  }

  function saveText() {
    if (!textDialog || !textDialog.text.trim()) return;
    pushHistory();
    const fontSize = Math.max(1, textDialog.fontSize);

    if (textDialog.objectId === null) {
      addObject({
        ...baseStyle(),
        type: 'text',
        x1: textDialog.point.x,
        y1: textDialog.point.y,
        text: textDialog.text,
        fontSize,
      });
    } else {
      setObjects((current) => current.map((object) => (
        object.id === textDialog.objectId && object.type === 'text'
          ? { ...object, text: textDialog.text, fontSize }
          : object
      )));
    }
    setTextDialog(null);
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
    textDialog,
    setTextDialog,
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onWheel,
    cancelPolyline,
    finishPolyline,
    saveText,
  };
}
