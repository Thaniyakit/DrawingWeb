import { useRef } from 'react';
import type { useCanvasEngine } from '../hooks/useCanvasEngine';
import { Icon } from './Icon';

type Engine = ReturnType<typeof useCanvasEngine>;

export function TopBar({ engine }: { engine: Engine }) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { objects, project, newProject, exportProject, loadProject } = engine;

  function handleNew() {
    if (objects.length && !window.confirm('สร้างไฟล์ใหม่? งานที่ยังไม่ได้บันทึกจะหายไป')) return;
    newProject();
  }

  function handleSave() {
    const payload = exportProject();
    const fileName = project.projectName || project.shopName || 'storesketch';
    const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });
    const link = document.createElement('a');
    link.download = `${fileName.replace(/\s+/g, '_')}.json`;
    link.href = URL.createObjectURL(blob);
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
  }

  function handleOpenFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data: unknown = JSON.parse(event.target?.result as string);
        loadProject(data);
      } catch {
        window.alert('เปิดไฟล์ไม่สำเร็จ — ไฟล์ไม่ใช่รูปแบบ Store Sketch');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  }

  return (
    <header className="topbar">
      <div className="brand">
        <div className="brand-mark">SS</div>
        <div className="brand-text">
          <h1>Store Sketch</h1>
          <p>สเก็ตช์งานก่อสร้างตามมาตราส่วน</p>
        </div>
      </div>
      <button className="btn" onClick={handleNew}><Icon name="fileplus" />สร้างไฟล์</button>
      <button className="btn" onClick={handleSave}><Icon name="save" />บันทึกไฟล์</button>
      <button className="btn" onClick={() => fileInputRef.current?.click()}><Icon name="folder" />เปิดไฟล์</button>
      <input
        ref={fileInputRef}
        type="file"
        accept=".json,application/json"
        style={{ display: 'none' }}
        onChange={handleOpenFile}
      />
      <div className="top-spacer" />
      <button className="btn"><Icon name="imgplus" />นำเข้าภาพ</button>
      <button className="btn"><Icon name="imgdown" />PNG</button>
      <button className="btn primary"><Icon name="pdf" />ส่งออก PDF</button>
    </header>
  );
}
