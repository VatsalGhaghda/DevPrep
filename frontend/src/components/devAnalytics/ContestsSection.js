import { useEffect, useMemo, useState } from 'react';
import { CalendarClock, ExternalLink, RefreshCw, Trophy } from 'lucide-react';
import { Card, Segmented, ListRow, ListEmpty, ListSkeleton } from './ui';
import { PLATFORM_META, formatDuration, fmt } from '../../utils/devAnalytics';

function useNow(intervalMs = 1000) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

function statusOf(c, now) {
  const end = c.start + (c.durationSeconds || 0) * 1000;
  if (now < c.start) return 'upcoming';
  if (now < end) return 'ongoing';
  return 'finished';
}

function countdown(ms) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const p = (n) => String(n).padStart(2, '0');
  return d ? `${d}d ${p(h)}h ${p(m)}m` : `${p(h)}:${p(m)}:${p(sec)}`;
}

const STATUS_STYLE = {
  upcoming: 'bg-violet-600/15 border-violet-400/30 text-violet-200',
  ongoing: 'bg-emerald-600/15 border-emerald-400/30 text-emerald-200',
  finished: 'bg-slate-600/15 border-slate-400/20 text-slate-400'
};

export default function ContestsSection({ contests, loading, onRefresh, data }) {
  const now = useNow();
  const [platform, setPlatform] = useState('all');
  const [status, setStatus] = useState('active');

  const list = useMemo(() => {
    const rows = (contests?.contests || []).map((c) => ({ ...c, status: statusOf(c, now) }));
    return rows
      .filter((c) => platform === 'all' || c.platform === platform)
      .filter((c) => (status === 'active' ? c.status !== 'finished' : c.status === 'finished'))
      .sort((a, b) => (status === 'active' ? a.start - b.start : b.start - a.start));
  }, [contests, platform, status, now]);

  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const errors = Object.entries(contests?.errors || {});

  // The user's own contest history from connected platforms
  const myHistory = useMemo(() => {
    const cf = (data?.codeforces?.ratingHistory || []).map((h) => ({
      key: `cf-${h.contestId}`, platform: 'codeforces', name: h.contestName, time: h.time,
      detail: `rank #${fmt(h.rank)}`, rating: h.newRating, change: h.newRating - h.oldRating,
      url: `https://codeforces.com/contest/${h.contestId}`
    }));
    const lc = (data?.leetcode?.contest?.history || []).map((h) => ({
      key: `lc-${h.title}`, platform: 'leetcode', name: h.title, time: h.startTime,
      detail: `rank #${fmt(h.ranking)} · solved ${h.solved}/${h.total}`, rating: h.rating, change: null, url: null
    }));
    return [...cf, ...lc].sort((a, b) => b.time - a.time);
  }, [data]);

  return (
    <div className="space-y-4">
      <Card
        title="Coding contests"
        icon={CalendarClock}
        count={contests ? list.length : null}
        subtitle={`Times shown in ${tz}`}
        scroll
        bodyHeight="h-[26rem]"
        footer={!contests?.otherSourceConfigured && (
          <p className="text-xs text-slate-500">
            Contests from other judges (AtCoder, CodeChef and more) appear when the server has a clist.by API key.
          </p>
        )}
        action={(
          <button
            type="button"
            onClick={onRefresh}
            disabled={loading}
            className="h-8 px-3 rounded-lg bg-white/5 border border-white/10 hover:border-white/20 text-xs text-slate-200 inline-flex items-center gap-1.5 disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
        )}
      >
        <div className="sticky top-0 z-10 -mx-1 px-1 pb-3 mb-1 flex flex-wrap items-center gap-2 bg-[#1b1b29]/95 backdrop-blur">
          <Segmented
            value={platform}
            onChange={setPlatform}
            options={[
              { id: 'all', label: 'All' },
              { id: 'leetcode', label: 'LeetCode' },
              { id: 'codeforces', label: 'Codeforces' },
              ...(contests?.otherSourceConfigured ? [{ id: 'other', label: 'Other' }] : [])
            ]}
          />
          <Segmented
            value={status}
            onChange={setStatus}
            options={[{ id: 'active', label: 'Upcoming & live' }, { id: 'finished', label: 'Recently finished' }]}
          />
        </div>

        {errors.length > 0 && (
          <div className="mb-3 text-xs text-amber-300">
            {errors.map(([k, v]) => <div key={k}>{PLATFORM_META[k]?.label || k}: {v}</div>)}
          </div>
        )}

        {loading && !contests ? (
          <ListSkeleton rows={6} />
        ) : list.length === 0 ? (
          <ListEmpty icon={CalendarClock} title="No contests to show" message="Nothing matches these filters right now." />
        ) : (
          <ul className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {list.map((c) => {
              const end = c.start + (c.durationSeconds || 0) * 1000;
              const meta = PLATFORM_META[c.platform] || PLATFORM_META.other;
              return (
                <li key={c.id} className="rounded-2xl bg-white/5 border border-white/10 p-4 flex flex-col gap-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-slate-100">{c.name}</div>
                      <div className="text-xs mt-0.5">
                        <span className={meta.text}>{c.platform === 'other' ? c.host : meta.label}</span>
                        {c.category && c.platform !== 'other' && <span className="text-slate-500"> · {c.category}</span>}
                      </div>
                    </div>
                    <span className={`px-2 py-0.5 rounded-lg border text-[11px] font-semibold capitalize flex-shrink-0 ${STATUS_STYLE[c.status]}`}>{c.status}</span>
                  </div>
                  <div className="text-xs text-slate-400">
                    {new Date(c.start).toLocaleString(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', timeZoneName: 'short' })}
                    {' · '}{formatDuration(c.durationSeconds)}
                  </div>
                  <div className="flex items-center justify-between gap-2 mt-auto">
                    <span className="text-sm font-mono text-slate-200">
                      {c.status === 'upcoming' && <>Starts in {countdown(c.start - now)}</>}
                      {c.status === 'ongoing' && <span className="text-emerald-300">Ends in {countdown(end - now)}</span>}
                      {c.status === 'finished' && <span className="text-slate-500">Finished</span>}
                    </span>
                    <a
                      href={c.url}
                      target="_blank"
                      rel="noreferrer"
                      className="h-8 px-3 rounded-lg bg-violet-600/80 hover:bg-violet-600 border border-violet-500/50 text-xs font-semibold text-white inline-flex items-center gap-1.5"
                    >
                      {c.status === 'upcoming' ? 'Register' : 'Open'} <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <Card title="Your contest history" icon={Trophy} count={myHistory.length || null} subtitle="LeetCode and Codeforces, newest first" scroll>
        {myHistory.length ? (
          <ul className="space-y-2">
            {myHistory.map((h) => (
              <ListRow key={h.key}>
                <div className="min-w-0">
                  <div className="text-sm text-slate-200 truncate">
                    {h.url ? <a href={h.url} target="_blank" rel="noreferrer" className="hover:text-violet-300">{h.name}</a> : h.name}
                  </div>
                  <div className="text-xs text-slate-500 truncate">
                    <span className={PLATFORM_META[h.platform].text}>{PLATFORM_META[h.platform].label}</span>
                    {' · '}{new Date(h.time).toLocaleDateString()} · {h.detail}
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="text-sm font-semibold text-slate-100">{fmt(h.rating)}</div>
                  {h.change != null && (
                    <div className={`text-xs ${h.change >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>{h.change >= 0 ? '+' : ''}{h.change}</div>
                  )}
                </div>
              </ListRow>
            ))}
          </ul>
        ) : (
          <ListEmpty icon={Trophy} title="No contest history" message="Connect LeetCode or Codeforces to see the contests you've taken part in." />
        )}
      </Card>
    </div>
  );
}
