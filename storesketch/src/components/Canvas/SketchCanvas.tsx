import { useEffect, useRef, useState } from 'react';
import type { SketchObject, SketchObjectStyle } from '../../types';
import { drawGrid, drawObjects } from '../../engine/render';
import { groupBounds } from '../../engine/bounds';
import { drawCalibrationGuide, drawEditBox, drawEraserPreview, drawObjectDimensions, drawPolyPoints, drawSelectionBox, drawSnapCloseHint } from '../../engine/overlays';
import { buildDragShape } from '../../engine/shapes';
import { useCanvasInteraction } from '../../hooks/useCanvasInteraction';
import type { useCanvasEngine } from '../../hooks/useCanvasEngine';
import { TextDialog } from './TextDialog';
import { CalibrationDialog } from './CalibrationDialog';
import { AutoDrawDialog } from './AutoDrawDialog';

type Engine = ReturnType<typeof useCanvasEngine>;

export function SketchCanvas({ engine }: { engine: Engine }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLCanvasElement>(null);
  const drawRef = useRef<HTMLCanvasElement>(null);
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
    scale,
    metersPerSquare,
    isCalibrated,
    setCanvasViewportSize,
    createAutoRectangle,
    setTool,
    eraserSize,
    dimEnabled,
    dimensionObjectIds,
    project,
    updateProject,
  } = engine;

  const interaction = useCanvasInteraction(engine, drawRef);
  const {
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
      if (draft.tool === 'pen') {
        const previewPoints = penSnapClosing
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

    drawObjects(
      context,
      renderObjects,
      view,
      size.w,
      size.h,
      selectedId,
      selectedIds,
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

      <div className={`active-layer-pill${canEditActiveLayer ? '' : ' blocked'}`}>
        <span className="active-layer-dot" />
        <strong>{activeLayer?.name ?? 'Layer'}</strong>
        <small>{layerStatus}</small>
      </div>

      <button
        className="compass"
        title="หมุนทิศเหนือ"
        onClick={() => updateProject({ north: (project.north + 15) % 360 })}
      >
        <div className="compass-needle" style={{ transform: `rotate(${project.north}deg)` }}>N</div>
      </button>
      <div className="compass-hint">ลากเพื่อหมุนทิศ</div>

      <label className="shopname-wrap">
        <span>ชื่อร้าน</span>
        <input
          value={project.shopName}
          onChange={(event) => updateProject({ shopName: event.target.value })}
          placeholder="ระบุชื่อร้าน"
        />
      </label>

      <div className="titleblock">
        <div className="tb-row"><span>PROJECT</span><strong>STORE SKETCH</strong></div>
        <div className="tb-row"><span>SCALE</span><strong>{isCalibrated ? 'CALIBRATED' : `1:${scale}`}</strong></div>
        <div className="tb-row"><span>GRID</span><strong>24 px</strong></div>
      </div>

      <div className="hint-pill show">{tool === 'calib' ? 'CALIBRATE: คลิกจุดแรก แล้วคลิกจุดที่สองบนระยะที่ทราบจริง' : dimEnabled ? 'DIM: คลิกวัตถุเพื่อเพิ่ม/เอาขนาดออก • ขนาดที่วางแล้วจะค้างอยู่' : 'ใช้ล้อเมาส์เพื่อซูม • Shift + ลากเพื่อเลื่อน'}</div>

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

      {tool === 'auto' && (
        <AutoDrawDialog
          onCancel={() => setTool('select')}
          onCreate={(widthMeters, heightMeters) => {
            createAutoRectangle(widthMeters, heightMeters);
            setTool('select');
          }}
        />
      )}
    </div>
  );
}
