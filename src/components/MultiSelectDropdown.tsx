import { useEffect, useRef, useState } from 'react';

// A checkbox-list dropdown for selecting zero or more string options, used
// where a plain <select> can't express "no selection = everything" plus
// multiple picks at once (e.g. filtering by several subcategories).
export default function MultiSelectDropdown({
  label,
  options,
  selected,
  onChange,
  disabled = false,
  className = '',
}: {
  label: string;
  options: string[];
  selected: string[];
  onChange: (next: string[]) => void;
  disabled?: boolean;
  className?: string;
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

  function toggle(value: string) {
    onChange(selected.includes(value) ? selected.filter((v) => v !== value) : [...selected, value]);
  }

  const summary =
    selected.length === 0 ? `All ${label.toLowerCase()}` : selected.length === 1 ? selected[0] : `${selected.length} selected`;

  return (
    <div className={`relative ${className}`} ref={ref}>
      <button
        type="button"
        className="input w-full text-left flex items-center justify-between gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
        onClick={() => !disabled && setOpen((v) => !v)}
        disabled={disabled}
      >
        <span className="truncate">{summary}</span>
        <span className="text-slate-400 shrink-0">▾</span>
      </button>
      {open && (
        <div className="absolute left-0 right-0 mt-1 w-full min-w-[12rem] card p-2 space-y-0.5 z-30 shadow-lg max-h-56 overflow-y-auto">
          {options.length === 0 && <div className="text-xs text-slate-400 px-1 py-1">No options</div>}
          {options.map((opt) => (
            <label key={opt} className="flex items-center gap-2 text-sm py-0.5 px-1 cursor-pointer rounded hover:bg-slate-50">
              <input type="checkbox" className="h-4 w-4" checked={selected.includes(opt)} onChange={() => toggle(opt)} />
              <span className="truncate">{opt}</span>
            </label>
          ))}
          {selected.length > 0 && (
            <div className="flex justify-end pt-1">
              <button type="button" className="text-xs text-slate-500 hover:underline" onClick={() => onChange([])}>
                Clear
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
