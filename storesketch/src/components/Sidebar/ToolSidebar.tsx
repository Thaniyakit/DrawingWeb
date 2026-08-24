import type { ToolType } from '../../types';
import { SCALE_OPTIONS, SWATCHES } from '../../engine/constants';
import type { useCanvasEngine } from '../../hooks/useCanvasEngine';
import { Icon } from '../Icon';

type Engine = ReturnType<typeof useCanvasEngine>;

const TOOLS: { id: ToolType; label: string; icon: Parameters<typeof Icon>[0]['name'] }[] = [
  { id: 'select', label: 'เลือก', icon: 'pointer' }, { id: 'multi', label: 'เลือกหลายชิ้น', icon: 'multi' }, { id: 'pen', label: 'ปากกา', icon: 'pen' },
  { id: 'auto', label: 'วาดอัตโนมัติ', icon: 'wand' }, { id: 'line', label: 'เส้นตรง', icon: 'line' }, { id: 'rect', label: 'สี่เหลี่ยม', icon: 'rect' },
  { id: 'circle', label: 'วงกลม', icon: 'circle' }, { id: 'poly', label: 'โพลีไลน์', icon: 'poly' }, { id: 'curve', label: 'เส้นโค้ง', icon: 'curve' },
  { id: 'measure', label: 'วัดระยะ', icon: 'ruler' }, { id: 'calib', label: 'สอบเทียบ', icon: 'calib' }, { id: 'text', label: 'ข้อความ', icon: 'text' },
  { id: 'eraser', label: 'ยางลบ', icon: 'eraser' }, { id: 'objeraser', label: 'ลบวัตถุ', icon: 'trash' },
];

export function ToolSidebar({ engine }: { engine: Engine }) {
  const { tool, setTool, color, setColor, dash, setDash, eraserSize, setEraserSize,
    snapEnabled, setSnapEnabled, gridVisible, setGridVisible,
    scale, setScale, undo, redo, clearAll, canUndo, canRedo } = engine;

  return (
    <aside className="side">
      <div className="side-sec">
        <h4>เครื่องมือ</h4>
        <div className="tool-grid">
          {TOOLS.map((t) => (
            <button
              key={t.id}
              className={`tool-btn${tool === t.id ? ' active' : ''}`}
              title={t.label}
              onClick={() => setTool(t.id)}
            >
              <Icon name={t.icon} />
            </button>
          ))}
        </div>
      </div>

      {tool === 'eraser' && <div className="side-sec eraser-settings">
        <div className="side-lbl">ยางลบ (px)</div>
        <input className="sel eraser-input" type="number" min="1" step="1" inputMode="numeric" value={eraserSize} onChange={(event) => setEraserSize(Math.max(1, Number(event.target.value) || 1))} />
      </div>}

      <div className="side-sec">
        <h4>Control</h4>
        <div className="tool-grid">
          <button className="tool-btn" disabled={!canUndo} onClick={undo} title="เลิกทำ"><Icon name="undo" /></button>
          <button className="tool-btn" disabled={!canRedo} onClick={redo} title="ทำซ้ำ"><Icon name="redo" /></button>
          <button className="tool-btn" onClick={clearAll} title="ล้างทั้งหมด"><Icon name="clear" /></button>
        </div>
        <div className="side-lbl">มาตราส่วน</div>
        <select className="sel" value={scale} onChange={(e) => setScale(Number(e.target.value))}>
          {SCALE_OPTIONS.map((s) => <option key={s} value={s}>1:{s}</option>)}
        </select>
        <button className={`toggle-btn${gridVisible ? ' on' : ''}`} onClick={() => setGridVisible(!gridVisible)}><Icon name="grid" size={15} />ตาราง</button>
        <button className={`toggle-btn${snapEnabled ? ' on' : ''}`} onClick={() => setSnapEnabled(!snapEnabled)}><Icon name="snap" size={15} />ล็อกจุด</button>
      </div>

      <div className="side-sec">
        <h4>Add / Edit</h4>
        <div className="tray-grid">
          {SWATCHES.map((sw) => (
            <button
              key={sw}
              className={`tray-sw${color === sw ? ' active' : ''}`}
              style={{ background: sw }}
              onClick={() => setColor(sw)}
            />
          ))}
        </div>
        <div className="side-lbl">รูปแบบเส้น</div>
        <select className="sel" value={dash} onChange={(e) => setDash(e.target.value as typeof dash)}>
          <option value="solid">── ทึบ</option>
          <option value="dash">╌╌ ประ</option>
          <option value="dot">·· จุด</option>
          <option value="dashdot">╌· ประ-จุด</option>
        </select>
      </div>
    </aside>
  );
}
