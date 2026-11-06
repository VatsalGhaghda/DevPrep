import { useMemo, useState } from 'react';
import { PLATFORM_META, addDays, formatDay, keyToDate, toKey } from '../../utils/devAnalytics';

const CELL = 12;
const GAP = 3;
const LEVEL_OPACITY = [0, 0.3, 0.5, 0.75, 1];

/**
 * GitHub-style calendar. `days` is { 'YYYY-MM-DD': { github, leetcode, codeforces, total } }.
 * Hover shows a day's per-platform breakdown; click pins it.
 */
export default function ActivityHeatmap({ days, startKey, platforms, color = '#8b5cf6' }) {
  const [hovered, setHovered] = useState(null);
  const [pinned, setPinned] = useState(null);

  const { weeks, levels, monthLabels } = useMemo(() => {
    const today = toKey();
    // Start the grid on the Sunday on or before startKey
    const start = keyToDate(startKey);
    const first = toKey(new Date(start.getFullYear(), start.getMonth(), start.getDate() - start.getDay()));
    const cols = [];
    let cursor = first;
    while (cursor <= today) {
      const col = [];
      for (let d = 0; d < 7; d += 1) {
        col.push(cursor <= today && cursor >= startKey ? cursor : null);
        cursor = addDays(cursor, 1);
      }
      cols.push(col);
    }
    // Intensity levels from the quartiles of active days in range
    const values = Object.entries(days)
      .filter(([k, v]) => k >= startKey && v.total > 0)
      .map(([, v]) => v.total)
      .sort((a, b) => a - b);
    const q = (p) => values[Math.min(values.length - 1, Math.floor(p * values.length))] || 1;
    const t = [q(0.25), q(0.5), q(0.75)];
    const lvl = (n) => (n <= 0 ? 0 : n <= t[0] ? 1 : n <= t[1] ? 2 : n <= t[2] ? 3 : 4);

    const labels = [];
    let lastMonth = -1;
    cols.forEach((col, i) => {
      const k = col.find(Boolean);
      if (!k) return;
      const m = keyToDate(k).getMonth();
      if (m !== lastMonth) {
        labels.push({ i, label: keyToDate(k).toLocaleDateString(undefined, { month: 'short' }) });
        lastMonth = m;
      }
    });
    return { weeks: cols, levels: lvl, monthLabels: labels };
  }, [days, startKey]);

  const selected = pinned || hovered;
  const selectedData = selected ? days[selected] : null;
  const width = weeks.length * (CELL + GAP);
  const height = 7 * (CELL + GAP) + 16;

  return (
    <div>
      <div className="overflow-x-auto pb-2">
        <svg width={width + 28} height={height} role="img" aria-label="Coding activity heatmap" className="block">
          {monthLabels.map((m) => (
            <text key={`${m.i}-${m.label}`} x={28 + m.i * (CELL + GAP)} y={10} fontSize="10" fill="#94a3b8">{m.label}</text>
          ))}
          {['Mon', 'Wed', 'Fri'].map((d, i) => (
            <text key={d} x={0} y={16 + (i * 2 + 1) * (CELL + GAP) + CELL - 2} fontSize="9" fill="#64748b">{d}</text>
          ))}
          {weeks.map((col, x) => col.map((key, y) => {
            if (!key) return null;
            const total = days[key]?.total || 0;
            const level = levels(total);
            const isSel = key === selected;
            return (
              <rect
                key={key}
                x={28 + x * (CELL + GAP)}
                y={16 + y * (CELL + GAP)}
                width={CELL}
                height={CELL}
                rx={3}
                fill={level === 0 ? 'rgba(255,255,255,0.06)' : color}
                fillOpacity={level === 0 ? 1 : LEVEL_OPACITY[level]}
                stroke={isSel ? '#f8fafc' : 'none'}
                strokeWidth={isSel ? 1.5 : 0}
                onMouseEnter={() => setHovered(key)}
                onMouseLeave={() => setHovered(null)}
                onClick={() => setPinned((p) => (p === key ? null : key))}
                style={{ cursor: 'pointer' }}
              >
                <title>{`${formatDay(key)}: ${total} activit${total === 1 ? 'y' : 'ies'}`}</title>
              </rect>
            );
          }))}
        </svg>
      </div>

      <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
        <div className="min-h-[2.5rem] text-xs">
          {selected ? (
            <div>
              <div className="text-slate-200 font-medium">
                {formatDay(selected)}{pinned && <span className="text-slate-500 font-normal"> (pinned, click again to unpin)</span>}
              </div>
              <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
                {platforms.map((p) => (
                  <span key={p} className={PLATFORM_META[p].text}>
                    {PLATFORM_META[p].label}: {selectedData?.[p] || 0} {PLATFORM_META[p].unit}
                  </span>
                ))}
              </div>
            </div>
          ) : (
            <span className="text-slate-500">Hover or click a day to see each platform's activity.</span>
          )}
        </div>
        <div className="flex items-center gap-1 text-[10px] text-slate-500">
          Less
          {LEVEL_OPACITY.map((o, i) => (
            <span
              key={o}
              className="inline-block w-3 h-3 rounded-[3px]"
              style={{ background: i === 0 ? 'rgba(255,255,255,0.06)' : color, opacity: i === 0 ? 1 : o }}
            />
          ))}
          More
        </div>
      </div>
    </div>
  );
}
