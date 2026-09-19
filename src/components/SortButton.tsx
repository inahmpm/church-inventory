import { useEffect, useRef, useState } from 'react';

export interface SortOption {
  id: string;
  label: string;
}

function IconSort() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0">
      <path d="M7 4v16m0 0-3-3m3 3 3-3M17 20V4m0 0 3 3m-3-3-3 3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function SortButton({
  options,
  sortKey,
  sortDir,
  onSelect,
}: {
  options: SortOption[];
  sortKey: string;
  sortDir: 'asc' | 'desc';
  onSelect: (id: string) => void;
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

  const activeLabel = options.find((o) => o.id === sortKey)?.label ?? '';

  return (
    <div className="relative print:hidden" ref={ref}>
      <button
        type="button"
        className="btn-secondary whitespace-nowrap relative inline-flex items-center gap-1.5"
        onClick={() => setOpen((v) => !v)}
        title={`Sort by ${activeLabel}`}
        aria-label="Sort"
      >
        <IconSort />
        <span className="hidden md:inline">Sort{activeLabel ? `: ${activeLabel}` : ''}</span>
        <span className="text-[10px] text-slate-400">{sortDir === 'asc' ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-56 card p-3 space-y-0.5 z-30 shadow-lg max-h-80 overflow-y-auto">
          {options.map((opt) => {
            const active = opt.id === sortKey;
            return (
              <button
                key={opt.id}
                type="button"
                className={`w-full flex items-center justify-between gap-2 text-sm py-1 px-1.5 rounded-md text-left ${
                  active ? 'bg-primary-50 text-primary-700' : 'hover:bg-slate-50 text-slate-700'
                }`}
                onClick={() => {
                  onSelect(opt.id);
                }}
              >
                <span>{opt.label}</span>
                {active && <span className="text-xs">{sortDir === 'asc' ? '▲ Asc' : '▼ Desc'}</span>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
