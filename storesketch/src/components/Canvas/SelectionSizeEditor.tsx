import { useEffect, useMemo, useState } from 'react';
import type { SketchObject } from '../../types';
import { GRID_PX } from '../../engine/constants';
import { getTextSize, groupBounds, objectBounds } from '../../engine/bounds';
import { worldToScreen } from '../../engine/geometry';
import type { useCanvasEngine } from '../../hooks/useCanvasEngine';

type Engine = ReturnType<typeof useCanvasEngine>;

type SizeWorld = { width: number; height: number };

function editableObjectSizeWorld(object: SketchObject): SizeWorld {
  if (object.type === 'rect' || object.type === 'image') {
    return { width: Math.abs(object.x2 - object.x1), height: Math.abs(object.y2 - object.y1) };
  }
  if (object.type === 'circle') {
    return {
      width: Math.max(0, (object.rx ?? object.r ?? 0) * 2),
      height: Math.max(0, (object.ry ?? object.r ?? 0) * 2),
    };
  }
  if (object.type === 'text') return getTextSize(object);
  const bounds = objectBounds(object);
  return { width: Math.abs(bounds.right - bounds.left), height: Math.abs(bounds.bottom - bounds.top) };
}

function formatNumber(value: number): string {
  if (!Number.isFinite(value)) return '0.00';
  return value.toFixed(2);
}

export function SelectionSizeEditor({ engine, canvasWidth, canvasHeight }: { engine: Engine; canvasWidth: number; canvasHeight: number }) {
  const {
    objects,
    selectedObjectIds,
    view,
    metersPerSquare,
    canEditActiveLayer,
    resizeSelectedObjectsToMeters,
  } = engine;
  const [open, setOpen] = useState(false);
  const [widthText, setWidthText] = useState('');
  const [heightText, setHeightText] = useState('');
  const [lastEdited, setLastEdited] = useState<'width' | 'height'>('width');
  const [error, setError] = useState('');

  const selectedObjects = useMemo(
    () => objects.filter((object) => selectedObjectIds.includes(object.id)),
    [objects, selectedObjectIds],
  );

  const info = useMemo(() => {
    if (!selectedObjects.length || !canEditActiveLayer) return null;
    const frame = groupBounds(selectedObjects);
    const sizeWorld = selectedObjects.length === 1
      ? editableObjectSizeWorld(selectedObjects[0])
      : { width: frame.right - frame.left, height: frame.bottom - frame.top };
    const widthMeters = sizeWorld.width / GRID_PX * metersPerSquare;
    const heightMeters = sizeWorld.height / GRID_PX * metersPerSquare;
    const topLeft = worldToScreen({ x: frame.left, y: frame.top }, view);
    const bottomRight = worldToScreen({ x: frame.right, y: frame.bottom }, view);
    const padding = selectedObjects.length === 1 && selectedObjects[0].type === 'text'
      ? 0
      : selectedObjects.length > 1 ? 7 : Math.max(5, (selectedObjects[0]?.width ?? 1) * view.s + 2);
    const centerX = (topLeft.x + bottomRight.x) / 2;
    const proposedTop = topLeft.y - padding - 59;
    return {
      widthMeters,
      heightMeters,
      centerX: Math.max(78, Math.min(Math.max(78, canvasWidth - 78), centerX)),
      top: Math.max(5, Math.min(Math.max(5, canvasHeight - 36), proposedTop)),
      textLike: selectedObjects.length === 1 && selectedObjects[0].type === 'text',
      count: selectedObjects.length,
    };
  }, [canEditActiveLayer, canvasHeight, canvasWidth, metersPerSquare, selectedObjects, view]);

  const selectionKey = selectedObjectIds.join(',');
  useEffect(() => {
    setOpen(false);
    setError('');
  }, [selectionKey]);

  useEffect(() => {
    if (!info || open) return;
    setWidthText(formatNumber(info.widthMeters));
    setHeightText(formatNumber(info.heightMeters));
  }, [info, open]);

  if (!info) return null;

  function openEditor() {
    setWidthText(formatNumber(info!.widthMeters));
    setHeightText(formatNumber(info!.heightMeters));
    setError('');
    setOpen(true);
  }

  function apply() {
    const width = Number(widthText);
    const height = Number(heightText);
    if (!Number.isFinite(width) || !Number.isFinite(height) || width < 0 || height < 0) {
      setError('กรุณากรอกขนาดเป็นตัวเลข 0 ขึ้นไป');
      return;
    }
    const lineLike = selectedObjects.length === 1
      && (selectedObjects[0].type === 'line' || selectedObjects[0].type === 'measure');
    if ((!lineLike && (width <= 0 || height <= 0)) || (lineLike && width === 0 && height === 0)) {
      setError(lineLike ? 'เส้นต้องมีความกว้างหรือความสูงอย่างน้อย 1 ค่า' : 'ความกว้างและความยาวต้องมากกว่า 0');
      return;
    }
    resizeSelectedObjectsToMeters(width, height, lastEdited);
    setOpen(false);
    setError('');
  }

  return (
    <div
      className="selection-size-anchor"
      style={{ left: info.centerX, top: info.top }}
      onPointerDown={(event) => event.stopPropagation()}
      onPointerMove={(event) => event.stopPropagation()}
      onPointerUp={(event) => event.stopPropagation()}
    >
      <button
        type="button"
        className="selection-size-label"
        title="คลิกเพื่อกรอกขนาดแบบละเอียด"
        onClick={() => open ? setOpen(false) : openEditor()}
      >
        {formatNumber(info.widthMeters)} × {formatNumber(info.heightMeters)} ม.
        <span aria-hidden="true">✎</span>
      </button>

      {open && (
        <form className="selection-size-popover" onSubmit={(event) => { event.preventDefault(); apply(); }}>
          <div className="selection-size-head">
            <strong>กำหนดขนาด</strong>
            <small>{info.count > 1 ? `${info.count} วัตถุ` : 'วัตถุที่เลือก'}</small>
          </div>
          <label>
            <span>กว้าง</span>
            <div><input autoFocus inputMode="decimal" value={widthText} onChange={(event) => { setWidthText(event.target.value); setLastEdited('width'); setError(''); }} /><b>ม.</b></div>
          </label>
          <label>
            <span>ยาว</span>
            <div><input inputMode="decimal" value={heightText} onChange={(event) => { setHeightText(event.target.value); setLastEdited('height'); setError(''); }} /><b>ม.</b></div>
          </label>
          {info.textLike && <p>ข้อความจะรักษาสัดส่วนตัวอักษร โดยอิงค่าช่องที่แก้ล่าสุด</p>}
          {info.count > 1 && <p>หลายวัตถุจะย่อ/ขยายทั้งกลุ่มจากจุดกึ่งกลาง เหมือนลากกรอบ Resize</p>}
          {error && <div className="selection-size-error">{error}</div>}
          <div className="selection-size-actions">
            <button type="button" onClick={() => setOpen(false)}>ยกเลิก</button>
            <button type="submit" className="primary">ปรับขนาด</button>
          </div>
        </form>
      )}
    </div>
  );
}
