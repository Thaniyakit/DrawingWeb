import { useState } from 'react';
import { Icon } from './Icon';
import type { useCanvasEngine } from '../hooks/useCanvasEngine';

type Engine = ReturnType<typeof useCanvasEngine>;
const checklist = ['รูปแบบร้าน','แนวเขตที่ดิน','ระยะร่นอาคาร','ค่าระดับร้าน','ร้านค้า 7-ชุมชน','ที่จอดรถ','แนวท่อน้ำทิ้ง','บ่อซึม','จุดเชื่อมทาง','วางท่อเชื่อมทาง','กำแพงกันดิน','เสา Pole Sign','เสาหม้อแปลง','เสารับสายเมน','มิเตอร์น้ำประปา','แนวรั้ว','ขอบคันหิน','จุดวางคอยล์ร้อน','ถังน้ำ','ห้องอเนกประสงค์','ข้อมูล TOPO','ร้านใกล้ชายทะเล','ร้านสู้น้ำ','ห้องน้ำร้านค้าเช่า','พื้นที่ Phase 2'];

export function RightPanel({ engine }: { engine: Engine }) {
  const [hidden, setHidden] = useState(false);
  const { objects, selectedId, setSelectedId, setObjects, project, setChecklistDone } = engine;
  const drawableObjects = objects.filter((object) => object.type !== 'erase');
  const done = checklist.map((_, index) => project.checklist[index]?.done === true);
  const completed = done.filter(Boolean).length;

  return <aside className={`right-col${hidden ? ' hidden' : ''}`}>
    <section className="check-panel"><div className="panel-head"><span>Checklist</span><small>{completed}/{checklist.length}</small></div><div className="check-list">{checklist.map((item, index) => <label className={`check-item${done[index] ? ' done' : ''}`} key={item}><input type="checkbox" checked={done[index]} onChange={() => setChecklistDone(index, !done[index])} /><span>{index + 1}) {item}</span></label>)}</div></section>
    <section className="layer-panel"><div className="panel-head"><span>Layers</span><button className="li-btn" title="ซ่อนแผง" onClick={() => setHidden(true)}><Icon name="eyeoff" size={16} /></button></div><div className="layer-list">{drawableObjects.length === 0 ? <div className="layer-empty">ยังไม่มีวัตถุบนกระดาน<br />เริ่มวาดเพื่อสร้างเลเยอร์</div> : [...drawableObjects].reverse().map((object) => <div className={`layer-item${object.id === selectedId ? ' selected' : ''}`} key={object.id} onClick={() => setSelectedId(object.id)}><span className="li-icon"><Icon name={object.type === 'stroke' ? 'pen' : object.type === 'line' ? 'line' : object.type === 'rect' ? 'rect' : object.type === 'circle' ? 'circle' : 'poly'} size={16} /></span><span className="li-name">{object.name || `${object.type} #${object.id}`}</span><span className="li-dot" style={{ background: object.color }} /><button className="li-btn" title={object.visible === false ? 'แสดง' : 'ซ่อน'} onClick={(event) => { event.stopPropagation(); setObjects((current) => current.map((item) => item.id === object.id ? { ...item, visible: item.visible === false } : item)); }}><Icon name={object.visible === false ? 'eyeoff' : 'eye'} size={15} /></button></div>)}</div></section>
    {hidden && <button className="panel-reopen" title="แสดงเลเยอร์" onClick={() => setHidden(false)}><Icon name="eye" size={16} /></button>}
  </aside>;
}
