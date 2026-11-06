import { useMemo, useState } from 'react';
import {
  ResponsiveContainer, BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, Legend
} from 'recharts';
import { Activity, Award, CalendarDays, Flame, Link2, Sparkles, TrendingUp, Trophy } from 'lucide-react';
import YearHeatmap from './YearHeatmap';
import { Card, StatTile, EmptyState, Segmented, ListRow, ListEmpty, chartTooltipStyle } from './ui';
import { StatusPill } from './ConnectionsSection';
import {
  PLATFORMS, PLATFORM_META, RANGES, addDays, toKey, combineActivity, computeStreaks, sliceDays,
  platformSources, monthlyBuckets, weeklyBuckets, fmt, timeAgo
} from '../../utils/devAnalytics';

const axis = { stroke: '#64748b', fontSize: 11, tickLine: false, axisLine: false };

function connectedPlatforms(analytics) {
  return PLATFORMS.filter((p) => analytics?.connections?.[p]);
}

/** Headline numbers. Each one stays tied to its platform so nothing is double counted. */
export function useOverallStats(analytics) {
  return useMemo(() => {
    const d = analytics?.data || {};
    const all = combineActivity(analytics?.activity, PLATFORMS);
    const streaks = computeStreaks(all);
    const lcSolved = d.leetcode?.solved?.all ?? null;
    const cfSolved = d.codeforces?.solvedCount ?? null;
    const lcContests = d.leetcode?.contest?.attended ?? (d.leetcode ? 0 : null);
    const cfContests = d.codeforces?.contestsAttended ?? null;
    return {
      lcSolved,
      cfSolved,
      totalSolved: lcSolved == null && cfSolved == null ? null : (lcSolved || 0) + (cfSolved || 0),
      ghContributions: d.github?.contributions?.total ?? null,
      ghSource: d.github?.contributions?.source,
      lcContests,
      cfContests,
      totalContests: lcContests == null && cfContests == null ? null : (lcContests || 0) + (cfContests || 0),
      ...streaks
    };
  }, [analytics]);
}

function solvedSub(s) {
  const parts = [];
  if (s.lcSolved != null) parts.push(`LeetCode ${fmt(s.lcSolved)}`);
  if (s.cfSolved != null) parts.push(`Codeforces ${fmt(s.cfSolved)}`);
  return parts.join(' · ') || 'connect LeetCode or Codeforces';
}

function contestSub(s) {
  const parts = [];
  if (s.lcContests != null) parts.push(`LeetCode ${fmt(s.lcContests)}`);
  if (s.cfContests != null) parts.push(`Codeforces ${fmt(s.cfContests)}`);
  return parts.join(' · ') || null;
}

/* ── Overview ───────────────────────────────────────────────────────────── */

export function OverviewSection({ analytics, onGo }) {
  const stats = useOverallStats(analytics);
  const connected = connectedPlatforms(analytics);
  const recent = useMemo(() => {
    const d = analytics?.data || {};
    const rows = [];
    (d.leetcode?.recent || []).forEach((s) => rows.push({
      key: `lc-${s.url}-${s.timestamp}`, platform: 'leetcode', time: s.timestamp, title: s.title, url: s.url,
      detail: s.status, good: s.status === 'Accepted'
    }));
    (d.codeforces?.recent || []).forEach((s) => rows.push({
      key: `cf-${s.id}`, platform: 'codeforces', time: s.time, title: `${s.contestId || ''}${s.index || ''} ${s.name}`.trim(), url: s.url,
      detail: s.verdict === 'OK' ? 'Accepted' : s.verdict.replace(/_/g, ' ').toLowerCase(), good: s.verdict === 'OK'
    }));
    (d.github?.topRepos || []).forEach((r) => rows.push({
      key: `gh-${r.name}`, platform: 'github', time: new Date(r.pushedAt).getTime(), title: r.name, url: r.url,
      detail: 'pushed', good: true
    }));
    return rows.filter((r) => r.time).sort((a, b) => b.time - a.time).slice(0, 40);
  }, [analytics]);

  if (connected.length === 0) {
    return (
      <EmptyState
        title="Connect your coding profiles"
        message="Add your GitHub, LeetCode and Codeforces profiles to track your activity, ratings and streaks in one place."
        action={(
          <button type="button" onClick={() => onGo('connections')} className="h-10 px-5 rounded-xl bg-violet-600 hover:bg-violet-700 border border-violet-500 text-white text-sm font-semibold">
            Connect profiles
          </button>
        )}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatTile label="Problems solved" value={fmt(stats.totalSolved)} sub={solvedSub(stats)} accent="text-emerald-300" />
        <StatTile
          label={stats.ghSource === 'events' ? 'GitHub events (90 days)' : 'GitHub contributions (1 year)'}
          value={fmt(stats.ghContributions)}
          sub={analytics?.connections?.github ? null : 'GitHub not connected'}
          accent="text-violet-300"
        />
        <StatTile label="Current streak" value={`${stats.current} day${stats.current === 1 ? '' : 's'}`} sub={`Longest ${stats.longest} days`} accent="text-amber-300" />
        <StatTile label="Active coding days" value={fmt(stats.activeDays)} sub={`${fmt(stats.totalContests)} contests · ${contestSub(stats) || ''}`} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card title="Platforms" icon={Link2} className="lg:col-span-1">
          <ul className="space-y-2">
            {PLATFORMS.map((p) => {
              const c = analytics?.connections?.[p];
              return (
                <li key={p} className="flex items-center justify-between gap-2 rounded-xl bg-white/5 border border-white/5 px-3 py-2">
                  <button type="button" onClick={() => onGo(c ? p : 'connections')} className="text-left min-w-0">
                    <div className={`text-sm font-semibold ${PLATFORM_META[p].text}`}>{PLATFORM_META[p].label}</div>
                    <div className="text-xs text-slate-500 truncate">{c ? `${c.username} · synced ${timeAgo(c.lastSyncedAt)}` : 'Not connected'}</div>
                  </button>
                  <StatusPill connection={c} />
                </li>
              );
            })}
          </ul>
        </Card>

        <Card
          title="Recent activity"
          icon={Activity}
          className="lg:col-span-2"
          count={recent.length || null}
          subtitle="Latest submissions and pushes across platforms"
          bodyHeight="h-[17rem]"
          scroll
        >
          {recent.length ? (
            <ul className="space-y-2">
              {recent.map((r) => (
                <ListRow key={r.key}>
                  <div className="min-w-0">
                    {r.url
                      ? <a href={r.url} target="_blank" rel="noreferrer" className="text-sm text-slate-200 hover:text-violet-300 truncate block">{r.title}</a>
                      : <span className="text-sm text-slate-200 truncate block">{r.title}</span>}
                    <div className="text-xs text-slate-500">
                      <span className={PLATFORM_META[r.platform].text}>{PLATFORM_META[r.platform].label}</span> · {timeAgo(r.time)}
                    </div>
                  </div>
                  <span className={`text-xs capitalize flex-shrink-0 ${r.good ? 'text-emerald-300' : 'text-rose-300'}`}>{r.detail}</span>
                </ListRow>
              ))}
            </ul>
          ) : <ListEmpty icon={Activity} title="No recent activity yet" message="Submissions and pushes appear here after a sync." />}
        </Card>
      </div>

      <Card title="Coding activity" icon={CalendarDays} action={(
        <button type="button" onClick={() => onGo('activity')} className="text-xs text-violet-300 hover:text-violet-200">Streaks and ranges</button>
      )}>
        <YearHeatmap sources={platformSources(connected)} activity={analytics?.activity} title="Coding activity" />
      </Card>
    </div>
  );
}

/* ── Activity ───────────────────────────────────────────────────────────── */

export function ActivitySection({ analytics }) {
  const [range, setRange] = useState('1y');
  const [platform, setPlatform] = useState('all');
  const connected = connectedPlatforms(analytics);
  const platforms = platform === 'all' ? connected : [platform];

  const days = useMemo(() => combineActivity(analytics?.activity, platforms), [analytics, platforms.join(',')]);
  const startKey = addDays(toKey(), -(RANGES.find((r) => r.id === range).days - 1));
  const inRange = useMemo(() => sliceDays(days, startKey), [days, startKey]);
  const rangeStreaks = useMemo(() => computeStreaks(inRange), [inRange]);
  const overall = useMemo(() => computeStreaks(days), [days]);
  const totals = useMemo(() => {
    const t = { github: 0, leetcode: 0, codeforces: 0 };
    Object.values(inRange).forEach((v) => PLATFORMS.forEach((p) => { t[p] += v[p]; }));
    return t;
  }, [inRange]);

  if (connected.length === 0) {
    return <EmptyState title="No activity yet" message="Connect at least one platform to see your coding heatmap." />;
  }

  return (
    <div className="space-y-4">
      <Card
        title="Coding activity"
        icon={CalendarDays}
        action={(
          <div className="flex flex-wrap gap-2">
            <Segmented
              value={platform}
              onChange={setPlatform}
              options={[{ id: 'all', label: 'All platforms' }, ...connected.map((p) => ({ id: p, label: PLATFORM_META[p].label }))]}
            />
          </div>
        )}
      >
        <YearHeatmap
          sources={platformSources(connected)}
          activity={analytics?.activity}
          filter={platform}
          onFilterChange={setPlatform}
          showFilter={false}
          title="Coding activity"
        />
        <div className="mt-5 pt-4 border-t border-white/5 flex items-center justify-between gap-2">
          <span className="text-sm font-semibold text-slate-100">Streaks and totals</span>
          <Segmented value={range} onChange={setRange} options={RANGES.map((r) => ({ id: r.id, label: r.label }))} />
        </div>
        <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatTile label="Current streak" value={`${overall.current}d`} accent="text-amber-300" />
          <StatTile label="Longest streak (range)" value={`${rangeStreaks.longest}d`} sub={`all time ${overall.longest}d`} />
          <StatTile label="Active days (range)" value={fmt(rangeStreaks.activeDays)} sub={`of ${RANGES.find((r) => r.id === range).days}`} />
          <StatTile label="Active days (all history)" value={fmt(overall.activeDays)} />
        </div>
        <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-3">
          {platforms.map((p) => (
            <StatTile key={p} label={`${PLATFORM_META[p].label} ${PLATFORM_META[p].unit}`} value={fmt(totals[p])} sub="in selected range" accent={PLATFORM_META[p].text} />
          ))}
        </div>
      </Card>

      <p className="text-xs text-slate-500">
        Each platform counts something different (GitHub contributions, LeetCode and Codeforces submissions); the tooltip keeps each platform's own number.
        Days are shown where the platform's data is available: GitHub's calendar covers a year (90 days of events without a token), LeetCode's covers the past 12 months, and older days are kept from earlier syncs.
      </p>
    </div>
  );
}

/* ── Insights ───────────────────────────────────────────────────────────── */

function buildAchievements(analytics, stats) {
  const d = analytics?.data || {};
  const out = [];
  const milestone = (value, steps) => steps.filter((s) => value >= s).pop();
  const lc = d.leetcode;
  if (lc) {
    const m = milestone(lc.solved?.all || 0, [10, 50, 100, 250, 500, 1000, 2000]);
    if (m) out.push({ platform: 'leetcode', title: `${m}+ LeetCode problems solved`, detail: `${fmt(lc.solved.all)} solved` });
    if (lc.solved?.hard >= 10) out.push({ platform: 'leetcode', title: `${milestone(lc.solved.hard, [10, 50, 100, 250, 500])}+ hard problems`, detail: `${fmt(lc.solved.hard)} hard solved` });
    if (lc.contest?.maxRating) out.push({ platform: 'leetcode', title: `Best contest rating ${fmt(lc.contest.maxRating)}`, detail: lc.contest.badge ? `${lc.contest.badge} badge` : `${fmt(lc.contest.attended)} contests` });
  }
  const cf = d.codeforces;
  if (cf) {
    if (cf.profile?.maxRank && cf.profile.maxRank !== 'unrated') out.push({ platform: 'codeforces', title: `Reached ${cf.profile.maxRank}`, detail: `max rating ${fmt(cf.profile.maxRating)}` });
    const m = milestone(cf.solvedCount || 0, [10, 50, 100, 250, 500, 1000, 2000]);
    if (m) out.push({ platform: 'codeforces', title: `${m}+ Codeforces problems solved`, detail: `${fmt(cf.solvedCount)} solved` });
    const best = (cf.ratingHistory || []).reduce((b, h) => (!b || h.newRating - h.oldRating > b.newRating - b.oldRating ? h : b), null);
    if (best && best.newRating - best.oldRating > 0) out.push({ platform: 'codeforces', title: `Best rating gain +${best.newRating - best.oldRating}`, detail: best.contestName });
  }
  const gh = d.github;
  if (gh) {
    if (gh.totals?.stars >= 10) out.push({ platform: 'github', title: `${milestone(gh.totals.stars, [10, 50, 100, 500, 1000])}+ GitHub stars`, detail: `${fmt(gh.totals.stars)} stars on your repositories` });
    if (gh.contributions?.source === 'graphql' && gh.contributions.total >= 100) {
      out.push({ platform: 'github', title: `${milestone(gh.contributions.total, [100, 250, 500, 1000, 2000])}+ contributions this year`, detail: `${fmt(gh.contributions.total)} contributions` });
    }
  }
  if (stats.longest >= 7) out.push({ platform: null, title: `${stats.longest}-day coding streak`, detail: 'longest run across all platforms' });
  return out;
}

export function InsightsSection({ analytics }) {
  const stats = useOverallStats(analytics);
  const connected = connectedPlatforms(analytics);
  const monthly = useMemo(() => monthlyBuckets(analytics?.activity, 12, connected), [analytics]);
  const weekly = useMemo(() => weeklyBuckets(analytics?.activity, 12, connected), [analytics]);
  const achievements = useMemo(() => buildAchievements(analytics, stats), [analytics, stats]);

  const ratingSeries = useMemo(() => {
    const d = analytics?.data || {};
    const rows = [];
    (d.codeforces?.ratingHistory || []).forEach((h) => rows.push({ time: h.time, codeforces: h.newRating, name: h.contestName }));
    (d.leetcode?.contest?.history || []).forEach((h) => rows.push({ time: h.startTime, leetcode: h.rating, name: h.title }));
    return rows.sort((a, b) => a.time - b.time);
  }, [analytics]);

  const lc = analytics?.data?.leetcode;
  const cf = analytics?.data?.codeforces;

  if (connected.length === 0) {
    return <EmptyState title="No insights yet" message="Connect a platform and sync to see your trends." />;
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <StatTile label="Problems solved" value={fmt(stats.totalSolved)} sub={solvedSub(stats)} accent="text-emerald-300" />
        <StatTile label={stats.ghSource === 'events' ? 'GitHub events (90d)' : 'GitHub contributions (1y)'} value={fmt(stats.ghContributions)} accent="text-violet-300" />
        <StatTile label="Active coding days" value={fmt(stats.activeDays)} />
        <StatTile label="Streak" value={`${stats.current}d`} sub={`longest ${stats.longest}d`} accent="text-amber-300" />
        <StatTile label="Contests" value={fmt(stats.totalContests)} sub={contestSub(stats)} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card title="LeetCode problems by difficulty" icon={TrendingUp}>
          {lc ? (
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={['easy', 'medium', 'hard'].map((k) => ({ name: k[0].toUpperCase() + k.slice(1), solved: lc.solved?.[k] || 0 }))}>
                  <CartesianGrid stroke="rgba(255,255,255,0.05)" vertical={false} />
                  <XAxis dataKey="name" {...axis} />
                  <YAxis {...axis} width={36} allowDecimals={false} />
                  <Tooltip {...chartTooltipStyle} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
                  <Bar dataKey="solved" fill="#22c55e" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : <p className="text-sm text-slate-500">LeetCode not connected.</p>}
        </Card>
        <Card title="Codeforces problems by rating" icon={TrendingUp}>
          {cf?.difficulty?.length ? (
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={cf.difficulty}>
                  <CartesianGrid stroke="rgba(255,255,255,0.05)" vertical={false} />
                  <XAxis dataKey="rating" {...axis} />
                  <YAxis {...axis} width={36} allowDecimals={false} />
                  <Tooltip {...chartTooltipStyle} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
                  <Bar dataKey="count" name="solved" fill="#38bdf8" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : <p className="text-sm text-slate-500">{cf ? 'No solved problems yet.' : 'Codeforces not connected.'}</p>}
        </Card>
      </div>

      <Card title="Monthly activity by platform" icon={CalendarDays}>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={monthly}>
              <CartesianGrid stroke="rgba(255,255,255,0.05)" vertical={false} />
              <XAxis dataKey="label" {...axis} />
              <YAxis {...axis} width={36} allowDecimals={false} />
              <Tooltip {...chartTooltipStyle} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              {connected.map((p) => (
                <Bar key={p} dataKey={p} name={`${PLATFORM_META[p].label} ${PLATFORM_META[p].unit}`} fill={PLATFORM_META[p].color} radius={[4, 4, 0, 0]} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
        <p className="mt-2 text-xs text-slate-500">Bars are side by side, not stacked, because each platform counts a different kind of activity.</p>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card title="Weekly consistency (active days per week)" icon={Flame}>
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={weekly}>
                <CartesianGrid stroke="rgba(255,255,255,0.05)" vertical={false} />
                <XAxis dataKey="label" {...axis} minTickGap={12} />
                <YAxis {...axis} width={24} domain={[0, 7]} allowDecimals={false} />
                <Tooltip {...chartTooltipStyle} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
                <Bar dataKey="activeDays" name="active days" fill="#8b5cf6" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card title="Monthly productivity (active days and % of days)" icon={TrendingUp}>
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={monthly}>
                <CartesianGrid stroke="rgba(255,255,255,0.05)" vertical={false} />
                <XAxis dataKey="label" {...axis} />
                <YAxis yAxisId="d" {...axis} width={28} allowDecimals={false} />
                <YAxis yAxisId="p" orientation="right" {...axis} width={36} domain={[0, 100]} unit="%" />
                <Tooltip {...chartTooltipStyle} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Line yAxisId="d" type="monotone" dataKey="activeDays" name="active days" stroke="#34d399" strokeWidth={2} dot={{ r: 2 }} />
                <Line yAxisId="p" type="monotone" dataKey="consistency" name="% of days active" stroke="#a78bfa" strokeWidth={2} dot={{ r: 2 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <Card title="Contest rating progression" icon={Trophy}>
        {ratingSeries.length ? (
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={ratingSeries}>
                <CartesianGrid stroke="rgba(255,255,255,0.05)" vertical={false} />
                <XAxis
                  dataKey="time"
                  type="number"
                  scale="time"
                  domain={['dataMin', 'dataMax']}
                  tickFormatter={(t) => new Date(t).toLocaleDateString(undefined, { month: 'short', year: '2-digit' })}
                  {...axis}
                />
                <YAxis {...axis} width={40} domain={['dataMin - 100', 'dataMax + 100']} />
                <Tooltip {...chartTooltipStyle} labelFormatter={(t, p) => `${p?.[0]?.payload?.name || ''} · ${new Date(t).toLocaleDateString()}`} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                {cf && <Line type="monotone" dataKey="codeforces" name="Codeforces" stroke="#38bdf8" strokeWidth={2} dot={{ r: 2 }} connectNulls />}
                {lc && <Line type="monotone" dataKey="leetcode" name="LeetCode" stroke="#22c55e" strokeWidth={2} dot={{ r: 2 }} connectNulls />}
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : <p className="text-sm text-slate-500">No rated contests on connected platforms yet.</p>}
        <p className="mt-2 text-xs text-slate-500">LeetCode and Codeforces ratings use different scales and are not comparable with each other.</p>
      </Card>

      <Card title="Achievements and milestones" icon={Award} count={achievements.length || null} subtitle="Based on your real numbers from each platform" bodyHeight="max-h-[20rem]" scroll>
        {achievements.length ? (
          <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {achievements.map((a) => (
              <li key={a.title} className="rounded-2xl bg-white/5 border border-white/10 p-4">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-amber-300" />
                  <span className="text-sm font-semibold text-slate-100">{a.title}</span>
                </div>
                <div className="text-xs text-slate-400 mt-1">
                  {a.platform && <span className={PLATFORM_META[a.platform].text}>{PLATFORM_META[a.platform].label} · </span>}
                  {a.detail}
                </div>
              </li>
            ))}
          </ul>
        ) : <ListEmpty icon={Award} title="No milestones yet" message="Keep going. Milestones appear here as you reach them." />}
      </Card>
    </div>
  );
}
