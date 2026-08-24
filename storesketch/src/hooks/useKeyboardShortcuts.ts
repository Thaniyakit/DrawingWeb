import { useEffect } from 'react';
import type { ToolType } from '../types';
import type { useCanvasEngine } from './useCanvasEngine';

type Engine = ReturnType<typeof useCanvasEngine>;

const TOOL_SHORTCUTS: Record<string, ToolType> = {
  v: 'select',
  m: 'multi',
  p: 'pen',
  l: 'line',
  r: 'rect',
  c: 'circle',
  q: 'poly',
  b: 'curve',
  d: 'measure',
  t: 'text',
  e: 'eraser',
  x: 'objeraser',
};

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  const tag = target.tagName.toLowerCase();
  return tag === 'input' || tag === 'textarea' || tag === 'select';
}

/** Global shortcuts. Inputs/textareas keep their normal browser shortcuts. */
export function useKeyboardShortcuts(engine: Engine) {
  const { undo, redo, selectAllObjects, deleteSelectedObjects, clearSelection, setTool } = engine;

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (isEditableTarget(event.target)) return;

      const key = event.key.toLowerCase();
      const command = event.ctrlKey || event.metaKey;

      if (command && key === 'z') {
        event.preventDefault();
        if (event.shiftKey) redo();
        else undo();
        return;
      }

      if (command && key === 'y') {
        event.preventDefault();
        redo();
        return;
      }

      if (command && key === 'a') {
        event.preventDefault();
        selectAllObjects();
        return;
      }

      if (key === 'delete' || key === 'backspace') {
        event.preventDefault();
        deleteSelectedObjects();
        return;
      }

      if (key === 'escape') {
        clearSelection();
        return;
      }

      if (command || event.altKey) return;
      const tool = TOOL_SHORTCUTS[key];
      if (tool) setTool(tool);
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [clearSelection, deleteSelectedObjects, redo, selectAllObjects, setTool, undo]);
}
