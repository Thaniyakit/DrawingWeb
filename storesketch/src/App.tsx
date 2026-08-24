import { useCanvasEngine } from './hooks/useCanvasEngine';
import { TopBar } from './components/TopBar';
import { ToolSidebar } from './components/Sidebar/ToolSidebar';
import { SketchCanvas } from './components/Canvas/SketchCanvas';
import { RequirementBar } from './components/RequirementBar';
import { RightPanel } from './components/RightPanel';
import './App.css';

export default function App() {
  const engine = useCanvasEngine();

  return (
    <div className="app">
      <TopBar engine={engine} />
      <RequirementBar engine={engine} />
      <div className="body-row">
        <ToolSidebar engine={engine} />
        <SketchCanvas engine={engine} />
        <RightPanel engine={engine} />
      </div>
      <footer className="statusbar"><span>Store Sketch • พร้อมใช้งาน</span><span>GRID 24px • <b id="coordReadout">x: 0.00  y: 0.00</b></span></footer>
    </div>
  );
}
