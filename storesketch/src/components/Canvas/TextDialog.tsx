import type { Dispatch, SetStateAction } from 'react';
import type { TextDialogState } from '../../hooks/useCanvasInteraction';

export function TextDialog({
  dialog,
  setDialog,
  onSave,
}: {
  dialog: TextDialogState;
  setDialog: Dispatch<SetStateAction<TextDialogState | null>>;
  onSave: () => void;
}) {
  return (
    <div className="modal-back open" onPointerDown={(event) => event.stopPropagation()}>
      <div className="modal" role="dialog" aria-modal="true">
        <h3>พิมพ์ข้อความ</h3>
        <textarea
          autoFocus
          value={dialog.text}
          placeholder="ข้อความ เช่น พื้นที่เช่า"
          onChange={(event) => setDialog((current) => (
            current ? { ...current, text: event.target.value } : current
          ))}
        />
        <div className="text-size-row">
          <span>ขนาด</span>
          <input
            type="number"
            min="1"
            value={dialog.fontSize}
            onChange={(event) => setDialog((current) => (
              current ? { ...current, fontSize: Number(event.target.value) } : current
            ))}
          />
          <span>px</span>
        </div>
        <div className="btn-row">
          <button className="btn" onClick={() => setDialog(null)}>ยกเลิก</button>
          <button className="btn primary" onClick={onSave}>วางข้อความ</button>
        </div>
      </div>
    </div>
  );
}
