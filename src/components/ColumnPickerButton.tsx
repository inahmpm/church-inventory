import { useEffect, useRef, useState } from 'react';

export interface ColumnPickerOption {
  id: string;
  label: string;
}

function IconColumns() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0">
      <rect x="4" y="4" width="16" height="16" rx="1" />
      <path d="M10 4v16M15 4v16" />
    </svg>
  );
}

export default function ColumnPickerButton({
  columns,
  isVisible,
  onToggle,
  onShowAll,
  onMoveUp,
  onMoveDown,
}: {
  columns: ColumnPickerOption[];
  isVisible: (id: string) => boolean;
  onToggle: (id: string) => void;
  onShowAll: () => void;
  onMoveUp?: (id: string) => void;
  onMoveDown?: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  const hiddenCount = columns.filter((c) => !isVisible(c.id)).length;

  return (
    <div className="relative print:hidden" ref={ref}>
      <button
        type="button"
        className="btn-secondary whitespace-nowrap relative inline-flex items-center gap-1.5"
        onClick={() => setOpen((v) => !v)}
        title="Columns"
        aria-label="Columns"
      >
        <IconColumns />
        <span className="hidden md:inline">Columns</span>
        {hiddenCount > 0 && (
          <span className="ml-0.5 inline-flex items-center justify-center rounded-full bg-primary-600 text-white text-[10px] w-4 h-4 align-middle">
            {hiddenCount}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-56 card p-3 space-y-0.5 z-30 shadow-lg max-h-80 overflow-y-auto">
          {columns.map((col, index) => (
            <div key={col.id} className="flex items-center gap-1 py-0.5">
              {onMoveUp && onMoveDown && (
                <div className="flex flex-col shrink-0">
                  <button
                    type="button"
                    className="text-slate-400 hover:text-slate-700 disabled:opacity-30 disabled:hover:text-slate-400 leading-none"
                    disabled={index === 0}
                    onClick={() => onMoveUp(col.id)}
                    title={`Move ${col.label} up`}
                    aria-label={`Move ${col.label} up`}
                  >
                    ▲
                  </button>
                  <button
                    type="button"
                    className="text-slate-400 hover:text-slate-700 disabled:opacity-30 disabled:hover:text-slate-400 leading-none"
                    disabled={index === columns.length - 1}
                    onClick={() => onMoveDown(col.id)}
                    title={`Move ${col.label} down`}
                    aria-label={`Move ${col.label} down`}
                  >
                    ▼
                  </button>
                </div>
              )}
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  className="h-4 w-4"
                  checked={isVisible(col.id)}
                  onChange={() => onToggle(col.id)}
                />
                {col.label}
              </label>
            </div>
          ))}
          <div className="flex justify-end pt-1">
            <button type="button" className="text-xs text-slate-500 hover:underline" onClick={onShowAll}>
              Show all
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
