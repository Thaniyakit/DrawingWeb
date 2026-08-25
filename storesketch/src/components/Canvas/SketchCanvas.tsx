import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import type { SketchObject, SketchObjectStyle } from '../../types';
import { drawGrid, drawObjects } from '../../engine/render';
import { groupBounds } from '../../engine/bounds';
import { drawCalibrationGuide, drawEditBox, drawEraserPreview, drawObjectDimensions, drawPolyPoints, drawSelectionBox, drawSnapCloseHint } from '../../engine/overlays';
import { buildDragShape } from '../../engine/shapes';
import { useCanvasInteraction } from '../../hooks/useCanvasInteraction';
import type { useCanvasEngine } from '../../hooks/useCanvasEngine';
import { TextDialog } from './TextDialog';
import { CalibrationDialog } from './CalibrationDialog';
import { SelectionSizeEditor } from './SelectionSizeEditor';

type Engine = ReturnType<typeof useCanvasEngine>;

export function SketchCanvas({ engine }: { engine: Engine }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLCanvasElement>(null);
  const drawRef = useRef<HTMLCanvasElement>(null);
  const compassRef = useRef<HTMLButtonElement>(null);
  const compassDraggingRef = useRef(false);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [imageRevision, setImageRevision] = useState(0);

  const {
    objects,
    erasePaths,
    layers,
    activeLayerId,
    activeLayer,
    canEditActiveLayer,
    view,
    tool,
    color,
    lineWidth,
    dash,
    selectedId,
    selectedIds,
    gridVisible,
    metersPerSquare,
    scaleLabel,
    setCanvasViewportSize,
    eraserSize,
    dimEnabled,
    dimensionObjectIds,
    project,
    updateProject,
  } = engine;

  const interaction = useCanvasInteraction(engine, drawRef);
  const {
    drafting,
    isPanning,
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
  } = interaction;

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const rect = el.getBoundingClientRect();
      setSize({ w: rect.width, h: rect.height });
      setCanvasViewportSize(rect.width, rect.height);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [setCanvasViewportSize]);

  useEffect(() => {
    const canvas = gridRef.current;
    const context = canvas?.getContext('2d');
    if (!canvas || !context) return;
    canvas.width = size.w;
    canvas.height = size.h;

    if (gridVisible) {
      drawGrid(context, view, size.w, size.h, metersPerSquare);
    } else {
      context.clearRect(0, 0, size.w, size.h);
      context.fillStyle = '#FFFFFF';
      context.fillRect(0, 0, size.w, size.h);
    }
  }, [view, size, gridVisible, metersPerSquare]);

  useEffect(() => {
    const canvas = drawRef.current;
    const context = canvas?.getContext('2d');
    if (!canvas || !context) return;
    canvas.width = size.w;
    canvas.height = size.h;

    const previewStyle: SketchObjectStyle = {
      id: -1,
      layerId: activeLayerId,
      color,
      width: lineWidth,
      dash,
    };
    const activePreviews: SketchObject[] = [];

    if (canEditActiveLayer && polyPoints.length > 1) {
      activePreviews.push({ ...previewStyle, type: 'poly', points: polyPoints });
    }

    const draft = drafting.current;
    if (canEditActiveLayer && draft && draft.points.length > 1) {
      if (draft.tool === 'pen' || draft.tool === 'auto') {
        const previewPoints = draft.tool === 'pen' && penSnapClosing
          ? [...draft.points, draft.start]
          : draft.points;
        activePreviews.push({ ...previewStyle, type: 'stroke', points: previewPoints });
      } else if (draft.tool !== 'eraser') {
        const end = draft.points[draft.points.length - 1];
        activePreviews.push(buildDragShape(draft.tool, draft.start, end, previewStyle));
      }
    }

    // Layer array is bottom -> top. Render objects in that same order and put
    // previews inside the active layer rather than always on top of the canvas.
    const renderObjects: SketchObject[] = [];
    for (const layer of layers) {
      if (!layer.visible) continue;
      renderObjects.push(...objects.filter((object) => object.layerId === layer.id));
      if (layer.id === activeLayerId) renderObjects.push(...activePreviews);
    }

    // Multi-select owns one group frame. Suppress the normal single-object
    // selection frame so selecting only one object in Multi mode does not draw
    // two boxes on top of each other.
    const renderSelectedId = tool === 'multi' ? null : selectedId;
    const renderSelectedIds = tool === 'multi' ? [] : selectedIds;
    drawObjects(
      context,
      renderObjects,
      view,
      size.w,
      size.h,
      renderSelectedId,
      renderSelectedIds,
      metersPerSquare,
      erasePaths,
      true,
      () => setImageRevision((value) => value + 1),
    );

    for (const objectId of dimensionObjectIds) {
      const dimObject = objects.find((object) => object.id === objectId);
      const dimLayer = dimObject ? layers.find((layer) => layer.id === dimObject.layerId) : undefined;
      if (dimObject && dimLayer?.visible && dimObject.visible !== false) {
        drawObjectDimensions(context, dimObject, view, metersPerSquare);
      }
    }

    if (canEditActiveLayer && draft?.tool === 'eraser' && draft.points.length > 1) {
      drawEraserPreview(context, draft.points, view, eraserSize);
    }
    if (canEditActiveLayer && draft?.tool === 'pen' && penSnapClosing) {
      drawSnapCloseHint(context, draft.start, view);
    }
    if (canEditActiveLayer && tool === 'poly' && polyPoints.length) drawPolyPoints(context, polyPoints, view);
    if (canEditActiveLayer && multiBox) drawSelectionBox(context, multiBox.start, multiBox.end, view);
    if (canEditActiveLayer && tool === 'multi' && selectedIds.length > 0) {
      const selectedObjects = objects.filter((object) => (
        object.layerId === activeLayerId
        && selectedIds.includes(object.id)
        && object.visible !== false
        && object.locked !== true
      ));
      if (selectedObjects.length) drawEditBox(context, groupBounds(selectedObjects), view, metersPerSquare);
    }
    if (tool === 'calib' && calibrationPoints.length > 0) {
      const end = calibrationPoints.length > 1 ? calibrationPoints[1] : calibrationHover;
      if (end) drawCalibrationGuide(context, calibrationPoints[0], end, view);
    }
  }, [
    objects,
    erasePaths,
    layers,
    activeLayerId,
    canEditActiveLayer,
    view,
    size,
    selectedId,
    selectedIds,
    multiBox,
    polyPoints,
    tool,
    color,
    lineWidth,
    dash,
    metersPerSquare,
    draftVersion,
    penSnapClosing,
    eraserSize,
    drafting,
    dimEnabled,
    dimensionObjectIds,
    calibrationPoints,
    calibrationHover,
    imageRevision,
  ]);

  const layerStatus = !activeLayer?.visible
    ? 'ซ่อนอยู่'
    : activeLayer.locked
      ? 'ล็อกอยู่'
      : 'กำลังแก้ไข';

  function updateNorthFromPointer(event: ReactPointerEvent<HTMLButtonElement>) {
    const compass = compassRef.current;
    if (!compass) return;
    const rect = compass.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const dx = event.clientX - centerX;
    const dy = event.clientY - centerY;
    if (Math.hypot(dx, dy) < 4) return;
    const degrees = (Math.atan2(dy, dx) * 180 / Math.PI + 90 + 360) % 360;
    updateProject({ north: Math.round(degrees * 10) / 10 });
  }

  function onCompassPointerDown(event: ReactPointerEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.stopPropagation();
    compassDraggingRef.current = true;
    event.currentTarget.setPointerCapture(event.pointerId);
    updateNorthFromPointer(event);
  }

  function onCompassPointerMove(event: ReactPointerEvent<HTMLButtonElement>) {
    if (!compassDraggingRef.current) return;
    event.preventDefault();
    updateNorthFromPointer(event);
  }

  function onCompassPointerUp(event: ReactPointerEvent<HTMLButtonElement>) {
    if (!compassDraggingRef.current) return;
    compassDraggingRef.current = false;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  function formatProjectDate(value: string): string {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    if (!match) return value || '—';
    return `${match[3]}/${match[2]}/${Number(match[1]) + 543}`;
  }

  const compassDirections = [
    { label: 'N', offset: 0 },
    { label: 'E', offset: 90 },
    { label: 'S', offset: 180 },
    { label: 'W', offset: 270 },
  ].map((direction) => {
    const radians = (project.north + direction.offset) * Math.PI / 180;
    const radius = 23;
    return {
      ...direction,
      x: 33 + Math.sin(radians) * radius,
      y: 33 - Math.cos(radians) * radius,
    };
  });

  return (
    <div ref={wrapRef} className="canvas-wrap">
      <canvas ref={gridRef} id="gridCanvas" />
      <canvas
        ref={drawRef}
        id="drawCanvas"
        className={`${tool === 'pan' ? 'pan-tool' : ''}${isPanning ? ' is-panning' : ''}`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onLostPointerCapture={onPointerUp}
        onWheel={onWheel}
      />

      <SelectionSizeEditor engine={engine} canvasWidth={size.w} canvasHeight={size.h} />

      <div className={`active-layer-pill${canEditActiveLayer ? '' : ' blocked'}`}>
        <span className="active-layer-dot" />
        <strong>{activeLayer?.name ?? 'Layer'}</strong>
        <small>{layerStatus}</small>
      </div>

      <button
        ref={compassRef}
        className="compass"
        title={`ลากเพื่อหมุนเข็มทิศ • เหนือ ${project.north.toFixed(1)}°`}
        aria-label={`เข็มทิศ ทิศเหนือ ${project.north.toFixed(1)} องศา`}
        onPointerDown={onCompassPointerDown}
        onPointerMove={onCompassPointerMove}
        onPointerUp={onCompassPointerUp}
        onPointerCancel={onCompassPointerUp}
      >
        <div className="compass-crosshair" />
        <div className="compass-needle" style={{ transform: `rotate(${project.north}deg)` }}><span /></div>
        {compassDirections.map((direction) => (
          <span
            key={direction.label}
            className={`compass-direction compass-${direction.label.toLowerCase()}`}
            style={{ left: direction.x, top: direction.y }}
          >
            {direction.label}
          </span>
        ))}
      </button>
      <div className="compass-hint">ลากค้างเพื่อหมุน • N/E/S/W</div>

      <label className="shopname-wrap">
        <span>ชื่อร้าน</span>
        <input
          value={project.shopName}
          onChange={(event) => updateProject({ shopName: event.target.value })}
          placeholder="ระบุชื่อร้าน"
        />
      </label>

      <div className="titleblock">
        <div className="tb-row tb-edit-row">
          <span>โครงการ</span>
          <input
            value={project.projectName}
            onChange={(event) => updateProject({ projectName: event.target.value })}
            placeholder="ชื่อโครงการ"
            aria-label="ชื่อโครงการ"
          />
        </div>
        <div className="tb-row tb-edit-row">
          <span>Application</span>
          <input
            value={project.application}
            onChange={(event) => updateProject({ application: event.target.value })}
            placeholder="เช่น งานต่อเติมร้าน"
            aria-label="Application"
          />
        </div>
        <div className="tb-row"><span>มาตราส่วน</span><strong>{scaleLabel}</strong></div>
        <div className="tb-row"><span>วันที่</span><strong>{formatProjectDate(project.createdDate)}</strong></div>
      </div>

      <div className="hint-pill show">{tool === 'calib' ? 'CALIBRATE: คลิกจุดแรก แล้วคลิกจุดที่สองบนระยะที่ทราบจริง' : tool === 'auto' ? 'AUTO DRAW: วาดคร่าว ๆ แล้วปล่อยเมาส์ • ระบบจะเดา เส้น / โค้ง / สี่เหลี่ยม / วงกลม / วงรี' : tool === 'pan' ? 'HAND: กดค้างแล้วลากเพื่อเลื่อนกระดาน • ใช้ได้ทั้งเมาส์และการสัมผัส' : dimEnabled ? 'DIM: คลิกวัตถุเพื่อเพิ่ม/เอาขนาดออก • ขนาดที่วางแล้วจะค้างอยู่' : 'ใช้ล้อเมาส์เพื่อซูม • Shift + ลากเพื่อเลื่อน'}</div>

      {canEditActiveLayer && tool === 'poly' && polyPoints.length > 0 && (
        <div className="poly-bar open">
          <button className="btn" onClick={cancelPolyline}>ยกเลิก</button>
          <button className="btn" onClick={() => finishPolyline(false)}>จบเส้น</button>
          <button className="btn primary" onClick={() => finishPolyline(true)}>ปิดรูป</button>
        </div>
      )}

      {textDialog && (
        <TextDialog dialog={textDialog} setDialog={setTextDialog} onSave={saveText} />
      )}

      {calibrationDialog && (
        <CalibrationDialog
          worldDistance={calibrationDialog.worldDistance}
          onCancel={cancelCalibration}
          onSave={saveCalibration}
        />
      )}

    </div>
  );
}
