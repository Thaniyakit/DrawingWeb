import { useEffect, useState } from 'react';
import type { useCanvasEngine } from '../hooks/useCanvasEngine';
import { STORE_PRESETS, type StorePreset } from '../templates/storePresets';
import { Icon } from './Icon';

type Engine = ReturnType<typeof useCanvasEngine>;
type Menu = 'shop' | 'around' | 'parking' | 'community' | 'other' | null;

const menus: Record<Exclude<Menu, 'shop' | null>, string[]> = {
  around: ['จุดวางคอยล์ร้อนแอร์', 'ห้องเก็บลัง'],
  parking: ['ตีเส้นช่องจอดรถยนต์', 'ตีเส้นช่องจอดมอเตอร์ไซค์'],
  community: ['ตีเส้นร้านเช่า', 'ผังร้านเช่า'],
  other: ['เส้นแนวรั้ว', 'กำแพงกันดิน'],
};

export function RequirementBar({ engine }: { engine: Engine }) {
  const [open, setOpen] = useState<Menu>(null);
  const [placingPreset, setPlacingPreset] = useState<string | null>(null);
  const { project, updateProject, placeStorePreset, canEditActiveLayer } = engine;
  const selected = project.requirement;

  useEffect(() => {
    const closeOnOutsidePointer = (event: PointerEvent) => {
      const target = event.target;
      if (target instanceof Element && target.closest('.reqbar')) return;
      setOpen(null);
    };
    document.addEventListener('pointerdown', closeOnOutsidePointer);
    return () => document.removeEventListener('pointerdown', closeOnOutsidePointer);
  }, []);

  const toggle = (menu: Menu) => setOpen((current) => current === menu ? null : menu);

  function chooseRequirement(name: string) {
    updateProject({ requirement: name });
    setOpen(null);
  }

  function chooseStorePreset(preset: StorePreset) {
    updateProject({ requirement: preset.name });
    setOpen(null);
    if (!canEditActiveLayer) return;

    setPlacingPreset(preset.key);
    const image = new Image();
    image.onload = () => {
      placeStorePreset(preset.src, image.naturalWidth, image.naturalHeight, preset.widthMeters, preset.name);
      setPlacingPreset(null);
    };
    image.onerror = () => setPlacingPreset(null);
    image.src = preset.src;
  }

  function regularDropdown(key: Exclude<Menu, 'shop' | null>, label: string, note: string) {
    return (
      <div className="drop-wrap">
        <button className="drop-btn req-dd" onClick={() => toggle(key)}>
          {label}<Icon name="chevron" size={14} />
        </button>
        {open === key && (
          <div className="drop-panel open">
            <div className="drop-note">{note}</div>
            {menus[key].map((item) => (
              <button className="drop-item" key={item} onClick={() => chooseRequirement(item)}>{item}</button>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="reqbar">
      <span className="req-label">REQUIREMENT</span>
      <span className="req-cat">ร้าน</span>

      <div className="drop-wrap">
        <button className="drop-btn req-dd" onClick={() => toggle('shop')}>
          {STORE_PRESETS.some((preset) => preset.name === selected) ? selected : 'Type ร้าน'}
          <Icon name="chevron" size={14} />
        </button>
        {open === 'shop' && (
          <div className="drop-panel open shop-preset-panel">
            <div className="drop-note">เลือก Type ร้าน (V8) — แบบจะถูกแนบลงกระดานตามมาตราส่วนจริง</div>
            {STORE_PRESETS.map((preset) => (
              <button
                className="drop-item shop-preset-item"
                key={preset.key}
                disabled={!canEditActiveLayer || placingPreset !== null}
                onClick={() => chooseStorePreset(preset)}
                title={!canEditActiveLayer ? 'Layer ปัจจุบันถูกซ่อนหรือล็อกอยู่' : `แนบแบบ ${preset.name}`}
              >
                <span className="shop-preset-icon"><Icon name="shop" size={17} /></span>
                <span className="shop-preset-copy"><strong>{preset.name}</strong><small>แนบแปลนร้านลง Canvas</small></span>
                {placingPreset === preset.key && <span className="shop-preset-loading">…</span>}
              </button>
            ))}
          </div>
        )}
      </div>

      {regularDropdown('around', 'รอบร้าน', 'รอบร้าน — รอเพิ่มรูปภาพ/แบบ (mock up)')}
      <span className="req-cat">ภายนอกร้าน</span>
      {regularDropdown('parking', 'ลานจอด', 'ลานจอด — รอเพิ่มรูปภาพ/แบบ (mock up)')}
      {regularDropdown('community', '7-ชุมชน', '7-ชุมชน — รอเพิ่มรูปภาพ/แบบ (mock up)')}
      {regularDropdown('other', 'อื่นๆ', 'อื่นๆ — เลือกใช้ได้เลย')}
    </div>
  );
}
