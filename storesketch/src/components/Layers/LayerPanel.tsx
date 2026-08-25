import { useMemo, useState } from 'react';
import type { SketchLayer } from '../../types';
import type { useCanvasEngine } from '../../hooks/useCanvasEngine';
import { Icon } from '../Icon';

type Engine = ReturnType<typeof useCanvasEngine>;

export function LayerPanel({ engine, onHide }: { engine: Engine; onHide: () => void }) {
  const {
    objects,
    layers,
    activeLayerId,
    activateLayer,
    createLayer,
    renameLayer,
    toggleLayerVisibility,
    toggleLayerLock,
    moveLayer,
    deleteLayer,
  } = engine;

  const [renamingId, setRenamingId] = useState<number | null>(null);
  const [renameValue, setRenameValue] = useState('');

  const objectCountByLayer = useMemo(() => {
    const counts = new Map<number, number>();
    for (const object of objects) {
      if (object.type === 'erase' || object.layerId === undefined) continue;
      counts.set(object.layerId, (counts.get(object.layerId) ?? 0) + 1);
    }
    return counts;
  }, [objects]);

  const activeLayer = layers.find((layer) => layer.id === activeLayerId);
  const activeIndex = activeLayer ? layers.findIndex((layer) => layer.id === activeLayer.id) : -1;

  function beginRename(layer: SketchLayer) {
    setRenamingId(layer.id);
    setRenameValue(layer.name);
  }

  function commitRename(id: number, value: string) {
    renameLayer(id, value);
    setRenamingId(null);
  }

  function removeActiveLayer() {
    if (!activeLayer || layers.length <= 1) return;
    const count = objectCountByLayer.get(activeLayer.id) ?? 0;
    const message = count > 0
      ? `ลบ "${activeLayer.name}" และวัตถุ ${count} ชิ้นใน Layer นี้หรือไม่?`
      : `ลบ "${activeLayer.name}" หรือไม่?`;
    if (window.confirm(message)) deleteLayer(activeLayer.id);
  }

  return (
    <section className="layer-panel">
      <div className="panel-head">
        <span>Layers</span>
        <div className="panel-head-actions">
          <small>{layers.length}</small>
          <button className="li-btn layer-add-btn" title="สร้าง Layer ใหม่" onClick={createLayer}>+</button>
          {/* <button className="li-btn" title="ซ่อนแผง" onClick={onHide}>
            <Icon name="eyeoff" size={16} />
          </button> */}
        </div>
      </div>

      <div className="layer-actions active">
        <span className="layer-selection-count">
          {activeLayer ? `แก้ไข: ${activeLayer.name}` : 'ยังไม่ได้เลือก Layer'}
        </span>
        <button
          className="li-btn"
          title="เปลี่ยนชื่อ Layer"
          disabled={!activeLayer}
          onClick={() => activeLayer && beginRename(activeLayer)}
        >
          <Icon name="edit" size={15} />
        </button>
        <button
          className="li-btn"
          title="เลื่อน Layer ขึ้น"
          disabled={!activeLayer || activeIndex >= layers.length - 1}
          onClick={() => activeLayer && moveLayer(activeLayer.id, 'up')}
        >
          <Icon name="up" size={15} />
        </button>
        <button
          className="li-btn"
          title="เลื่อน Layer ลง"
          disabled={!activeLayer || activeIndex <= 0}
          onClick={() => activeLayer && moveLayer(activeLayer.id, 'down')}
        >
          <Icon name="down" size={15} />
        </button>
        <button
          className="li-btn danger"
          title={layers.length <= 1 ? 'ต้องมีอย่างน้อย 1 Layer' : 'ลบ Layer'}
          disabled={!activeLayer || layers.length <= 1}
          onClick={removeActiveLayer}
        >
          <Icon name="trash" size={15} />
        </button>
      </div>

      <div className="layer-help">
        คลิก Layer เพื่อเลือกชั้นที่ต้องการวาดและแก้ไข วัตถุใหม่จะถูกเพิ่มลง Layer ที่เลือกอยู่เท่านั้น
      </div>

      <div className="layer-list">
        {[...layers].reverse().map((layer) => {
          const active = layer.id === activeLayerId;
          const hidden = !layer.visible;
          const locked = layer.locked;
          const isRenaming = renamingId === layer.id;
          const objectCount = objectCountByLayer.get(layer.id) ?? 0;

          return (
            <div
              className={`layer-item${active ? ' selected active-layer' : ''}${hidden ? ' is-hidden' : ''}${locked ? ' is-locked' : ''}`}
              key={layer.id}
              onClick={() => activateLayer(layer.id)}
              onDoubleClick={() => beginRename(layer)}
            >
              <span className="li-icon"><Icon name="multi" size={16} /></span>

              <div className="layer-name-wrap">
                {isRenaming ? (
                  <input
                    className="layer-name-input"
                    autoFocus
                    value={renameValue}
                    onClick={(event) => event.stopPropagation()}
                    onChange={(event) => setRenameValue(event.target.value)}
                    onBlur={(event) => commitRename(layer.id, event.currentTarget.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') event.currentTarget.blur();
                      if (event.key === 'Escape') {
                        event.preventDefault();
                        setRenamingId(null);
                      }
                    }}
                  />
                ) : (
                  <span className="li-name" title={`${layer.name} — ดับเบิลคลิกเพื่อเปลี่ยนชื่อ`}>
                    {layer.name}
                  </span>
                )}
                <span className="layer-object-count">{objectCount} วัตถุ</span>
              </div>

              <button
                className={`li-btn${locked ? ' on' : ''}`}
                title={locked ? 'ปลดล็อก Layer' : 'ล็อก Layer'}
                onClick={(event) => {
                  event.stopPropagation();
                  toggleLayerLock(layer.id);
                }}
              >
                <Icon name={locked ? 'lock' : 'unlock'} size={14} />
              </button>
              <button
                className={`li-btn${hidden ? ' off' : ''}`}
                title={hidden ? 'แสดง Layer' : 'ซ่อน Layer'}
                onClick={(event) => {
                  event.stopPropagation();
                  toggleLayerVisibility(layer.id);
                }}
              >
                <Icon name={hidden ? 'eyeoff' : 'eye'} size={15} />
              </button>
            </div>
          );
        })}
      </div>
    </section>
  );
}
