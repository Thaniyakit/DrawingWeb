import { useCallback, useRef, useState } from 'react';

function cloneValue<T>(value: T): T {
  if (typeof structuredClone === 'function') return structuredClone(value);
  return JSON.parse(JSON.stringify(value)) as T;
}

/**
 * Small generic undo/redo stack.
 * The hook owns stack bookkeeping only; the caller owns the actual React state.
 */
export function useHistory<T>(limit = 50) {
  const undoRef = useRef<T[]>([]);
  const redoRef = useRef<T[]>([]);
  const [, setRevision] = useState(0);

  const notify = useCallback(() => {
    setRevision((value) => value + 1);
  }, []);

  const push = useCallback((snapshot: T) => {
    undoRef.current.push(cloneValue(snapshot));
    if (undoRef.current.length > limit) undoRef.current.shift();
    redoRef.current = [];
    notify();
  }, [limit, notify]);

  const undo = useCallback((current: T): T | null => {
    const previous = undoRef.current.pop();
    if (!previous) return null;
    redoRef.current.push(cloneValue(current));
    notify();
    return cloneValue(previous);
  }, [notify]);

  const redo = useCallback((current: T): T | null => {
    const next = redoRef.current.pop();
    if (!next) return null;
    undoRef.current.push(cloneValue(current));
    if (undoRef.current.length > limit) undoRef.current.shift();
    notify();
    return cloneValue(next);
  }, [limit, notify]);

  const reset = useCallback(() => {
    undoRef.current = [];
    redoRef.current = [];
    notify();
  }, [notify]);

  return {
    push,
    undo,
    redo,
    reset,
    canUndo: undoRef.current.length > 0,
    canRedo: redoRef.current.length > 0,
  };
}
