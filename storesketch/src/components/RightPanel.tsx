import { useMemo, useState } from 'react';
import { Icon } from './Icon';
import { LayerPanel } from './Layers/LayerPanel';
import type { useCanvasEngine } from '../hooks/useCanvasEngine';

type Engine = ReturnType<typeof useCanvasEngine>;
const checklist = ['รูปแบบร้าน','แนวเขตที่ดิน','ระยะร่นอาคาร','ค่าระดับร้าน','ร้านค้า 7-ชุมชน','ที่จอดรถ','แนวท่อน้ำทิ้ง','บ่อซึม','จุดเชื่อมทาง','วางท่อเชื่อมทาง','กำแพงกันดิน','เสา Pole Sign','เสาหม้อแปลง','เสารับสายเมน','มิเตอร์น้ำประปา','แนวรั้ว','ขอบคันหิน','จุดวางคอยล์ร้อน','ถังน้ำ','ห้องอเนกประสงค์','ข้อมูล TOPO','ร้านใกล้ชายทะเล','ร้านสู้น้ำ','ห้องน้ำร้านค้าเช่า','พื้นที่ Phase 2'];

export function RightPanel({ engine }: { engine: Engine }) {
  const [collapsed, setCollapsed] = useState(false);
  const {
    project,
    setChecklistDone,
    objects,
    selectedObjectIds,
    beginSelectedStyleEdit,
    endSelectedStyleEdit,
    updateSelectedOpacity,
  } = engine;

  const done = checklist.map((_, index) => project.checklist[index]?.done === true);
  const completed = done.filter(Boolean).length;
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

  if (collapsed) {
    return (
      <aside className="right-col collapsed" aria-label="แถบด้านขวาถูกย่อ">
        <button className="right-panel-expand" title="เปิดแถบด้านขวา" onClick={() => setCollapsed(false)}>
          <Icon name="chevron" size={17} />
        </button>
      </aside>
    );
  }

  return (
    <aside className="right-col">
      <div className="right-panel-topbar">
        <span>Properties / Layers</span>
        <button className="li-btn right-panel-collapse" title="ย่อแถบด้านขวา" onClick={() => setCollapsed(true)}>
          <Icon name="chevron" size={16} />
        </button>
      </div>

      <section className="object-properties-panel">
        <div className="panel-head">
          <span>Object Properties</span>
          <small>{selectedObjects.length ? `${selectedObjects.length} selected` : '—'}</small>
        </div>
        {selectedObjects.length ? (
          <div className="object-properties-body">
            <div className="property-label-row">
              <label htmlFor="object-transparency">Transparency</label>
              <span>{mixedTransparency ? 'หลายค่า' : `${selectedTransparency}%`}</span>
            </div>
            <div className="transparency-controls">
              <input
                id="object-transparency"
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
              <div className="transparency-number-wrap">
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
            </div>
            <div className="property-note">0% = ทึบ • 100% = โปร่งใสทั้งหมด</div>
          </div>
        ) : (
          <div className="property-empty">เลือก Object บน Layer ที่กำลังแก้ไข เพื่อปรับ Transparency</div>
        )}
      </section>

      <section className="check-panel">
        <div className="panel-head"><span>Checklist</span><small>{completed}/{checklist.length}</small></div>
        <div className="check-list">
          {checklist.map((item, index) => (
            <label className={`check-item${done[index] ? ' done' : ''}`} key={item}>
              <input
                type="checkbox"
                checked={done[index]}
                onChange={() => setChecklistDone(index, !done[index])}
              />
              <span>{index + 1}) {item}</span>
            </label>
          ))}
        </div>
      </section>

      <LayerPanel engine={engine} onHide={() => setCollapsed(true)} />
    </aside>
  );
}
