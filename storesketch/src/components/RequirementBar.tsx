import { useState } from 'react';
import type { useCanvasEngine } from '../hooks/useCanvasEngine';
import { Icon } from './Icon';

type Engine = ReturnType<typeof useCanvasEngine>;
type Menu = 'shop' | 'around' | 'parking' | 'community' | 'other' | null;

const shopTypes = ['22.20 × 13.20 R', '19.80 × 11.70 L', '19.80 × 14.70 L', '19.80 × 11.70 R'];
const menus: Record<Exclude<Menu, 'shop' | null>, string[]> = {
  around: ['จุดวางคอยล์ร้อนแอร์', 'ห้องเก็บลัง'],
  parking: ['ตีเส้นช่องจอดรถยนต์', 'ตีเส้นช่องจอดมอเตอร์ไซค์'],
  community: ['ตีเส้นร้านเช่า', 'ผังร้านเช่า'],
  other: ['เส้นแนวรั้ว', 'กำแพงกันดิน'],
};

export function RequirementBar({ engine }: { engine: Engine }) {
  const [open, setOpen] = useState<Menu>(null);
  const { project, updateProject } = engine;
  const selected = project.requirement;

  const toggle = (menu: Menu) => setOpen((current) => current === menu ? null : menu);
  const choose = (name: string) => {
    updateProject({ requirement: name });
    setOpen(null);
  };

  const dropdown = (key: Exclude<Menu, null>, label: string, note: string) => (
    <div className="drop-wrap">
      <button className="drop-btn req-dd" onClick={() => toggle(key)}>
        <Icon name="chevron" size={14} />
        {selected && key === 'shop' ? selected : label}
      </button>
      {open === key && (
        <div className="drop-panel open">
          <div className="drop-note">{note}</div>
          {(key === 'shop' ? shopTypes : menus[key]).map((item) => (
            <button className="drop-item" key={item} onClick={() => choose(item)}>{item}</button>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <div className="reqbar" onMouseLeave={() => setOpen(null)}>
      <span className="req-label">REQUIREMENT</span>
      <span className="req-cat">ร้าน</span>
      {dropdown('shop', 'Type ร้าน', 'เลือก Type ร้าน — วางลงกระดานตามมาตราส่วนจริง')}
      {dropdown('around', 'รอบร้าน', 'รอบร้าน — เลือกรายการที่ต้องตรวจสอบ')}
      <span className="req-cat">ภายนอกร้าน</span>
      {dropdown('parking', 'ลานจอด', 'ลานจอด — เลือกรายการที่ต้องตรวจสอบ')}
      {dropdown('community', '7-ชุมชน', '7-ชุมชน — เลือกรายการที่ต้องตรวจสอบ')}
      {dropdown('other', 'อื่นๆ', 'อื่นๆ — เลือกใช้ได้เลย')}
    </div>
  );
}
