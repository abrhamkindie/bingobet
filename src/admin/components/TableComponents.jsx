import React from 'react';

export function TableCard({ title, headers, rows, emptyText }) {
  return (
    <div className="card rounded-xl overflow-hidden">
      {title && (
        <div className="flex items-center justify-between px-5 py-4 border-b border-line">
          <h2 className="text-sm font-semibold text-ink">{title}</h2>
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-[#f8fafc] border-b border-line">
              {headers.map((h, i) => (
                <th key={i} className={`text-left px-4 py-3 text-[11px] font-semibold text-muted uppercase tracking-[0.08em] whitespace-nowrap ${i === headers.length - 1 ? 'text-right' : ''}`}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.length === 0 ? (
              <tr><td colSpan={headers.length} className="text-center text-muted px-4 py-14 text-xs">{emptyText || 'No data'}</td></tr>
            ) : (
              rows.map((row, idx) => (
                <tr key={idx} className="transition-colors duration-150 hover:bg-[rgba(79,70,229,0.03)]">
                  {row.map((cell, ci) => (
                    <td key={ci} className={`px-4 py-3.5 text-ink align-middle ${ci === row.length - 1 ? 'text-right' : ''}`}>{cell}</td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function Pagination({ page, totalPages, total, onPageChange }) {
  return (
    <div className="flex items-center justify-between gap-2 py-4 text-xs text-muted max-sm:flex-col max-sm:items-stretch">
      <span className="text-muted font-medium">{total} total</span>
      <div className="flex items-center gap-2">
        <button disabled={page <= 0} onClick={() => onPageChange(page - 1)}
          className="inline-flex items-center justify-center px-3 py-1.5 border border-line rounded-lg bg-white text-muted text-xs font-semibold cursor-pointer transition-all hover:bg-surface-muted hover:text-ink disabled:opacity-40 disabled:cursor-not-allowed">
          &#x2039; Prev
        </button>
        <span className="px-3 py-1.5 rounded-lg bg-indigo-50 text-primary text-xs font-semibold border border-indigo-100 min-w-[60px] text-center">{page + 1} / {Math.max(totalPages, 1)}</span>
        <button disabled={page + 1 >= totalPages} onClick={() => onPageChange(page + 1)}
          className="inline-flex items-center justify-center px-3 py-1.5 border border-line rounded-lg bg-white text-muted text-xs font-semibold cursor-pointer transition-all hover:bg-surface-muted hover:text-ink disabled:opacity-40 disabled:cursor-not-allowed">
          Next &#x203A;
        </button>
      </div>
    </div>
  );
}

export function DropdownMenu({ items }) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef(null);

  React.useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div className="relative inline-block" ref={ref}>
      <button onClick={() => setOpen(!open)}
        className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-muted hover:bg-surface-muted hover:text-ink transition-colors">
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/></svg>
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 bg-white border border-line rounded-xl shadow-pop z-50 min-w-[168px] py-1.5 overflow-hidden">
          {items.map((item, i) => (
            <button key={i} onClick={() => { setOpen(false); item.onClick(); }}
              className="w-full text-left px-3.5 py-2 text-xs font-medium text-muted hover:bg-indigo-50 hover:text-primary transition-colors flex items-center gap-2.5">
              {item.icon && <span className="w-4 h-4 shrink-0">{item.icon}</span>}
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
