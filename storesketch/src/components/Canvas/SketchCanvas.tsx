import { useEffect, useRef, useState } from 'react';
import type { SketchObject, SketchObjectStyle } from '../../types';
import { drawGrid, drawObjects } from '../../engine/render';
import { groupBounds } from '../../engine/bounds';
import { drawEditBox, drawEraserPreview, drawPolyPoints, drawSelectionBox } from '../../engine/overlays';
import { buildDragShape, scaleToMetersPerSquare } from '../../engine/shapes';
import { useCanvasInteraction } from '../../hooks/useCanvasInteraction';
import type { useCanvasEngine } from '../../hooks/useCanvasEngine';
import { TextDialog } from './TextDialog';

type Engine = ReturnType<typeof useCanvasEngine>;

export function SketchCanvas({ engine }: { engine: Engine }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLCanvasElement>(null);
  const drawRef = useRef<HTMLCanvasElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });

  const {
    objects,
    erasePaths,
    view,
    tool,
    color,
    lineWidth,
    dash,
    selectedId,
    selectedIds,
    gridVisible,
    scale,
    eraserSize,
    project,
    updateProject,
  } = engine;

  const interaction = useCanvasInteraction(engine, drawRef);
  const {
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
  } = interaction;

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
    const canvas = gridRef.current;
    const context = canvas?.getContext('2d');
    if (!canvas || !context) return;
    canvas.width = size.w;
    canvas.height = size.h;

    if (gridVisible) {
      drawGrid(context, view, size.w, size.h, scaleToMetersPerSquare(scale));
    } else {
      context.clearRect(0, 0, size.w, size.h);
      context.fillStyle = '#FFFFFF';
      context.fillRect(0, 0, size.w, size.h);
    }
  }, [view, size, gridVisible, scale]);

  useEffect(() => {
    const canvas = drawRef.current;
    const context = canvas?.getContext('2d');
    if (!canvas || !context) return;
    canvas.width = size.w;
    canvas.height = size.h;

    const previewStyle: SketchObjectStyle = { id: -1, color, width: lineWidth, dash };
    let renderObjects: SketchObject[] = polyPoints.length > 1
      ? [...objects, { ...previewStyle, type: 'poly', points: polyPoints }]
      : objects;

    const draft = drafting.current;
    if (draft && draft.points.length > 1) {
      if (draft.tool === 'pen') {
        renderObjects = [...renderObjects, { ...previewStyle, type: 'stroke', points: draft.points }];
      } else if (draft.tool !== 'eraser') {
        const end = draft.points[draft.points.length - 1];
        renderObjects = [...renderObjects, buildDragShape(draft.tool, draft.start, end, previewStyle)];
      }
    }

    const metersPerSquare = scaleToMetersPerSquare(scale);
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
    );

    if (draft?.tool === 'eraser' && draft.points.length > 1) {
      drawEraserPreview(context, draft.points, view, eraserSize);
    }
    if (tool === 'poly' && polyPoints.length) drawPolyPoints(context, polyPoints, view);
    if (multiBox) drawSelectionBox(context, multiBox.start, multiBox.end, view);
    if (tool === 'multi' && selectedIds.length > 0) {
      const selectedObjects = objects.filter((object) => selectedIds.includes(object.id));
      if (selectedObjects.length) drawEditBox(context, groupBounds(selectedObjects), view, metersPerSquare);
    }
  }, [
    objects,
    erasePaths,
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
    scale,
    draftVersion,
    eraserSize,
    drafting,
  ]);

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
        <div className="tb-row"><span>SCALE</span><strong>1:{Math.round(100 / view.s)}</strong></div>
        <div className="tb-row"><span>GRID</span><strong>24 px</strong></div>
      </div>

      <div className="hint-pill show">ใช้ล้อเมาส์เพื่อซูม • Shift + ลากเพื่อเลื่อน</div>

      {tool === 'poly' && polyPoints.length > 0 && (
        <div className="poly-bar open">
          <button className="btn" onClick={cancelPolyline}>ยกเลิก</button>
          <button className="btn" onClick={() => finishPolyline(false)}>จบเส้น</button>
          <button className="btn primary" onClick={() => finishPolyline(true)}>ปิดรูป</button>
        </div>
      )}

      {textDialog && (
        <TextDialog dialog={textDialog} setDialog={setTextDialog} onSave={saveText} />
      )}
    </div>
  );
}
