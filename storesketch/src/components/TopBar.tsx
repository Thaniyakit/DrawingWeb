import { useRef, useState } from 'react';
import type { useCanvasEngine } from '../hooks/useCanvasEngine';
import { exportScenePdf, exportScenePng } from '../services/exportScene';
import { Icon } from './Icon';

type Engine = ReturnType<typeof useCanvasEngine>;

function safeFileName(value: string): string {
  return (value.trim() || 'storesketch').replace(/[\\/:*?"<>|]+/g, '_').replace(/\s+/g, '_');
}

export function TopBar({ engine }: { engine: Engine }) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const [exporting, setExporting] = useState<'png' | 'pdf' | null>(null);
  const {
    objects, layers, view, project, gridVisible, metersPerSquare, dimensionObjectIds,
    canEditActiveLayer, newProject, exportProject, loadProject, importImage,
  } = engine;

  function handleNew() {
    if (objects.length && !window.confirm('สร้างไฟล์ใหม่? งานที่ยังไม่ได้บันทึกจะหายไป')) return;
    newProject();
  }

  function handleSave() {
    const payload = exportProject();
    const fileName = safeFileName(project.projectName || project.shopName || 'storesketch');
    const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });
    const link = document.createElement('a');
    link.download = `${fileName}.json`;
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

  function handleImportImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!canEditActiveLayer) {
      window.alert('Layer ปัจจุบันถูกซ่อนหรือล็อก กรุณาเลือก Layer ที่แก้ไขได้ก่อนนำเข้าภาพ');
      e.target.value = '';
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const src = String(reader.result ?? '');
      const image = new Image();
      image.onload = () => importImage(src, image.naturalWidth, image.naturalHeight);
      image.onerror = () => window.alert('ไม่สามารถอ่านไฟล์ภาพนี้ได้');
      image.src = src;
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  }

  function exportInput() {
    const canvas = document.getElementById('drawCanvas') as HTMLCanvasElement | null;
    return {
      width: canvas?.clientWidth || canvas?.width || 1200,
      height: canvas?.clientHeight || canvas?.height || 800,
      view,
      objects,
      layers,
      dimensionObjectIds,
      gridVisible,
      metersPerSquare,
    };
  }

  async function handleExport(kind: 'png' | 'pdf') {
    if (exporting) return;
    const name = safeFileName(project.projectName || project.shopName || 'storesketch');
    try {
      setExporting(kind);
      if (kind === 'png') await exportScenePng(exportInput(), name);
      else await exportScenePdf(exportInput(), name);
    } catch (error) {
      console.error(error);
      window.alert(`ส่งออก ${kind.toUpperCase()} ไม่สำเร็จ`);
    } finally {
      setExporting(null);
    }
  }

  return (
    <header className="topbar">
      <div className="brand">
        <div className="brand-mark">SS</div>
        <div className="brand-text"><h1>Store Sketch</h1><p>สเก็ตช์งานก่อสร้างตามมาตราส่วน</p></div>
      </div>
      <button className="btn" onClick={handleNew}><Icon name="fileplus" />สร้างไฟล์</button>
      <button className="btn" onClick={handleSave}><Icon name="save" />บันทึกไฟล์</button>
      <button className="btn" onClick={() => fileInputRef.current?.click()}><Icon name="folder" />เปิดไฟล์</button>
      <input ref={fileInputRef} type="file" accept=".json,application/json" style={{ display: 'none' }} onChange={handleOpenFile} />
      <div className="top-spacer" />
      <button className="btn" onClick={() => imageInputRef.current?.click()}><Icon name="imgplus" />นำเข้าภาพ</button>
      <input ref={imageInputRef} type="file" accept="image/png,image/jpeg,image/webp" style={{ display: 'none' }} onChange={handleImportImage} />
      <button className="btn" disabled={exporting !== null} onClick={() => void handleExport('png')}><Icon name="imgdown" />{exporting === 'png' ? 'กำลังส่งออก…' : 'PNG'}</button>
      <button className="btn primary" disabled={exporting !== null} onClick={() => void handleExport('pdf')}><Icon name="pdf" />{exporting === 'pdf' ? 'กำลังส่งออก…' : 'ส่งออก PDF'}</button>
    </header>
  );
}
