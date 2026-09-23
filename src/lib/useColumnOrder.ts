import { useEffect, useState } from 'react';

function reconcile(order: string[], allIds: string[]): string[] {
  const known = order.filter((id) => allIds.includes(id));
  const missing = allIds.filter((id) => !known.includes(id));
  return [...known, ...missing];
}

/**
 * Tracks the display order of a table's columns, persisted to localStorage.
 * Storing only the ids that have been explicitly reordered (reconciled
 * against the current column set on every read) means new columns (e.g.
 * newly added custom fields) fall in at their natural default position
 * without migration.
 */
export function useColumnOrder(storageKey: string, allIds: string[]) {
  const [order, setOrder] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) return JSON.parse(raw) as string[];
    } catch {
      // ignore malformed/inaccessible storage
    }
    return [];
  });

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(order));
    } catch {
      // ignore write failures (e.g. private browsing quota)
    }
  }, [storageKey, order]);

  const orderedIds = reconcile(order, allIds);

  function moveUp(id: string) {
    setOrder((prev) => {
      const current = reconcile(prev, allIds);
      const i = current.indexOf(id);
      if (i <= 0) return current;
      const next = [...current];
      [next[i - 1], next[i]] = [next[i], next[i - 1]];
      return next;
    });
  }

  function moveDown(id: string) {
    setOrder((prev) => {
      const current = reconcile(prev, allIds);
      const i = current.indexOf(id);
      if (i === -1 || i >= current.length - 1) return current;
      const next = [...current];
      [next[i + 1], next[i]] = [next[i], next[i + 1]];
      return next;
    });
  }

  return { orderedIds, moveUp, moveDown };
}
