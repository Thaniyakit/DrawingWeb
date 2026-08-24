import { useEffect, useRef, useState } from 'react';
import type { SketchObject, ToolType } from '../../types';
import { drawGrid, drawObjects } from '../../engine/render';
import { worldToScreen } from '../../engine/geometry';
import { getTextSize, normalizeBounds, objectBounds, objectCenter, rotatePoint, type Bounds } from '../../engine/bounds';
import type { useCanvasEngine } from '../../hooks/useCanvasEngine';

type Engine = ReturnType<typeof useCanvasEngine>;

export function SketchCanvas({ engine }: { engine: Engine }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLCanvasElement>(null);
  const drawRef = useRef<HTMLCanvasElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const drafting = useRef<{ tool: ToolType; start: { x: number; y: number }; points: { x: number; y: number }[] } | null>(null);
  const panStart = useRef<{ x: number; y: number; tx: number; ty: number } | null>(null);
  const multiStart = useRef<{ x: number; y: number } | null>(null);
  const [multiBox, setMultiBox] = useState<{ start: { x: number; y: number }; end: { x: number; y: number } } | null>(null);
  const [polyPoints, setPolyPoints] = useState<{ x: number; y: number }[]>([]);
  const [draftVersion, setDraftVersion] = useState(0);
  const [textDialog, setTextDialog] = useState<{ point: { x: number; y: number }; objectId: number | null; text: string; fontSize: number } | null>(null);
  const edit = useRef<EditState | null>(null);
  const multiEdit = useRef<MultiEditState | null>(null);
  const editPoint = useRef<{ x: number; y: number } | null>(null);
  const editFrame = useRef<number | null>(null);
  const { objects, setObjects, erasePaths, setErasePaths, view, tool, color, lineWidth, dash, selectedId, setSelectedId, selectedIds,
    setSelectedIds, pointerToWorld, pushHistory, addObject, nextId, gridVisible, setView, scale, eraserSize, project, updateProject } = engine;

  // Resize canvases to fill the wrapper (mirrors resize()).
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const rect = el.getBoundingClientRect();
      setSize({ w: rect.width, h: rect.height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const g = gridRef.current?.getContext('2d');
    if (!g) return;
    if (gridRef.current) { gridRef.current.width = size.w; gridRef.current.height = size.h; }
    if (gridVisible) drawGrid(g, view, size.w, size.h, scaleToMetersPerSquare(scale));
    else { g.clearRect(0, 0, size.w, size.h); g.fillStyle = '#FFFFFF'; g.fillRect(0, 0, size.w, size.h); }
  }, [view, size, gridVisible, scale]);

  useEffect(() => {
    const d = drawRef.current?.getContext('2d');
    if (!d) return;
    if (drawRef.current) { drawRef.current.width = size.w; drawRef.current.height = size.h; }
    const previewObjects = polyPoints.length > 1
      ? [...objects, { ...previewBase(), type: 'poly', points: polyPoints } as SketchObject]
      : objects;
    let renderObjects = previewObjects;
    if (drafting.current && drafting.current.points.length > 1) {
      if (drafting.current.tool === 'pen') {
        renderObjects = [...renderObjects, { ...previewBase(), type: 'stroke', points: drafting.current.points } as SketchObject];
      } else if (drafting.current.tool === 'line' || drafting.current.tool === 'rect' || drafting.current.tool === 'circle' || drafting.current.tool === 'curve' || drafting.current.tool === 'measure') {
        const start = drafting.current.start;
        const end = drafting.current.points[drafting.current.points.length - 1];
        renderObjects = [...renderObjects, buildPreviewObject(drafting.current.tool, start, end, previewBase())];
      }
    }
    drawObjects(d, renderObjects, view, size.w, size.h, selectedId, selectedIds, scaleToMetersPerSquare(scale), []);
    if (drafting.current?.tool === 'eraser' && drafting.current.points.length > 1) drawEraserPreview(d, drafting.current.points, view, eraserSize);
    if (tool === 'poly' && polyPoints.length) drawPolyPoints(d, polyPoints, view);
    if (multiBox) drawSelectionBox(d, multiBox.start, multiBox.end, view);
    if (tool === 'multi' && selectedIds.length > 0) {
      drawEditBox(d, groupBounds(objects.filter((object) => selectedIds.includes(object.id))), view, scaleToMetersPerSquare(scale));
    }
  }, [objects, view, size, selectedId, selectedIds, multiBox, polyPoints, tool, scale, erasePaths, draftVersion, eraserSize]);

  function getPos(e: React.PointerEvent) {
    const rect = drawRef.current!.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function baseObject(): Pick<SketchObject, 'id' | 'color' | 'width' | 'dash' | 'visible'> {
    return { id: nextId(), color, width: lineWidth, dash, visible: true };
  }

  function previewBase(): Pick<SketchObject, 'id' | 'color' | 'width' | 'dash'> {
    return { id: -1, color, width: lineWidth, dash };
  }

  function onPointerDown(e: React.PointerEvent) {
    (e.target as Element).setPointerCapture(e.pointerId);
    const world = pointerToWorld(getPos(e));
    if (e.button === 1 || (e.button === 0 && e.shiftKey)) {
      panStart.current = { x: e.clientX, y: e.clientY, tx: view.tx, ty: view.ty };
      return;
    }
    if (tool === 'objeraser') {
      const hit = [...objects].reverse().find((object) => object.type !== 'erase' && object.visible !== false && containsPoint(objectBounds(object), world));
      if (hit) engine.removeObject(hit.id);
    } else if (tool === 'eraser' || tool === 'pen') {
      pushHistory();
      drafting.current = { tool, start: world, points: [world] };
    } else if (tool === 'poly') {
      setPolyPoints((current) => [...current, world]);
    } else if (tool === 'text') {
      const existing = [...objects].reverse().find((object) => object.type === 'text' && containsPoint(objectBounds(object), world));
      setTextDialog({ point: existing ? { x: existing.x1!, y: existing.y1! } : world, objectId: existing?.id ?? null, text: existing?.text ?? '', fontSize: existing?.fontSize ?? 80 });
    } else if (tool === 'select') {
      const selected = objects.find((object) => object.id === selectedId);
      if (selected) {
        const bounds = objectBounds(selected);
        const handle = findHandle(world, bounds, view);
        if (selected.type === 'curve' && nearCurveControl(world, selected, view)) {
          pushHistory(); edit.current = { mode: 'curve', start: world, initial: selected, bounds }; return;
        }
        if (nearRotateHandle(world, bounds, view)) {
          pushHistory(); edit.current = { mode: 'rotate', start: world, initial: selected, bounds }; return;
        }
        if (handle || containsPoint(bounds, world)) {
          pushHistory(); edit.current = { mode: handle ? 'resize' : 'move', handle: handle ?? undefined, start: world, initial: selected, bounds }; return;
        }
      }
      const hit = [...objects].reverse().find((object) => object.type !== 'erase' && object.visible !== false && containsPoint(objectBounds(object), world));
      setSelectedId(hit?.id ?? null); setSelectedIds(hit ? [hit.id] : []);
    } else if (tool === 'multi') {
      const selectedObjects = objects.filter((object) => selectedIds.includes(object.id));
      const selectedBounds = selectedObjects.length ? groupBounds(selectedObjects) : null;
      if (selectedBounds && (containsPoint(selectedBounds, world) || findHandle(world, selectedBounds, view) || nearRotateHandle(world, selectedBounds, view))) {
        const handle = findHandle(world, selectedBounds, view);
        pushHistory();
        multiEdit.current = { mode: nearRotateHandle(world, selectedBounds, view) ? 'rotate' : handle ? 'resize' : 'move', handle: handle ?? undefined, start: world, initial: selectedObjects, bounds: selectedBounds };
      } else {
        multiStart.current = world; setMultiBox({ start: world, end: world }); setSelectedId(null); setSelectedIds([]);
      }
    } else if (tool === 'line' || tool === 'rect' || tool === 'circle' || tool === 'curve' || tool === 'measure') {
      pushHistory(); drafting.current = { tool, start: world, points: [world] };
    }
  }

  function onPointerMove(e: React.PointerEvent) {
    if (panStart.current) { setView((current) => ({ ...current, tx: panStart.current!.tx + e.clientX - panStart.current!.x, ty: panStart.current!.ty + e.clientY - panStart.current!.y })); return; }
    const world = pointerToWorld(getPos(e));
    if (multiStart.current) { setMultiBox({ start: multiStart.current, end: world }); return; }
    if (edit.current) {
      editPoint.current = world;
      scheduleEditFrame();
      return;
    }
    if (multiEdit.current) {
      editPoint.current = world;
      scheduleEditFrame();
      return;
    }
    if (!drafting.current) return;
    const draftingTool = drafting.current.tool;
    if (draftingTool === 'pen' || draftingTool === 'eraser') {
      const previous = drafting.current.points[drafting.current.points.length - 1];
      drafting.current.points.push(world);
      if (draftingTool === 'eraser') cutObjectsAt(previous, world, eraserSize / view.s);
    }
    else { drafting.current.points = [drafting.current.start, world]; }
    setDraftVersion((value) => value + 1);
}

  function onPointerUp() {
    panStart.current = null;
    flushEditFrame();
    if (multiStart.current && multiBox) {
      const bounds = normalizeBounds(multiStart.current, multiBox.end);
      const ids = objects.filter((object) => object.type !== 'erase' && object.visible !== false && containsBounds(bounds, objectBounds(object))).map((object) => object.id);
      setSelectedIds(ids); setSelectedId(ids[0] ?? null); multiStart.current = null; setMultiBox(null); return;
    }
    edit.current = null; multiEdit.current = null;
    if (!drafting.current) return;
    const { tool: draftingTool, start, points } = drafting.current;
    const end = points[points.length - 1];
    if ((draftingTool === 'pen' || draftingTool === 'eraser') && points.length > 1) {
      if (draftingTool === 'eraser') setErasePaths([]);
      else addObject({ ...baseObject(), type: 'stroke', points });
    } else if (draftingTool === 'line' || draftingTool === 'rect' || draftingTool === 'circle' || draftingTool === 'curve' || draftingTool === 'measure') {
      addObject(buildPreviewObject(draftingTool, start, end, baseObject()));
    }
    drafting.current = null;
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
      setObjects((current) => current.map((object) => object.id === state.initial.id ? editObject(state, point) : object));
      setDraftVersion((value) => value + 1);
      return;
    }
    if (multiEdit.current) {
      const state = multiEdit.current;
      if (state.mode === 'rotate') {
        const center = { x: (state.bounds.left + state.bounds.right) / 2, y: (state.bounds.top + state.bounds.bottom) / 2 };
        const angle = Math.atan2(point.y - center.y, point.x - center.x) - Math.atan2(state.start.y - center.y, state.start.x - center.x);
        setObjects((current) => current.map((object) => {
          const original = state.initial.find((item) => item.id === object.id);
          return original ? rotateObject(original, angle, center) : object;
        }));
        return;
      }
      const nextBounds = state.mode === 'move'
        ? translateBounds(state.bounds, point.x - state.start.x, point.y - state.start.y)
        : resizeBounds(state.bounds, state.handle!, point);
      const scaleX = (nextBounds.right - nextBounds.left) / Math.max(state.bounds.right - state.bounds.left, 0.001);
      const scaleY = (nextBounds.bottom - nextBounds.top) / Math.max(state.bounds.bottom - state.bounds.top, 0.001);
      setObjects((current) => current.map((object) => {
        const original = state.initial.find((item) => item.id === object.id);
        return original ? transformObject(original, state.bounds, nextBounds, scaleX, scaleY) : object;
      }));
    }
  }

  function cutObjectsAt(start: { x: number; y: number }, end: { x: number; y: number }, radius: number) {
    setObjects((current) => current.flatMap((object) => {
      if (object.type === 'stroke' || object.type === 'poly') {
        if (!object.points || object.points.length < 2) return object;
        const source = object.segments ?? [object.points];
        const nextSegments: { x: number; y: number }[][] = [];
        for (const segment of source) {
          let remaining: { x: number; y: number }[] = [];
          for (let index = 0; index < segment.length - 1; index += 1) {
            const first = segment[index];
            const second = segment[index + 1];
            const hit = distanceToSegment(first, start, end) <= radius
              || distanceToSegment(second, start, end) <= radius
              || distanceToSegment({ x: (first.x + second.x) / 2, y: (first.y + second.y) / 2 }, start, end) <= radius;
            if (hit) {
              if (remaining.length > 1) nextSegments.push(remaining);
              remaining = [];
            } else {
              if (!remaining.length) remaining.push(first);
              remaining.push(second);
            }
          }
          if (remaining.length > 1) nextSegments.push(remaining);
        }
        return nextSegments.length ? [{ ...object, segments: nextSegments }] : [];
      }

      if (object.type === 'erase' || object.visible === false) return object;
      return eraserHitsObject(object, start, end, radius) ? [] : object;
    }));
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
    addObject({ ...baseObject(), type: 'poly', points });
    setPolyPoints([]);
  }

  function saveText() {
    if (!textDialog || !textDialog.text.trim()) return;
    const textObject: SketchObject = {
      ...baseObject(),
      type: 'text',
      x1: textDialog.point.x,
      y1: textDialog.point.y,
      text: textDialog.text,
      fontSize: Math.max(1, textDialog.fontSize),
    };
    pushHistory();
    if (textDialog.objectId === null) addObject(textObject);
    else setObjects((current) => current.map((object) => object.id === textDialog.objectId ? { ...object, text: textDialog.text, fontSize: Math.max(1, textDialog.fontSize) } : object));
    setTextDialog(null);
  }

  function onWheel(e: React.WheelEvent) {
    e.preventDefault();
    const rect = drawRef.current!.getBoundingClientRect();
    const cursor = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    setView((current) => {
      const factor = e.deltaY < 0 ? 1.1 : 0.9;
      const nextScale = Math.max(0.2, Math.min(5, current.s * factor));
      const world = { x: (cursor.x - current.tx) / current.s, y: (cursor.y - current.ty) / current.s };
      return { s: nextScale, tx: cursor.x - world.x * nextScale, ty: cursor.y - world.y * nextScale };
    });
  }

  return (
    <div ref={wrapRef} className="canvas-wrap">
      <canvas ref={gridRef} id="gridCanvas" />
      <canvas
        ref={drawRef}
        id="drawCanvas"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onWheel={onWheel}
      />
      <button className="compass" title="หมุนทิศเหนือ" onClick={() => updateProject({ north: (project.north + 15) % 360 })}><div className="compass-needle" style={{ transform: `rotate(${project.north}deg)` }}>N</div></button>
      <div className="compass-hint">ลากเพื่อหมุนทิศ</div>
      <label className="shopname-wrap"><span>ชื่อร้าน</span><input value={project.shopName} onChange={(e) => updateProject({ shopName: e.target.value })} placeholder="ระบุชื่อร้าน" /></label>
      <div className="titleblock"><div className="tb-row"><span>PROJECT</span><strong>STORE SKETCH</strong></div><div className="tb-row"><span>SCALE</span><strong>1:{Math.round(100 / view.s)}</strong></div><div className="tb-row"><span>GRID</span><strong>24 px</strong></div></div>
      <div className="hint-pill show">ใช้ล้อเมาส์เพื่อซูม • Shift + ลากเพื่อเลื่อน</div>
      {tool === 'poly' && polyPoints.length > 0 && <div className="poly-bar open"><button className="btn" onClick={cancelPolyline}>ยกเลิก</button><button className="btn" onClick={() => finishPolyline(false)}>จบเส้น</button><button className="btn primary" onClick={() => finishPolyline(true)}>ปิดรูป</button></div>}
      {textDialog && <div className="modal-back open" onPointerDown={(event) => event.stopPropagation()}><div className="modal" role="dialog" aria-modal="true"><h3>พิมพ์ข้อความ</h3><textarea autoFocus value={textDialog.text} placeholder="ข้อความ เช่น พื้นที่เช่า" onChange={(event) => setTextDialog((current) => current ? { ...current, text: event.target.value } : current)} /><div className="text-size-row"><span>ขนาด</span><input type="number" min="1" value={textDialog.fontSize} onChange={(event) => setTextDialog((current) => current ? { ...current, fontSize: Number(event.target.value) } : current)} /><span>px</span></div><div className="btn-row"><button className="btn" onClick={() => setTextDialog(null)}>ยกเลิก</button><button className="btn primary" onClick={saveText}>วางข้อความ</button></div></div></div>}
    </div>
  );
}

function buildPreviewObject(
  tool: 'line' | 'rect' | 'circle' | 'curve' | 'measure',
  start: { x: number; y: number },
  end: { x: number; y: number },
  base: Pick<SketchObject, 'id' | 'color' | 'width' | 'dash'>,
): SketchObject {
  if (tool === 'circle') {
    return {
      ...base,
      type: 'circle',
      cx: (start.x + end.x) / 2,
      cy: (start.y + end.y) / 2,
      rx: Math.abs(end.x - start.x) / 2,
      ry: Math.abs(end.y - start.y) / 2,
    } as SketchObject;
  }
  if (tool === 'curve') {
    return {
      ...base,
      type: 'curve',
      x1: start.x,
      y1: start.y,
      x2: end.x,
      y2: end.y,
      controlX: (start.x + end.x) / 2,
      controlY: (start.y + end.y) / 2,
    } as SketchObject;
  }
  if (tool === 'measure') {
    return { ...base, type: 'measure', x1: start.x, y1: start.y, x2: end.x, y2: end.y } as SketchObject;
  }
  return {
    ...base,
    type: tool,
    x1: start.x, y1: start.y, x2: end.x, y2: end.y,
  } as SketchObject;
}

function scaleToMetersPerSquare(scale: number): number {
  return scale === 20 ? 0.2 : scale === 50 ? 0.5 : scale === 200 ? 2 : scale === 500 ? 5 : 1;
}

function containsBounds(container: Bounds, candidate: Bounds): boolean {
  return candidate.left >= container.left && candidate.top >= container.top
    && candidate.right <= container.right && candidate.bottom <= container.bottom;
}

type ResizeHandle = 'nw' | 'ne' | 'sw' | 'se';
type EditState = {
  mode: 'move' | 'resize' | 'curve' | 'rotate';
  start: { x: number; y: number };
  initial: SketchObject;
  bounds: Bounds;
  handle?: ResizeHandle;
};
type MultiEditState = {
  mode: 'move' | 'resize' | 'rotate';
  start: { x: number; y: number };
  initial: SketchObject[];
  bounds: Bounds;
  handle?: ResizeHandle;
};

function groupBounds(objects: SketchObject[]): Bounds {
  const bounds = objects.map(objectBounds);
  return {
    left: Math.min(...bounds.map((item) => item.left)),
    top: Math.min(...bounds.map((item) => item.top)),
    right: Math.max(...bounds.map((item) => item.right)),
    bottom: Math.max(...bounds.map((item) => item.bottom)),
  };
}

function containsPoint(bounds: Bounds, point: { x: number; y: number }): boolean {
  return point.x >= bounds.left && point.x <= bounds.right && point.y >= bounds.top && point.y <= bounds.bottom;
}

function distanceToSegment(point: { x: number; y: number }, start: { x: number; y: number }, end: { x: number; y: number }): number {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lengthSquared = dx * dx + dy * dy;
  if (!lengthSquared) return Math.hypot(point.x - start.x, point.y - start.y);
  const t = Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared));
  return Math.hypot(point.x - (start.x + t * dx), point.y - (start.y + t * dy));
}

function distanceBetweenSegments(
  a1: { x: number; y: number },
  a2: { x: number; y: number },
  b1: { x: number; y: number },
  b2: { x: number; y: number },
): number {
  return Math.min(
    distanceToSegment(a1, b1, b2),
    distanceToSegment(a2, b1, b2),
    distanceToSegment(b1, a1, a2),
    distanceToSegment(b2, a1, a2),
  );
}

function pointInExpandedBounds(bounds: Bounds, point: { x: number; y: number }, expand: number): boolean {
  return point.x >= bounds.left - expand
    && point.x <= bounds.right + expand
    && point.y >= bounds.top - expand
    && point.y <= bounds.bottom + expand;
}

function polylineHitsEraser(points: { x: number; y: number }[], start: { x: number; y: number }, end: { x: number; y: number }, radius: number): boolean {
  for (let i = 0; i < points.length - 1; i += 1) {
    if (distanceBetweenSegments(points[i], points[i + 1], start, end) <= radius) return true;
  }
  return false;
}

function sampledQuadratic(
  p0: { x: number; y: number },
  p1: { x: number; y: number },
  p2: { x: number; y: number },
  steps = 24,
): { x: number; y: number }[] {
  const out: { x: number; y: number }[] = [];
  for (let i = 0; i <= steps; i += 1) {
    const t = i / steps;
    const mt = 1 - t;
    out.push({
      x: mt * mt * p0.x + 2 * mt * t * p1.x + t * t * p2.x,
      y: mt * mt * p0.y + 2 * mt * t * p1.y + t * t * p2.y,
    });
  }
  return out;
}

function sampledEllipse(cx: number, cy: number, rx: number, ry: number, steps = 48): { x: number; y: number }[] {
  const out: { x: number; y: number }[] = [];
  for (let i = 0; i <= steps; i += 1) {
    const t = (i / steps) * Math.PI * 2;
    out.push({ x: cx + Math.cos(t) * rx, y: cy + Math.sin(t) * ry });
  }
  return out;
}

function eraserHitsObject(
  object: SketchObject,
  eraserStart: { x: number; y: number },
  eraserEnd: { x: number; y: number },
  radius: number,
): boolean {
  const thickness = radius + Math.max(1, object.width ?? 1) / 2;

  if (object.type === 'line' || object.type === 'measure') {
    if (object.x1 === undefined || object.y1 === undefined || object.x2 === undefined || object.y2 === undefined) return false;
    return distanceBetweenSegments({ x: object.x1, y: object.y1 }, { x: object.x2, y: object.y2 }, eraserStart, eraserEnd) <= thickness;
  }

  if (object.type === 'rect') {
    const bounds = objectBounds(object);
    const edges = [
      [{ x: bounds.left, y: bounds.top }, { x: bounds.right, y: bounds.top }],
      [{ x: bounds.right, y: bounds.top }, { x: bounds.right, y: bounds.bottom }],
      [{ x: bounds.right, y: bounds.bottom }, { x: bounds.left, y: bounds.bottom }],
      [{ x: bounds.left, y: bounds.bottom }, { x: bounds.left, y: bounds.top }],
    ] as const;
    if (edges.some(([a, b]) => distanceBetweenSegments(a, b, eraserStart, eraserEnd) <= thickness)) return true;
    return pointInExpandedBounds(bounds, eraserStart, radius) || pointInExpandedBounds(bounds, eraserEnd, radius);
  }

  if (object.type === 'circle') {
    const rx = Math.max(0.001, object.rx ?? object.r ?? 0);
    const ry = Math.max(0.001, object.ry ?? object.r ?? 0);
    if (object.cx === undefined || object.cy === undefined) return false;
    return polylineHitsEraser(sampledEllipse(object.cx, object.cy, rx, ry), eraserStart, eraserEnd, thickness);
  }

  if (object.type === 'curve') {
    if (object.x1 === undefined || object.y1 === undefined || object.x2 === undefined || object.y2 === undefined || object.controlX === undefined || object.controlY === undefined) {
      return false;
    }
    const points = sampledQuadratic(
      { x: object.x1, y: object.y1 },
      { x: object.controlX, y: object.controlY },
      { x: object.x2, y: object.y2 },
    );
    return polylineHitsEraser(points, eraserStart, eraserEnd, thickness);
  }

  if (object.type === 'text') {
    return pointInExpandedBounds(objectBounds(object), eraserStart, thickness)
      || pointInExpandedBounds(objectBounds(object), eraserEnd, thickness)
      || distanceToSegment({ x: objectBounds(object).left, y: objectBounds(object).top }, eraserStart, eraserEnd) <= thickness
      || distanceToSegment({ x: objectBounds(object).right, y: objectBounds(object).bottom }, eraserStart, eraserEnd) <= thickness;
  }

  if (object.points && object.points.length > 1) {
    return polylineHitsEraser(object.points, eraserStart, eraserEnd, thickness);
  }

  return false;
}

function findHandle(point: { x: number; y: number }, bounds: Bounds, view: { s: number }): ResizeHandle | null {
  const tolerance = 10 / view.s;
  const handles: { name: ResizeHandle; x: number; y: number }[] = [
    { name: 'nw', x: bounds.left, y: bounds.top }, { name: 'ne', x: bounds.right, y: bounds.top },
    { name: 'sw', x: bounds.left, y: bounds.bottom }, { name: 'se', x: bounds.right, y: bounds.bottom },
  ];
  return handles.find((handle) => Math.abs(point.x - handle.x) <= tolerance && Math.abs(point.y - handle.y) <= tolerance)?.name ?? null;
}

function nearRotateHandle(point: { x: number; y: number }, bounds: Bounds, view: { s: number }): boolean {
  const centerX = (bounds.left + bounds.right) / 2;
  const handleY = bounds.top - 28 / view.s;
  return Math.hypot(point.x - centerX, point.y - handleY) <= 12 / view.s;
}

function rotateObject(object: SketchObject, angle: number, center: { x: number; y: number }): SketchObject {
  // Rectangles, ellipses and text keep their own local geometry and a rotation value.
  // Other objects (line/stroke/poly/curve/measure) store the rotation directly in their points.
  if (object.type === 'rect' || object.type === 'image') {
    const currentCenter = objectCenter(object);
    const nextCenter = rotatePoint(currentCenter, angle, center);
    const width = Math.abs((object.x2 ?? object.x1 ?? 0) - (object.x1 ?? 0));
    const height = Math.abs((object.y2 ?? object.y1 ?? 0) - (object.y1 ?? 0));
    return {
      ...object,
      x1: nextCenter.x - width / 2,
      y1: nextCenter.y - height / 2,
      x2: nextCenter.x + width / 2,
      y2: nextCenter.y + height / 2,
      rotation: (object.rotation ?? 0) + angle,
    };
  }

  if (object.type === 'circle') {
    const currentCenter = { x: object.cx ?? 0, y: object.cy ?? 0 };
    const nextCenter = rotatePoint(currentCenter, angle, center);
    return {
      ...object,
      cx: nextCenter.x,
      cy: nextCenter.y,
      rotation: (object.rotation ?? 0) + angle,
    };
  }

  if (object.type === 'text') {
    const currentCenter = objectCenter(object);
    const nextCenter = rotatePoint(currentCenter, angle, center);
    const { width, height } = getTextSize(object);
    return {
      ...object,
      x1: nextCenter.x - width / 2,
      y1: nextCenter.y + height / 2,
      rotation: (object.rotation ?? 0) + angle,
    };
  }

  const result = { ...object };
  if (object.points) result.points = object.points.map((point) => rotatePoint(point, angle, center));
  if (object.segments) result.segments = object.segments.map((segment) => segment.map((point) => rotatePoint(point, angle, center)));
  if (object.x1 !== undefined && object.y1 !== undefined) {
    const point = rotatePoint({ x: object.x1, y: object.y1 }, angle, center);
    result.x1 = point.x; result.y1 = point.y;
  }
  if (object.x2 !== undefined && object.y2 !== undefined) {
    const point = rotatePoint({ x: object.x2, y: object.y2 }, angle, center);
    result.x2 = point.x; result.y2 = point.y;
  }
  if (object.controlX !== undefined && object.controlY !== undefined) {
    const point = rotatePoint({ x: object.controlX, y: object.controlY }, angle, center);
    result.controlX = point.x; result.controlY = point.y;
  }
  return result;
}

function editObject(state: EditState, point: { x: number; y: number }): SketchObject {
  const object = state.initial;
  if (state.mode === 'curve') return { ...object, controlX: point.x, controlY: point.y };
  if (state.mode === 'rotate') {
    const center = { x: (state.bounds.left + state.bounds.right) / 2, y: (state.bounds.top + state.bounds.bottom) / 2 };
    const angle = Math.atan2(point.y - center.y, point.x - center.x) - Math.atan2(state.start.y - center.y, state.start.x - center.x);
    return rotateObject(object, angle, center);
  }
  if (state.mode === 'move') {
    const dx = point.x - state.start.x;
    const dy = point.y - state.start.y;
    return transformObject(object, state.bounds, translateBounds(state.bounds, dx, dy));
  }
  const nextBounds = { ...state.bounds };
  if (state.handle!.includes('w')) nextBounds.left = point.x;
  if (state.handle!.includes('e')) nextBounds.right = point.x;
  if (state.handle!.includes('n')) nextBounds.top = point.y;
  if (state.handle!.includes('s')) nextBounds.bottom = point.y;
  return transformObject(object, state.bounds, nextBounds);
}

function nearCurveControl(point: { x: number; y: number }, object: SketchObject, view: { s: number }): boolean {
  return Math.hypot(point.x - object.controlX!, point.y - object.controlY!) <= 10 / view.s;
}

function transformObject(object: SketchObject, from: Bounds, to: Bounds, scaleX = (to.right - to.left) / Math.max(from.right - from.left, 0.001), scaleY = (to.bottom - to.top) / Math.max(from.bottom - from.top, 0.001)): SketchObject {
  const mapPoint = (point: { x: number; y: number }) => ({
    x: to.left + (point.x - from.left) * scaleX,
    y: to.top + (point.y - from.top) * scaleY,
  });

  if (object.points) {
    return {
      ...object,
      points: object.points.map(mapPoint),
      segments: object.segments?.map((segment) => segment.map(mapPoint)),
    };
  }

  if (object.type === 'text') {
    const oldCenter = objectCenter(object);
    const nextCenter = mapPoint(oldCenter);
    const nextFontSize = Math.max(1, (object.fontSize ?? 14) * Math.max(Math.abs(scaleX), Math.abs(scaleY)));
    const sizedObject = { ...object, fontSize: nextFontSize };
    const { width, height } = getTextSize(sizedObject);
    return {
      ...object,
      x1: nextCenter.x - width / 2,
      y1: nextCenter.y + height / 2,
      fontSize: nextFontSize,
    };
  }

  if (object.type === 'circle') {
    const center = mapPoint({ x: object.cx ?? 0, y: object.cy ?? 0 });
    const rx = Math.max(0.001, (object.rx ?? object.r ?? 0) * Math.abs(scaleX));
    const ry = Math.max(0.001, (object.ry ?? object.r ?? 0) * Math.abs(scaleY));
    return { ...object, cx: center.x, cy: center.y, rx, ry, r: undefined };
  }

  if (object.type === 'rect' || object.type === 'image') {
    const center = mapPoint(objectCenter(object));
    const width = Math.max(0.001, Math.abs((object.x2 ?? object.x1 ?? 0) - (object.x1 ?? 0)) * Math.abs(scaleX));
    const height = Math.max(0.001, Math.abs((object.y2 ?? object.y1 ?? 0) - (object.y1 ?? 0)) * Math.abs(scaleY));
    return {
      ...object,
      x1: center.x - width / 2,
      y1: center.y - height / 2,
      x2: center.x + width / 2,
      y2: center.y + height / 2,
    };
  }

  if (object.type === 'curve') {
    const start = mapPoint({ x: object.x1!, y: object.y1! });
    const end = mapPoint({ x: object.x2!, y: object.y2! });
    const control = mapPoint({ x: object.controlX!, y: object.controlY! });
    return { ...object, x1: start.x, y1: start.y, x2: end.x, y2: end.y, controlX: control.x, controlY: control.y };
  }

  if (object.x1 !== undefined && object.y1 !== undefined && object.x2 !== undefined && object.y2 !== undefined) {
    const first = mapPoint({ x: object.x1, y: object.y1 });
    const second = mapPoint({ x: object.x2, y: object.y2 });
    return { ...object, x1: first.x, y1: first.y, x2: second.x, y2: second.y };
  }

  return object;
}

function translateBounds(bounds: Bounds, x: number, y: number): Bounds {
  return { left: bounds.left + x, top: bounds.top + y, right: bounds.right + x, bottom: bounds.bottom + y };
}

function resizeBounds(bounds: Bounds, handle: ResizeHandle, point: { x: number; y: number }): Bounds {
  const next = { ...bounds };
  if (handle.includes('w')) next.left = point.x;
  if (handle.includes('e')) next.right = point.x;
  if (handle.includes('n')) next.top = point.y;
  if (handle.includes('s')) next.bottom = point.y;
  return next;
}

function drawEditBox(ctx: CanvasRenderingContext2D, bounds: Bounds, view: { s: number; tx: number; ty: number }, metersPerSquare: number) {
  const topLeft = worldToScreen({ x: bounds.left, y: bounds.top }, view);
  const bottomRight = worldToScreen({ x: bounds.right, y: bounds.bottom }, view);
  const padding = 7;
  ctx.save();
  ctx.strokeStyle = '#F2A63C';
  ctx.fillStyle = '#F2A63C';
  ctx.lineWidth = 1.5;
  ctx.setLineDash([4, 3]);
  ctx.strokeRect(topLeft.x - padding, topLeft.y - padding, bottomRight.x - topLeft.x + padding * 2, bottomRight.y - topLeft.y + padding * 2);
  ctx.setLineDash([]);
  for (const [x, y] of [[topLeft.x - padding, topLeft.y - padding], [bottomRight.x + padding, topLeft.y - padding], [topLeft.x - padding, bottomRight.y + padding], [bottomRight.x + padding, bottomRight.y + padding]]) {
    ctx.fillRect(x - 4, y - 4, 8, 8);
  }
  const centerX = (topLeft.x + bottomRight.x) / 2;
  const rotateY = topLeft.y - padding - 28;
  ctx.strokeStyle = '#F2A63C';
  ctx.beginPath(); ctx.moveTo(centerX, topLeft.y - padding); ctx.lineTo(centerX, rotateY); ctx.stroke();
  ctx.fillRect(centerX - 6, rotateY - 6, 12, 12);
  const label = `${((bounds.right - bounds.left) / 24 * metersPerSquare).toFixed(2)} × ${((bounds.bottom - bounds.top) / 24 * metersPerSquare).toFixed(2)} ม.`;
  ctx.font = '12px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const width = ctx.measureText(label).width + 12;
  ctx.fillStyle = 'rgba(242,166,60,0.95)'; ctx.fillRect(centerX - width / 2, rotateY - 31, width, 20);
  ctx.fillStyle = '#14181D'; ctx.fillText(label, centerX, rotateY - 21);
  ctx.restore();
}

function drawPolyPoints(ctx: CanvasRenderingContext2D, points: { x: number; y: number }[], view: { s: number; tx: number; ty: number }) {
  points.forEach((point, index) => {
    const screen = worldToScreen(point, view);
    ctx.beginPath();
    ctx.fillStyle = index === points.length - 1 ? '#2E9B62' : '#F2A63C';
    ctx.arc(screen.x, screen.y, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  });
}

function drawSelectionBox(ctx: CanvasRenderingContext2D, start: { x: number; y: number }, end: { x: number; y: number }, view: { s: number; tx: number; ty: number }) {
  const a = worldToScreen(start, view);
  const b = worldToScreen(end, view);
  ctx.save();
  ctx.strokeStyle = '#0E3050';
  ctx.fillStyle = 'rgba(14,48,80,0.08)';
  ctx.setLineDash([6, 4]);
  ctx.lineWidth = 1.5;
  ctx.fillRect(Math.min(a.x, b.x), Math.min(a.y, b.y), Math.abs(b.x - a.x), Math.abs(b.y - a.y));
  ctx.strokeRect(Math.min(a.x, b.x), Math.min(a.y, b.y), Math.abs(b.x - a.x), Math.abs(b.y - a.y));
  ctx.restore();
}

function drawEraserPreview(ctx: CanvasRenderingContext2D, points: { x: number; y: number }[], view: { s: number; tx: number; ty: number }, width: number) {
  ctx.save();
  ctx.strokeStyle = 'rgba(228,87,46,0.55)';
  ctx.lineWidth = Math.max(1, width * view.s);
  ctx.setLineDash([5, 5]);
  ctx.lineCap = 'round';
  ctx.beginPath();
  points.forEach((point, index) => {
    const screen = worldToScreen(point, view);
    if (index === 0) ctx.moveTo(screen.x, screen.y);
    else ctx.lineTo(screen.x, screen.y);
  });
  ctx.stroke();
  ctx.restore();
}
