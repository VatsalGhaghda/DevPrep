import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import {
  PLATFORM_META, addMonths, daysOfMonth, earliestMonth, formatDay, formatMonth, intensityScale, keyToDate, toKey, toMonth, fmt
} from '../../utils/devAnalytics';

const LEVEL_OPACITY = [0, 0.3, 0.5, 0.75, 1];
const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const EMPTY_BG = 'rgba(255,255,255,0.05)';

/** Previous / next month buttons with the month name; can't go past the current month */
export function MonthNavigator({ month, onChange, minMonth, maxMonth = toMonth(), size = 'md' }) {
  const canPrev = !minMonth || month > minMonth;
  const canNext = month < maxMonth;
  const btn = `${size === 'sm' ? 'w-7 h-7' : 'w-8 h-8'} rounded-lg bg-white/5 border border-white/10 hover:border-white/20 text-slate-300 inline-flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed`;
  return (
    <div className="inline-flex items-center gap-2">
      <button type="button" className={btn} onClick={() => onChange(addMonths(month, -1))} disabled={!canPrev} aria-label="Previous month">
        <ChevronLeft className="w-4 h-4" />
      </button>
      <span className={`${size === 'sm' ? 'text-xs min-w-[7.5rem]' : 'text-sm min-w-[9rem]'} text-center font-semibold text-slate-100`} aria-live="polite">
        {formatMonth(month)}
      </span>
      <button type="button" className={btn} onClick={() => onChange(addMonths(month, 1))} disabled={!canNext} aria-label="Next month">
        <ChevronRight className="w-4 h-4" />
      </button>
      {month !== maxMonth && (
        <button type="button" onClick={() => onChange(maxMonth)} className="text-xs text-violet-300 hover:text-violet-200">
          This month
        </button>
      )}
    </div>
  );
}

/**
 * One month as a calendar heatmap. `days` is { 'YYYY-MM-DD': { github, leetcode, codeforces, total } }.
 * The month can be controlled (`month` + `onMonthChange`) so several heatmaps move together,
 * or left to the component, which then shows its own navigation.
 * `scaleDays` sets the colour scale (defaults to `days`), so the same colour means the same
 * amount of activity in every month.
 */
export default function MonthlyHeatmap({
  days, platforms, color = '#8b5cf6', title, month: controlled, onMonthChange, minMonth, scaleDays, showNav = true
}) {
  const [own, setOwn] = useState(() => toMonth());
  const month = controlled || own;
  const setMonth = onMonthChange || setOwn;
  const [hovered, setHovered] = useState(null);
  const [pinned, setPinned] = useState(null);

  const level = useMemo(() => intensityScale(scaleDays || days), [scaleDays, days]);
  const floor = useMemo(() => minMonth || earliestMonth(days), [minMonth, days]);
  const today = toKey();

  const { cells, summary } = useMemo(() => {
    const keys = daysOfMonth(month);
    const lead = keyToDate(keys[0]).getDay();
    const list = [...Array(lead).fill(null), ...keys];
    while (list.length % 7) list.push(null);
    let total = 0;
    let active = 0;
    let best = null;
    let elapsed = 0;
    keys.forEach((k) => {
      if (k > today) return;
      elapsed += 1;
      const n = days[k]?.total || 0;
      total += n;
      if (n > 0) active += 1;
      if (n > 0 && (!best || n > best.n)) best = { k, n };
    });
    return { cells: list, summary: { total, active, elapsed, best } };
  }, [month, days, today]);

  const single = platforms.length === 1 ? PLATFORM_META[platforms[0]] : null;
  const unit = single ? single.unit : 'activities';
  const selected = pinned && pinned.startsWith(month) ? pinned : hovered;
  const selectedData = selected ? days[selected] : null;

  const go = (m) => { setPinned(null); setHovered(null); setMonth(m); };

  return (
    <div className="flex flex-col">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        {title ? <div className={`text-sm font-semibold ${single ? single.text : 'text-slate-100'}`}>{title}</div> : <span />}
        {showNav && <MonthNavigator month={month} onChange={go} minMonth={floor} size="sm" />}
      </div>

      <div className="grid grid-cols-3 gap-2 mb-3 text-center">
        <div className="rounded-xl bg-white/5 border border-white/5 py-1.5">
          <div className="text-sm font-semibold text-slate-100">{fmt(summary.total)}</div>
          <div className="text-[10px] text-slate-500 truncate px-1">{unit}</div>
        </div>
        <div className="rounded-xl bg-white/5 border border-white/5 py-1.5">
          <div className="text-sm font-semibold text-slate-100">{summary.active}<span className="text-slate-500 font-normal">/{summary.elapsed}</span></div>
          <div className="text-[10px] text-slate-500">active days</div>
        </div>
        <div className="rounded-xl bg-white/5 border border-white/5 py-1.5">
          <div className="text-sm font-semibold text-slate-100">{summary.best ? fmt(summary.best.n) : '—'}</div>
          <div className="text-[10px] text-slate-500 truncate px-1">
            {summary.best ? `best day, ${keyToDate(summary.best.k).getDate()} ${formatMonth(month, { month: 'short' })}` : 'best day'}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1 text-[10px] text-slate-500 text-center mb-1" aria-hidden="true">
        {WEEKDAYS.map((d, i) => <span key={i}>{d}</span>)}
      </div>
      <div className="grid grid-cols-7 gap-1" role="grid" aria-label={`${title || 'Activity'} for ${formatMonth(month)}`}>
        {cells.map((key, i) => {
          if (!key) return <span key={`blank-${i}`} className="aspect-square" />;
          const future = key > today;
          const n = days[key]?.total || 0;
          const lvl = level(n);
          const isSel = key === selected;
          const isToday = key === today;
          return (
            <button
              key={key}
              type="button"
              disabled={future}
              onMouseEnter={() => setHovered(key)}
              onMouseLeave={() => setHovered(null)}
              onFocus={() => setHovered(key)}
              onBlur={() => setHovered(null)}
              onClick={() => setPinned((p) => (p === key ? null : key))}
              title={`${formatDay(key)}: ${n} ${unit}`}
              aria-label={`${formatDay(key)}: ${n} ${unit}`}
              aria-pressed={pinned === key}
              className={`aspect-square rounded-md text-[10px] leading-none flex items-start justify-end p-1 transition-shadow ${
                future ? 'opacity-30 cursor-default' : 'cursor-pointer'
              } ${isSel ? 'ring-2 ring-slate-100' : isToday ? 'ring-1 ring-violet-300/70' : ''}`}
              style={{ background: lvl === 0 ? EMPTY_BG : hexWithAlpha(color, LEVEL_OPACITY[lvl]) }}
            >
              <span className={lvl >= 3 ? 'text-slate-950/80 font-semibold' : 'text-slate-400'}>{keyToDate(key).getDate()}</span>
            </button>
          );
        })}
      </div>

      <div className="mt-3 min-h-[2.75rem] text-xs">
        {selected ? (
          <div>
            <div className="text-slate-200 font-medium">
              {formatDay(selected)}
              {pinned === selected && <span className="text-slate-500 font-normal"> (pinned)</span>}
            </div>
            <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1">
              {platforms.map((p) => (
                <span key={p} className={PLATFORM_META[p].text}>
                  {platforms.length > 1 && `${PLATFORM_META[p].label}: `}{selectedData?.[p] || 0} {PLATFORM_META[p].unit}
                </span>
              ))}
            </div>
          </div>
        ) : (
          <span className="text-slate-500">Hover or tap a day to see its activity.</span>
        )}
      </div>

      <div className="mt-1 flex items-center justify-end gap-1 text-[10px] text-slate-500">
        Less
        {LEVEL_OPACITY.map((o, i) => (
          <span
            key={o}
            className="inline-block w-2.5 h-2.5 rounded-[3px]"
            style={{ background: i === 0 ? EMPTY_BG : hexWithAlpha(color, o) }}
          />
        ))}
        More
      </div>
    </div>
  );
}

function hexWithAlpha(hex, alpha) {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const n = parseInt(full, 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}
