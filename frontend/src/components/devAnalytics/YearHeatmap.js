import { useEffect, useMemo, useRef, useState } from 'react';
import { Info } from 'lucide-react';
import { addDays, formatDay, keyToDate, toKey } from '../../utils/devAnalytics';

const CELL = 11;
const GAP = 3;
const MONTH_GAP = 10;
const LABEL_H = 22;
const EMPTY = '#2b2f3a';
const ALL_COLOR = '#a78bfa';
const LEVEL_ALPHA = [0, 0.35, 0.55, 0.78, 1];

const pad = (n) => String(n).padStart(2, '0');

function hexToRgba(hex, a) {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
}

/** Longest run of consecutive active days among sorted day keys */
function longestRun(keys) {
  let best = 0;
  let run = 0;
  let prev = null;
  keys.forEach((k) => {
    run = prev && addDays(prev, 1) === k ? run + 1 : 1;
    if (run > best) best = run;
    prev = k;
  });
  return best;
}

/** Month blocks for [startKey, endKey], each split into week columns (Sunday on top) */
function buildMonths(startKey, endKey) {
  const months = [];
  const start = keyToDate(startKey);
  let y = start.getFullYear();
  let m = start.getMonth();
  const endMonth = endKey.slice(0, 7);
  let x = 0;
  for (;;) {
    const id = `${y}-${pad(m + 1)}`;
    if (id > endMonth) break;
    const daysIn = new Date(y, m + 1, 0).getDate();
    const firstDow = new Date(y, m, 1).getDay();
    const cols = Math.floor((firstDow + daysIn - 1) / 7) + 1;
    const cells = [];
    for (let d = 1; d <= daysIn; d += 1) {
      const key = `${id}-${pad(d)}`;
      const slot = firstDow + d - 1;
      cells.push({ key, col: Math.floor(slot / 7), row: slot % 7 });
    }
    months.push({
      id,
      x,
      width: cols * (CELL + GAP) - GAP,
      label: new Date(y, m, 1).toLocaleDateString(undefined, { month: 'short' }),
      cells
    });
    x += cols * (CELL + GAP) - GAP + MONTH_GAP;
    m += 1;
    if (m === 12) { m = 0; y += 1; }
  }
  return { months, width: Math.max(0, x - MONTH_GAP) };
}

/**
 * One continuous yearly activity heatmap, split into month sections with the
 * month name under each, like the GitHub and LeetCode contribution graphs.
 *
 * `sources`  [{ id, label, color, unit }] — the activity kinds that can be shown.
 * `activity` { [sourceId]: { 'YYYY-MM-DD': count } }.
 * `filter`   'all' or a source id. Controlled when `onFilterChange` is given, otherwise internal.
 * Hover (or tap) a day for its total and the per-source breakdown.
 */
export default function YearHeatmap({
  sources, activity, filter: controlledFilter, onFilterChange, showFilter = true, title, emptyHint
}) {
  const [ownFilter, setOwnFilter] = useState('all');
  const filter = controlledFilter || ownFilter;
  const setFilter = onFilterChange || setOwnFilter;
  const [range, setRange] = useState('current');
  const [hover, setHover] = useState(null);
  const wrapRef = useRef(null);
  const scrollRef = useRef(null);
  const today = toKey();

  const active = useMemo(
    () => (filter === 'all' ? sources : sources.filter((s) => s.id === filter)),
    [sources, filter]
  );

  // day -> { total, [sourceId]: n } for the selected sources
  const days = useMemo(() => {
    const out = {};
    active.forEach((s) => {
      Object.entries((activity && activity[s.id]) || {}).forEach(([k, n]) => {
        if (!n) return;
        if (!out[k]) out[k] = { total: 0 };
        out[k][s.id] = (out[k][s.id] || 0) + n;
        out[k].total += n;
      });
    });
    return out;
  }, [active, activity]);

  // Years that have any activity, for the range menu
  const years = useMemo(() => {
    const set = new Set([Number(today.slice(0, 4))]);
    sources.forEach((s) => Object.keys((activity && activity[s.id]) || {}).forEach((k) => set.add(Number(k.slice(0, 4)))));
    return [...set].sort((a, b) => b - a);
  }, [sources, activity, today]);

  // "Current": the last 12 months, from the 1st of the month 11 months ago to today
  const { startKey, endKey } = useMemo(() => {
    if (range === 'current') {
      const t = keyToDate(today);
      return { startKey: toKey(new Date(t.getFullYear(), t.getMonth() - 11, 1)), endKey: today };
    }
    return { startKey: `${range}-01-01`, endKey: `${range}-12-31` };
  }, [range, today]);

  const { months, width } = useMemo(() => buildMonths(startKey, endKey), [startKey, endKey]);

  const stats = useMemo(() => {
    const keys = Object.keys(days).filter((k) => k >= startKey && k <= endKey && days[k].total > 0).sort();
    const total = keys.reduce((sum, k) => sum + days[k].total, 0);
    const values = keys.map((k) => days[k].total).sort((a, b) => a - b);
    const q = (p) => values[Math.min(values.length - 1, Math.floor(p * values.length))] || 1;
    const t = [q(0.25), q(0.5), q(0.75)];
    const level = (n) => (n <= 0 ? 0 : n <= t[0] ? 1 : n <= t[1] ? 2 : n <= t[2] ? 3 : 4);
    return { total, activeDays: keys.length, maxStreak: longestRun(keys), level };
  }, [days, startKey, endKey]);

  // Show the most recent months first on narrow screens
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollLeft = el.scrollWidth;
  }, [range, width]);

  const color = filter === 'all' ? ALL_COLOR : (active[0]?.color || ALL_COLOR);
  const unit = filter === 'all' ? (active.length === 1 ? active[0].unit : 'activities') : active[0]?.unit || 'activities';
  const height = 7 * (CELL + GAP) - GAP + LABEL_H;
  const rangeLabel = range === 'current' ? 'in the past one year' : `in ${range}`;

  const showTip = (e, key) => {
    const wrap = wrapRef.current?.getBoundingClientRect();
    const cell = e.currentTarget.getBoundingClientRect();
    if (!wrap) return;
    setHover({ key, x: cell.left - wrap.left + cell.width / 2, y: cell.top - wrap.top });
  };

  const hoverData = hover ? days[hover.key] : null;

  return (
    <div ref={wrapRef} className="relative">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 mb-4">
        <div className="flex items-baseline gap-2 min-w-0">
          {title && <span className="sr-only">{title}</span>}
          <span className="text-xl font-bold text-slate-100">{stats.total.toLocaleString()}</span>
          <span className="text-sm text-slate-300">{unit} {rangeLabel}</span>
          <span className="text-slate-500" title="Each day's colour shows how much activity it had compared with your other active days in this range.">
            <Info className="w-3.5 h-3.5 inline" />
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs">
          <span className="text-slate-400">Total active days: <span className="font-semibold text-slate-100">{stats.activeDays}</span></span>
          <span className="text-slate-400">Max streak: <span className="font-semibold text-slate-100">{stats.maxStreak}</span></span>
          <select
            value={range}
            onChange={(e) => { setHover(null); setRange(e.target.value); }}
            aria-label="Heatmap range"
            className="h-8 rounded-lg bg-white/5 border border-white/10 px-2 text-xs text-slate-200 focus:outline-none focus:border-violet-400/60"
          >
            <option value="current" className="bg-slate-900">Current</option>
            {years.map((y) => <option key={y} value={y} className="bg-slate-900">{y}</option>)}
          </select>
        </div>
      </div>

      {showFilter && sources.length > 1 && (
        <div className="mb-3 inline-flex flex-wrap rounded-xl bg-black/20 border border-white/10 p-0.5">
          {[{ id: 'all', label: 'All' }, ...sources].map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => { setHover(null); setFilter(s.id); }}
              aria-pressed={filter === s.id}
              className={`h-7 px-2.5 rounded-lg text-xs font-medium transition-colors ${
                filter === s.id ? 'bg-violet-600/40 text-violet-100' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      )}

      <div ref={scrollRef} className="overflow-x-auto overscroll-x-contain pb-1 [scrollbar-width:thin] [scrollbar-color:rgba(255,255,255,0.15)_transparent]">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          width="100%"
          style={{ minWidth: Math.round(width * 0.82), display: 'block' }}
          role="img"
          aria-label={`${title || 'Activity'}: ${stats.total} ${unit} ${rangeLabel}`}
          onMouseLeave={() => setHover(null)}
        >
          {months.map((mo) => (
            <g key={mo.id} transform={`translate(${mo.x},0)`}>
              {mo.cells.map((c) => {
                const future = c.key > today;
                const n = days[c.key]?.total || 0;
                const lvl = stats.level(n);
                const isHover = hover?.key === c.key;
                return (
                  <rect
                    key={c.key}
                    x={c.col * (CELL + GAP)}
                    y={c.row * (CELL + GAP)}
                    width={CELL}
                    height={CELL}
                    rx={2.5}
                    fill={lvl === 0 ? EMPTY : hexToRgba(color, LEVEL_ALPHA[lvl])}
                    opacity={future ? 0.35 : 1}
                    stroke={isHover ? '#f8fafc' : 'none'}
                    strokeWidth={isHover ? 1.2 : 0}
                    onMouseEnter={future ? undefined : (e) => showTip(e, c.key)}
                    onClick={future ? undefined : (e) => showTip(e, c.key)}
                    style={{ cursor: future ? 'default' : 'pointer' }}
                  >
                    <title>{`${formatDay(c.key)}: ${n} ${unit}`}</title>
                  </rect>
                );
              })}
              <text
                x={mo.width / 2}
                y={7 * (CELL + GAP) - GAP + 16}
                textAnchor="middle"
                fontSize="11"
                fill="#94a3b8"
              >
                {mo.label}
              </text>
            </g>
          ))}
        </svg>
      </div>

      {hover && (
        <div
          className="pointer-events-none absolute z-20 -translate-x-1/2 -translate-y-full rounded-lg border border-white/10 bg-slate-950/95 px-3 py-2 text-xs shadow-xl whitespace-nowrap"
          style={{ left: Math.max(70, Math.min(hover.x, (wrapRef.current?.clientWidth || 0) - 70)), top: hover.y - 6 }}
          role="tooltip"
        >
          <div className="font-semibold text-slate-100">
            {hoverData?.total || 0} {unit} on {formatDay(hover.key, { month: 'short', day: 'numeric', year: 'numeric' })}
          </div>
          {active.length > 1 && (
            <div className="mt-1 space-y-0.5">
              {active.map((s) => (
                <div key={s.id} className="flex items-center gap-2 text-slate-300">
                  <span className="w-2 h-2 rounded-sm" style={{ background: s.color }} />
                  <span>{s.label}</span>
                  <span className="ml-auto pl-3 font-medium text-slate-100">{hoverData?.[s.id] || 0}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500">
        <span>{stats.total === 0 && emptyHint ? emptyHint : 'Hover or tap a day for its breakdown.'}</span>
        <span className="inline-flex items-center gap-1">
          Less
          {LEVEL_ALPHA.map((a, i) => (
            <span key={a} className="inline-block w-[11px] h-[11px] rounded-[2.5px]" style={{ background: i === 0 ? EMPTY : hexToRgba(color, a) }} />
          ))}
          More
        </span>
      </div>
    </div>
  );
}
