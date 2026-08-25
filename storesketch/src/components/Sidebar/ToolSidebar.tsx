import { useEffect, useMemo, useState } from 'react';
import type { ToolType } from '../../types';
import { SCALE_OPTIONS, SWATCHES } from '../../engine/constants';
import type { useCanvasEngine } from '../../hooks/useCanvasEngine';
import { Icon } from '../Icon';

type Engine = ReturnType<typeof useCanvasEngine>;

const TOOLS: { id: ToolType; label: string; icon: Parameters<typeof Icon>[0]['name'] }[] = [
  { id: 'select', label: 'เลือก', icon: 'pointer' }, { id: 'pan', label: 'มือ / เลื่อนกระดาน', icon: 'hand' }, { id: 'multi', label: 'เลือกหลายชิ้น', icon: 'multi' }, { id: 'pen', label: 'ปากกา', icon: 'pen' },
  { id: 'auto', label: 'วาดอัตโนมัติ', icon: 'wand' }, { id: 'line', label: 'เส้นตรง', icon: 'line' }, { id: 'rect', label: 'สี่เหลี่ยม', icon: 'rect' },
  { id: 'circle', label: 'วงกลม', icon: 'circle' }, { id: 'poly', label: 'โพลีไลน์', icon: 'poly' }, { id: 'curve', label: 'เส้นโค้ง', icon: 'curve' },
  { id: 'measure', label: 'วัดระยะ', icon: 'ruler' }, { id: 'calib', label: 'สอบเทียบ', icon: 'calib' }, { id: 'text', label: 'ข้อความ', icon: 'text' },
  { id: 'eraser', label: 'ยางลบ', icon: 'eraser' }, { id: 'objeraser', label: 'ลบวัตถุ', icon: 'trash' },
];

const TOOL_SHORTCUTS: Partial<Record<ToolType, string>> = {
  select: 'V', pan: 'H', multi: 'M', pen: 'P', line: 'L', rect: 'R', circle: 'C',
  poly: 'Q', curve: 'B', measure: 'D', text: 'T', eraser: 'E', objeraser: 'X',
};

function colorToHex(value: string): string {
  const input = value.trim();
  const shortHex = /^#([0-9a-f]{3})$/i.exec(input);
  if (shortHex) return `#${shortHex[1].split('').map((char) => char + char).join('')}`.toLowerCase();
  if (/^#[0-9a-f]{6}$/i.test(input)) return input.toLowerCase();

  const rgb = /^rgba?\(\s*([\d.]+)%?\s*,\s*([\d.]+)%?\s*,\s*([\d.]+)%?/i.exec(input);
  if (rgb) {
    const percentage = input.includes('%');
    const channels = rgb.slice(1, 4).map((channel) => {
      const numeric = Number(channel);
      const value255 = percentage ? numeric * 2.55 : numeric;
      return Math.max(0, Math.min(255, Math.round(value255)));
    });
    return `#${channels.map((channel) => channel.toString(16).padStart(2, '0')).join('')}`;
  }

  if (typeof document !== 'undefined') {
    const context = document.createElement('canvas').getContext('2d');
    if (context) {
      context.fillStyle = '#000000';
      context.fillStyle = input;
      const normalized = String(context.fillStyle);
      if (/^#[0-9a-f]{6}$/i.test(normalized)) return normalized.toLowerCase();
    }
  }
  return '#14181d';
}

function isValidCssColor(value: string): boolean {
  if (!value.trim()) return false;
  if (typeof CSS !== 'undefined' && typeof CSS.supports === 'function') {
    return CSS.supports('color', value.trim());
  }
  return /^#[0-9a-f]{3,8}$/i.test(value.trim()) || /^rgba?\(/i.test(value.trim());
}

export function ToolSidebar({ engine }: { engine: Engine }) {
  const { tool, setTool, color, setColor, lineWidth, setLineWidth, dash, setDash, eraserSize, setEraserSize,
    snapEnabled, setSnapEnabled, snapLineEnabled, setSnapLineEnabled,
    dimEnabled, setDimEnabled, dimensionObjectIds, clearDimensions, gridVisible, setGridVisible,
    scale, setScale, metersPerSquare, scaleLabel, isCalibrated, clearCalibration, undo, redo, clearAll, canUndo, canRedo,
    objects, selectedObjectIds, beginSelectedStyleEdit, endSelectedStyleEdit, updateSelectedOpacity } = engine;

  const [colorText, setColorText] = useState(color);
  const [colorError, setColorError] = useState(false);

  const selectedObjects = useMemo(
    () => objects.filter((object) => selectedObjectIds.includes(object.id)),
    [objects, selectedObjectIds],
  );
  const selectedTransparency = selectedObjects.length
    ? Math.round((1 - (selectedObjects[0].opacity ?? 1)) * 100)
    : 0;
  const mixedTransparency = selectedObjects.some((object) => (
    Math.round((1 - (object.opacity ?? 1)) * 100) !== selectedTransparency
  ));

  useEffect(() => {
    setColorText(color);
    setColorError(false);
  }, [color]);

  function applyColorText() {
    const next = colorText.trim();
    if (!isValidCssColor(next)) {
      setColorError(true);
      return;
    }
    setColor(next);
    setColorError(false);
  }

  function confirmClearAll() {
    if (!objects.length) return;
    if (window.confirm('คุณต้องการล้างทั้งหมดใช่หรือไม่')) clearAll();
  }

  return (
    <aside className="side">
	  <div className="side-sec">
		<div className="side-lbl">มาตราส่วน</div>
        <select
          className="sel"
          value={isCalibrated ? 'calibrated' : String(scale)}
          onChange={(event) => {
            if (event.target.value !== 'calibrated') setScale(Number(event.target.value));
          }}
        >
          {isCalibrated && <option value="calibrated">{scaleLabel} (สอบเทียบ)</option>}
          {SCALE_OPTIONS.map((s) => <option key={s} value={s}>1:{s}</option>)}
        </select>
        {isCalibrated && (
          <div className="calibration-status">
            <div><strong>{scaleLabel}</strong><span>{metersPerSquare.toFixed(4)} ม./ช่อง</span></div>
            <button className="mini-action" onClick={clearCalibration}>กลับไปใช้ 1:{scale}</button>
          </div>
        )}
	  </div>
      <div className="side-sec">
        <h4>เครื่องมือ</h4>
        <div className="tool-grid">
          {TOOLS.map((t) => (
            <button
              key={t.id}
              className={`tool-btn${tool === t.id ? ' active' : ''}`}
              title={TOOL_SHORTCUTS[t.id] ? `${t.label} (${TOOL_SHORTCUTS[t.id]})` : t.label}
              onClick={() => { setTool(t.id); if (dimEnabled) setDimEnabled(false); }}
            >
              <Icon name={t.icon} />
            </button>
          ))}
        </div>

        <div className="assist-grid" aria-label="ตัวช่วยการวาด">
          <button className={`assist-btn${gridVisible ? ' on' : ''}`} onClick={() => setGridVisible(!gridVisible)} title="ตาราง: แสดงกริดและระยะตามมาตราส่วน">
            <Icon name="grid" size={16} /><span>ตาราง</span>
          </button>
          <button className={`assist-btn${snapEnabled ? ' on' : ''}`} onClick={() => setSnapEnabled(!snapEnabled)} title="ล็อกจุด: บังคับจุดวาดให้อยู่บนกริด">
            <Icon name="snap" size={16} /><span>ล็อกจุด</span>
          </button>
          <button className={`assist-btn${snapLineEnabled ? ' on' : ''}`} onClick={() => setSnapLineEnabled(!snapLineEnabled)} title="Snap เส้น: ปิดเส้นปากกาเมื่อปลายเข้าใกล้จุดเริ่ม">
            <Icon name="osnap" size={16} /><span>Snap เส้น</span>
          </button>
          <button className={`assist-btn${dimEnabled ? ' on dim-on' : ''}`} onClick={() => setDimEnabled(!dimEnabled)} title="Dim: คลิกวัตถุเพื่อเพิ่ม/เอาเส้นบอกขนาดออก">
            <Icon name="ruler" size={16} /><span>Dim</span>
          </button>
        </div>
        {dimensionObjectIds.length > 0 && (
          <button className="dim-clear-btn" onClick={clearDimensions} title="ล้าง Dimension ที่วางไว้ทั้งหมด">
            ล้าง Dim ({dimensionObjectIds.length})
          </button>
        )}
      </div>

      {tool === 'eraser' && <div className="side-sec eraser-settings">
        <div className="side-lbl">ยางลบ (px)</div>
        <input className="sel eraser-input" type="number" min="1" step="1" inputMode="numeric" value={eraserSize} onChange={(event) => setEraserSize(Math.max(1, Number(event.target.value) || 1))} />
      </div>}

      <div className="side-sec">
        <h4>Control</h4>
        <div className="tool-grid">
          <button className="tool-btn" disabled={!canUndo} onClick={undo} title="เลิกทำ (Ctrl/Cmd+Z)"><Icon name="undo" /></button>
          <button className="tool-btn" disabled={!canRedo} onClick={redo} title="ทำซ้ำ (Ctrl/Cmd+Shift+Z หรือ Ctrl/Cmd+Y)"><Icon name="redo" /></button>
          <button className="tool-btn" onClick={confirmClearAll} title="ล้าง Object ทั้งหมดในหน้านี้"><Icon name="clear" /></button>
        </div>
        
      </div>

      <div className="side-sec">
        <h4>Add / Edit</h4>
        <div className="side-lbl">สีเส้น</div>
        <div className="color-current-row">
          <input
            className="color-picker-circle"
            type="color"
            aria-label="เลือกสีแบบอิสระ"
            title="เลือกสีแบบอิสระ"
            value={colorToHex(color)}
            onChange={(event) => setColor(event.target.value)}
          />
          <span className="color-current-value" title={color}>{color}</span>
        </div>
        <div className="tray-grid color-swatches">
          {SWATCHES.map((sw) => (
            <button
              key={sw}
              className={`tray-sw${colorToHex(color) === sw.toLowerCase() ? ' active' : ''}`}
              style={{ background: sw }}
              title={sw}
              onClick={() => setColor(sw)}
            />
          ))}
        </div>
        <div className="side-lbl">HEX / RGB</div>
        <input
          className={`sel color-text-input${colorError ? ' invalid' : ''}`}
          value={colorText}
          placeholder="rgb(20, 80, 120)"
          onChange={(event) => { setColorText(event.target.value); setColorError(false); }}
          onBlur={applyColorText}
          onKeyDown={(event) => {
            if (event.key === 'Enter') event.currentTarget.blur();
            if (event.key === 'Escape') { setColorText(color); setColorError(false); event.currentTarget.blur(); }
          }}
        />
        {colorError && <div className="field-error">รูปแบบสีไม่ถูกต้อง</div>}

        <div className="side-lbl">ความหนาเส้น (px)</div>
        <input
          className="sel line-width-input"
          type="number"
          min="0.5"
          max="50"
          step="0.5"
          value={lineWidth}
          onChange={(event) => setLineWidth(Math.max(0.5, Math.min(50, Number(event.target.value) || 0.5)))}
        />

        <div className="side-lbl">รูปแบบเส้น</div>
        <select className="sel" value={dash} onChange={(e) => setDash(e.target.value as typeof dash)}>
          <option value="solid">── ทึบ</option>
          <option value="dash">╌╌ ประ</option>
          <option value="dot">·· จุด</option>
          <option value="dashdot">╌· ประ-จุด</option>
        </select>
      </div>

      <div className="side-sec transparency-side-sec">
        <h4>Object</h4>
        <div className="side-lbl transparency-side-label">
          <span>โปร่งใส</span>
          <strong>{selectedObjects.length ? (mixedTransparency ? 'หลายค่า' : `${selectedTransparency}%`) : '—'}</strong>
        </div>
        {selectedObjects.length ? (
          <>
            <input
              className="transparency-side-range"
              type="range"
              min="0"
              max="100"
              step="1"
              value={selectedTransparency}
              onPointerDown={beginSelectedStyleEdit}
              onPointerUp={endSelectedStyleEdit}
              onFocus={beginSelectedStyleEdit}
              onBlur={endSelectedStyleEdit}
              onChange={(event) => updateSelectedOpacity(Number(event.target.value))}
            />
            <div className="transparency-side-number">
              <input
                type="number"
                min="0"
                max="100"
                step="1"
                value={selectedTransparency}
                onFocus={beginSelectedStyleEdit}
                onBlur={endSelectedStyleEdit}
                onChange={(event) => updateSelectedOpacity(Math.max(0, Math.min(100, Number(event.target.value) || 0)))}
              />
              <span>%</span>
            </div>
            <div className="transparency-side-note">0 = ทึบ • 100 = ใส</div>
          </>
        ) : (
          <div className="transparency-side-note">เลือก Object ก่อนปรับค่า</div>
        )}
      </div>
    </aside>
  );
}
