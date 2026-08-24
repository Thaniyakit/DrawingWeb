import { useEffect, useState } from 'react';
import { CHECKLIST_ITEMS } from '../data/checklist';
import { Icon } from './Icon';
import { LayerPanel } from './Layers/LayerPanel';
import type { useCanvasEngine } from '../hooks/useCanvasEngine';

type Engine = ReturnType<typeof useCanvasEngine>;

function shouldStartCollapsed(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(max-width: 900px) and (orientation: landscape)').matches;
}

export function RightPanel({ engine }: { engine: Engine }) {
  const [collapsed, setCollapsed] = useState(shouldStartCollapsed);
  const {
    project,
    setChecklistDone,
    setChecklistInput,
    toggleChecklistOption,
  } = engine;

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const query = window.matchMedia('(max-width: 900px) and (orientation: landscape)');
    const onChange = (event: MediaQueryListEvent) => {
      if (event.matches) setCollapsed(true);
    };
    query.addEventListener?.('change', onChange);
    return () => query.removeEventListener?.('change', onChange);
  }, []);

  const done = CHECKLIST_ITEMS.map((_, index) => project.checklist[index]?.done === true);
  const completed = done.filter(Boolean).length;

  if (collapsed) {
    return (
      <aside className="right-col collapsed" aria-label="แถบด้านขวาถูกย่อ">
        <button className="right-panel-expand" title="เปิดแถบด้านขวา" onClick={() => setCollapsed(false)}>
          <Icon name="chevron" size={17} />
        </button>
      </aside>
    );
  }

  return (
    <aside className="right-col">
      <div className="right-panel-topbar">
        <span>Checklist / Layers</span>
        <button className="li-btn right-panel-collapse" title="ย่อแถบด้านขวา" onClick={() => setCollapsed(true)}>
          <Icon name="chevron" size={16} />
        </button>
      </div>

      <section className="check-panel">
        <div className="panel-head"><span>Check List</span><small>{completed}/{CHECKLIST_ITEMS.length}</small></div>
        <div className="check-list">
          {CHECKLIST_ITEMS.map((item, index) => {
            const state = project.checklist[index] ?? { done: false, inputs: {}, opts: {} };
            return (
              <div className={`check-entry${state.done ? ' done' : ''}`} key={item.title}>
                <label className="check-item">
                  <input
                    type="checkbox"
                    checked={state.done}
                    onChange={() => setChecklistDone(index, !state.done)}
                  />
                  <span>{index + 1}) {item.title}</span>
                </label>

                {(item.inputs?.length || item.options?.length) ? (
                  <div className="check-sub">
                    {item.inputs?.map((input) => (
                      <input
                        key={input.key}
                        className="check-inp"
                        type="text"
                        value={state.inputs[input.key] ?? ''}
                        placeholder={input.placeholder}
                        onChange={(event) => setChecklistInput(index, input.key, event.target.value)}
                      />
                    ))}
                    {item.options?.map((option) => (
                      <button
                        key={option}
                        type="button"
                        className={`check-opt${state.opts[option] ? ' on' : ''}`}
                        onClick={() => toggleChecklistOption(index, option)}
                      >
                        {option}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </section>

      <LayerPanel engine={engine} onHide={() => setCollapsed(true)} />
    </aside>
  );
}
