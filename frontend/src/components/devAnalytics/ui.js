import { AlertTriangle, Info, Inbox } from 'lucide-react';

/** Height of every scrollable list card body, so cards side by side line up */
export const LIST_HEIGHT = 'h-[22rem]';

/**
 * Dashboard card. With `scroll`, the body gets a fixed height and scrolls on its
 * own (without scrolling the page when it reaches the end); `footer` stays
 * visible below the scrolling part. `count` shows a small badge next to the title.
 */
export function Card({ title, icon: Icon, action, children, className = '', scroll = false, bodyHeight = LIST_HEIGHT, count, subtitle, footer }) {
  return (
    <div className={`rounded-2xl border border-white/10 bg-[#1e1e2d]/60 backdrop-blur-xl p-5 flex flex-col min-w-0 ${className}`}>
      {(title || action) && (
        <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              {Icon && <Icon className="w-4 h-4 text-violet-300 flex-shrink-0" />}
              <h3 className="text-sm font-semibold text-slate-100 truncate">{title}</h3>
              {count != null && (
                <span className="px-1.5 py-0.5 rounded-md bg-white/5 border border-white/10 text-[10px] font-medium text-slate-400">{count}</span>
              )}
            </div>
            {subtitle && <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>}
          </div>
          {action}
        </div>
      )}
      {scroll ? (
        <div
          className={`${bodyHeight} overflow-y-auto overscroll-contain -mr-2 pr-2 [scrollbar-width:thin] [scrollbar-color:rgba(255,255,255,0.15)_transparent]`}
          tabIndex={0}
          aria-label={title ? `${title} list` : undefined}
        >
          {children}
        </div>
      ) : children}
      {footer && <div className="mt-4 pt-3 border-t border-white/5">{footer}</div>}
    </div>
  );
}

/** One row in a dashboard list */
export function ListRow({ children, className = '' }) {
  return (
    <li className={`flex items-center justify-between gap-3 rounded-xl bg-white/5 border border-white/5 px-3 py-2 min-h-[3.25rem] ${className}`}>
      {children}
    </li>
  );
}

/** Empty list placeholder that fills a list card's body */
export function ListEmpty({ title = 'Nothing here yet', message, icon: Icon = Inbox, action }) {
  return (
    <div className="h-full min-h-[8rem] flex flex-col items-center justify-center text-center px-4">
      <Icon className="w-6 h-6 text-slate-600" />
      <div className="mt-2 text-sm font-medium text-slate-300">{title}</div>
      {message && <p className="mt-0.5 text-xs text-slate-500 max-w-xs">{message}</p>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}

/** Loading placeholder rows with the same size as ListRow */
export function ListSkeleton({ rows = 5 }) {
  return (
    <ul className="space-y-2" aria-busy="true" aria-label="Loading">
      {Array.from({ length: rows }, (_, i) => (
        <li key={i} className="rounded-xl bg-white/5 border border-white/5 px-3 py-2 min-h-[3.25rem] animate-pulse">
          <div className="h-3 w-2/3 rounded bg-white/10" />
          <div className="mt-2 h-2.5 w-1/3 rounded bg-white/5" />
        </li>
      ))}
    </ul>
  );
}

export function StatTile({ label, value, sub, accent = 'text-slate-100' }) {
  return (
    <div className="rounded-2xl p-4 bg-white/5 border border-white/10">
      <div className="text-xs text-slate-400">{label}</div>
      <div className={`mt-1 text-2xl font-bold ${accent}`}>{value}</div>
      {sub && <div className="mt-0.5 text-xs text-slate-500">{sub}</div>}
    </div>
  );
}

export function EmptyState({ title, message, action }) {
  return (
    <div className="rounded-2xl border border-dashed border-white/15 bg-white/[0.03] p-8 text-center">
      <div className="text-sm font-semibold text-slate-200">{title}</div>
      {message && <p className="mt-1 text-sm text-slate-400 max-w-md mx-auto">{message}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

/** Notes about missing or limited data returned by a sync */
export function PartialNotice({ items, error }) {
  if (!error && (!items || items.length === 0)) return null;
  return (
    <div className="space-y-2">
      {error && (
        <div className="flex items-start gap-2 rounded-xl border border-rose-400/20 bg-rose-600/10 px-3 py-2 text-xs text-rose-200">
          <AlertTriangle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
          <span>Last sync failed: {error}</span>
        </div>
      )}
      {(items || []).map((note) => (
        <div key={note} className="flex items-start gap-2 rounded-xl border border-amber-400/15 bg-amber-600/10 px-3 py-2 text-xs text-amber-200">
          <Info className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
          <span>{note}</span>
        </div>
      ))}
    </div>
  );
}

export function Segmented({ options, value, onChange, size = 'sm' }) {
  return (
    <div className="inline-flex flex-wrap rounded-xl bg-black/20 border border-white/10 p-0.5">
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          onClick={() => onChange(o.id)}
          aria-pressed={value === o.id}
          className={`${size === 'sm' ? 'h-7 px-2.5 text-xs' : 'h-9 px-3 text-sm'} rounded-lg font-medium transition-colors ${
            value === o.id ? 'bg-violet-600/40 text-violet-100' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export const chartTooltipStyle = {
  contentStyle: { background: '#111827', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, fontSize: 12 },
  labelStyle: { color: '#e2e8f0' },
  itemStyle: { color: '#cbd5e1' }
};
