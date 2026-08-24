import { useState } from 'react';

export function CalibrationDialog({
  worldDistance,
  onCancel,
  onSave,
}: {
  worldDistance: number;
  onCancel: () => void;
  onSave: (meters: number) => void;
}) {
  const [meters, setMeters] = useState('1');
  const numeric = Number(meters);
  const valid = Number.isFinite(numeric) && numeric > 0;

  return (
    <div className="modal-back open" onPointerDown={(event) => event.stopPropagation()}>
      <div className="modal calib-modal" role="dialog" aria-modal="true">
        <h3>สอบเทียบมาตราส่วน</h3>
        <p className="modal-help">กรอกระยะจริงระหว่าง 2 จุดที่เลือก</p>
        <label className="calib-field">
          <span>ระยะจริง</span>
          <div className="calib-input-row">
            <input autoFocus type="number" min="0.001" step="0.01" value={meters} onChange={(event) => setMeters(event.target.value)} />
            <span>เมตร</span>
          </div>
        </label>
        <div className="calib-meta">ระยะบนแบบ: {worldDistance.toFixed(1)} world px</div>
        <div className="btn-row">
          <button className="btn" onClick={onCancel}>ยกเลิก</button>
          <button className="btn primary" disabled={!valid} onClick={() => valid && onSave(numeric)}>ใช้ค่านี้</button>
        </div>
      </div>
    </div>
  );
}
