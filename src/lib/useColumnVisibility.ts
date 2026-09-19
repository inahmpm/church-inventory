import { useEffect, useState } from 'react';

/**
 * Tracks which columns are hidden for a table, persisted to localStorage.
 * Storing the hidden set (rather than the visible set) means new columns
 * (e.g. newly added custom fields) show up by default without migration.
 */
export function useColumnVisibility(storageKey: string, defaultHidden: string[] = []) {
  const [hidden, setHidden] = useState<Set<string>>(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) return new Set(JSON.parse(raw) as string[]);
    } catch {
      // ignore malformed/inaccessible storage
    }
    return new Set(defaultHidden);
  });

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify([...hidden]));
    } catch {
      // ignore write failures (e.g. private browsing quota)
    }
  }, [storageKey, hidden]);

  function isVisible(id: string) {
    return !hidden.has(id);
  }

  function toggle(id: string) {
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function showAll() {
    setHidden(new Set());
  }

  return { isVisible, toggle, showAll, hiddenCount: hidden.size };
}
