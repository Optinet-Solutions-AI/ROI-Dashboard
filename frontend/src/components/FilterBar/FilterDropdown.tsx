import { useMemo, useRef, useState, useEffect } from 'react';
import { ChevronDown, Search, X } from 'lucide-react';

interface Props {
  label: string;
  options: string[];
  selected: string[];
  onChange: (next: string[]) => void;
  /** Virtualization threshold — when > this many options, switch to a
   *  "top 200 matches" render to keep the DOM responsive for big lists
   *  (Excel's Company_name has ~2,277 distinct values). */
  windowSize?: number;
}

const DEFAULT_WINDOW = 200;

export function FilterDropdown({ label, options, selected, onChange, windowSize = DEFAULT_WINDOW }: Props) {
  const [open, setOpen]     = useState(false);
  const [query, setQuery]   = useState('');
  const rootRef             = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const base = q ? options.filter(o => o.toLowerCase().includes(q)) : options;
    return base.slice(0, windowSize);
  }, [options, query, windowSize]);

  const truncated = filtered.length === windowSize && options.length > windowSize;

  const toggle = (value: string) => {
    onChange(selected.includes(value) ? selected.filter(s => s !== value) : [...selected, value]);
  };

  const allSelected = selected.length === 0; // empty = "(All)" in Excel terms

  return (
    <div ref={rootRef} className="filter-dropdown">
      <button
        ref={triggerRef}
        type="button"
        className={`filter-dropdown__trigger${selected.length ? ' is-active' : ''}`}
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        <span className="filter-dropdown__label">{label}</span>
        <span className="filter-dropdown__value">
          {allSelected ? '(All)' : selected.length === 1 ? selected[0] : `${selected.length} selected`}
        </span>
        <ChevronDown size={14} />
      </button>

      {open && (
        <div className="filter-dropdown__panel" role="listbox">
          <div className="filter-dropdown__search">
            <Search size={12} />
            <input
              type="text"
              placeholder={`Search ${label.toLowerCase()}…`}
              value={query}
              onChange={e => setQuery(e.target.value)}
              autoFocus
            />
            {query && (
              <button type="button" onClick={() => setQuery('')} aria-label="Clear search">
                <X size={12} />
              </button>
            )}
          </div>

          <button
            type="button"
            className="filter-dropdown__option filter-dropdown__option--all"
            onClick={() => onChange([])}
          >
            <input type="checkbox" checked={allSelected} readOnly tabIndex={-1} />
            <span>(All)</span>
          </button>

          {filtered.map(opt => (
            <button
              key={opt}
              type="button"
              className="filter-dropdown__option"
              onClick={() => toggle(opt)}
            >
              <input type="checkbox" checked={selected.includes(opt)} readOnly tabIndex={-1} />
              <span>{opt}</span>
            </button>
          ))}

          {filtered.length === 0 && <div className="filter-dropdown__empty">No matches</div>}
          {truncated && (
            <div className="filter-dropdown__truncated">
              Showing first {windowSize}. Refine the search to see more.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
