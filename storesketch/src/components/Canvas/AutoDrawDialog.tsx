import { useState } from 'react';

export function AutoDrawDialog({
  onCancel,
  onCreate,
}: {
  onCancel: () => void;
  onCreate: (widthMeters: number, heightMeters: number) => void;
}) {
  const [width, setWidth] = useState('5');
  const [height, setHeight] = useState('5');
  const w = Number(width);
  const h = Number(height);
  const valid = Number.isFinite(w) && w > 0 && Number.isFinite(h) && h > 0;

  return (
    <div className="modal-back open" onPointerDown={(event) => event.stopPropagation()}>
      <div className="modal auto-modal" role="dialog" aria-modal="true">
        <h3>วาดอัตโนมัติจากขนาดจริง</h3>
        <p className="modal-help">สร้างพื้นที่สี่เหลี่ยมตามหน่วยเมตร โดยอิงมาตราส่วน/ค่าที่สอบเทียบปัจจุบัน</p>
        <div className="auto-draw-grid">
          <label><span>กว้าง (ม.)</span><input type="number" min="0.01" step="0.1" value={width} onChange={(e) => setWidth(e.target.value)} /></label>
          <label><span>ยาว (ม.)</span><input type="number" min="0.01" step="0.1" value={height} onChange={(e) => setHeight(e.target.value)} /></label>
        </div>
        <div className="btn-row">
          <button className="btn" onClick={onCancel}>ยกเลิก</button>
          <button className="btn primary" disabled={!valid} onClick={() => valid && onCreate(w, h)}>สร้าง</button>
        </div>
      </div>
    </div>
  );
}
