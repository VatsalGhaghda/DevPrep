/**
 * Date and activity helpers for the developer analytics dashboard.
 * Activity maps are { 'YYYY-MM-DD': count } per platform, as stored by the API.
 */

export const PLATFORMS = ['github', 'leetcode', 'codeforces'];

export const PLATFORM_META = {
  github: { label: 'GitHub', color: '#fbbf24', text: 'text-amber-300', unit: 'contributions' },
  leetcode: { label: 'LeetCode', color: '#22c55e', text: 'text-emerald-300', unit: 'submissions' },
  codeforces: { label: 'Codeforces', color: '#38bdf8', text: 'text-sky-300', unit: 'submissions' },
  other: { label: 'Other', color: '#34d399', text: 'text-emerald-300', unit: '' }
};

/** Sources for YearHeatmap, one per platform */
export const platformSources = (platforms = PLATFORMS) =>
  platforms.map((p) => ({ id: p, label: PLATFORM_META[p].label, color: PLATFORM_META[p].color, unit: PLATFORM_META[p].unit }));

export const RANGES = [
  { id: '30d', label: '30 days', days: 30 },
  { id: '90d', label: '90 days', days: 90 },
  { id: '6m', label: '6 months', days: 182 },
  { id: '1y', label: '1 year', days: 365 }
];

const pad = (n) => String(n).padStart(2, '0');

/** Local calendar day as 'YYYY-MM-DD' */
export function toKey(date = new Date()) {
  const d = date instanceof Date ? date : new Date(date);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function keyToDate(key) {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(key, n) {
  const d = keyToDate(key);
  d.setDate(d.getDate() + n);
  return toKey(d);
}

export function formatDay(key, opts = { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }) {
  return keyToDate(key).toLocaleDateString(undefined, opts);
}

/** Map of day -> { github, leetcode, codeforces, total } for the chosen platforms */
export function combineActivity(activity, platforms = PLATFORMS) {
  const out = {};
  platforms.forEach((p) => {
    Object.entries((activity && activity[p]) || {}).forEach(([day, count]) => {
      if (!count) return;
      if (!out[day]) out[day] = { github: 0, leetcode: 0, codeforces: 0, total: 0 };
      out[day][p] += count;
      out[day].total += count;
    });
  });
  return out;
}

/**
 * Current and longest streak of consecutive active days, and total active days.
 * The current streak still counts if today has no activity yet but yesterday did.
 */
export function computeStreaks(days) {
  const active = Object.keys(days).filter((k) => days[k] && (days[k].total ?? days[k]) > 0).sort();
  if (active.length === 0) return { current: 0, longest: 0, activeDays: 0 };
  const set = new Set(active);
  let longest = 1;
  let run = 1;
  for (let i = 1; i < active.length; i += 1) {
    run = addDays(active[i - 1], 1) === active[i] ? run + 1 : 1;
    if (run > longest) longest = run;
  }
  const today = toKey();
  let cursor = set.has(today) ? today : addDays(today, -1);
  let current = 0;
  while (set.has(cursor)) {
    current += 1;
    cursor = addDays(cursor, -1);
  }
  return { current, longest, activeDays: active.length };
}

/** Keep only days from `startKey` (inclusive) to today */
export function sliceDays(days, startKey) {
  const out = {};
  Object.entries(days).forEach(([k, v]) => { if (k >= startKey) out[k] = v; });
  return out;
}

/** Per-month totals for the last `months` months, per platform, plus active days */
export function monthlyBuckets(activity, months = 12, platforms = PLATFORMS) {
  const combined = combineActivity(activity, platforms);
  const now = new Date();
  const buckets = [];
  for (let i = months - 1; i >= 0; i -= 1) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const id = `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
    const daysInMonth = i === 0 ? now.getDate() : new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    buckets.push({
      id,
      label: d.toLocaleDateString(undefined, { month: 'short', year: '2-digit' }),
      github: 0, leetcode: 0, codeforces: 0, activeDays: 0, daysInMonth
    });
  }
  const index = Object.fromEntries(buckets.map((b, i) => [b.id, i]));
  Object.entries(combined).forEach(([day, v]) => {
    const i = index[day.slice(0, 7)];
    if (i === undefined) return;
    platforms.forEach((p) => { buckets[i][p] += v[p]; });
    if (v.total > 0) buckets[i].activeDays += 1;
  });
  return buckets.map((b) => ({ ...b, consistency: Math.round((b.activeDays / b.daysInMonth) * 100) }));
}

/** Per-week (Mon-Sun) totals for the last `weeks` weeks */
export function weeklyBuckets(activity, weeks = 12, platforms = PLATFORMS) {
  const combined = combineActivity(activity, platforms);
  const today = new Date();
  const monday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - ((today.getDay() + 6) % 7));
  const out = [];
  for (let w = weeks - 1; w >= 0; w -= 1) {
    const start = new Date(monday);
    start.setDate(start.getDate() - w * 7);
    const startKey = toKey(start);
    const bucket = {
      label: start.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
      github: 0, leetcode: 0, codeforces: 0, activeDays: 0
    };
    for (let d = 0; d < 7; d += 1) {
      const v = combined[addDays(startKey, d)];
      if (!v) continue;
      platforms.forEach((p) => { bucket[p] += v[p]; });
      if (v.total > 0) bucket.activeDays += 1;
    }
    out.push(bucket);
  }
  return out;
}

export function timeAgo(value) {
  if (!value) return 'never';
  const diff = Date.now() - new Date(value).getTime();
  if (diff < 60000) return 'just now';
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
}

export function formatDuration(seconds) {
  if (!seconds && seconds !== 0) return '—';
  const h = Math.floor(seconds / 3600);
  const m = Math.round((seconds % 3600) / 60);
  if (h >= 24) {
    const d = Math.floor(h / 24);
    return `${d}d ${h % 24}h`;
  }
  return h ? `${h}h${m ? ` ${m}m` : ''}` : `${m}m`;
}

export const fmt = (n) => (n === null || n === undefined || Number.isNaN(n) ? '—' : Number(n).toLocaleString());

/** Codeforces rank colours, as on codeforces.com */
export function cfRankColor(rank = '') {
  const r = rank.toLowerCase();
  if (r.includes('legendary') || r.includes('international grandmaster') || r === 'grandmaster') return 'text-rose-400';
  if (r.includes('master')) return 'text-orange-300';
  if (r.includes('candidate')) return 'text-fuchsia-300';
  if (r.includes('expert')) return 'text-blue-300';
  if (r.includes('specialist')) return 'text-cyan-300';
  if (r.includes('pupil')) return 'text-emerald-300';
  if (r.includes('newbie')) return 'text-slate-300';
  return 'text-slate-400';
}

/* ── Months ('YYYY-MM') for the monthly heatmaps ── */

export function toMonth(date = new Date()) {
  const d = date instanceof Date ? date : new Date(date);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
}

export function addMonths(month, n) {
  const [y, m] = month.split('-').map(Number);
  return toMonth(new Date(y, m - 1 + n, 1));
}

export function formatMonth(month, opts = { month: 'long', year: 'numeric' }) {
  const [y, m] = month.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString(undefined, opts);
}

/** Every day of a month as 'YYYY-MM-DD' */
export function daysOfMonth(month) {
  const [y, m] = month.split('-').map(Number);
  const count = new Date(y, m, 0).getDate();
  return Array.from({ length: count }, (_, i) => `${month}-${pad(i + 1)}`);
}

/**
 * Oldest month the heatmaps can navigate to: the first month with stored
 * activity, but always at least the last 12 months.
 */
export function earliestMonth(days, minBack = 11) {
  const floor = addMonths(toMonth(), -minBack);
  const keys = Object.keys(days || {}).filter((k) => (days[k]?.total ?? days[k]) > 0).sort();
  if (!keys.length) return floor;
  const first = keys[0].slice(0, 7);
  return first < floor ? first : floor;
}

/**
 * Intensity level (0-4) for a day's count, from the quartiles of all active
 * days, so the same colour means the same amount of activity in every month.
 */
export function intensityScale(days) {
  const values = Object.values(days || {})
    .map((v) => (typeof v === 'number' ? v : v?.total || 0))
    .filter((n) => n > 0)
    .sort((a, b) => a - b);
  const q = (p) => values[Math.min(values.length - 1, Math.floor(p * values.length))] || 1;
  const t = [q(0.25), q(0.5), q(0.75)];
  return (n) => (n <= 0 ? 0 : n <= t[0] ? 1 : n <= t[1] ? 2 : n <= t[2] ? 3 : 4);
}
