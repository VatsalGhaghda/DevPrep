import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, ReferenceLine
} from 'recharts';
import {
  Award, BookOpen, Brain, CalendarDays, CheckCircle2, Code2, ExternalLink, FileText, Flame, Globe, Lock, Mail,
  MessageSquare, PencilLine, Target, Trophy, TrendingUp, UserCircle2, Zap
} from 'lucide-react';
import { Card, ListRow, ListEmpty, ListSkeleton, chartTooltipStyle } from '../devAnalytics/ui';
import { PLATFORM_META, fmt, timeAgo, cfRankColor } from '../../utils/devAnalytics';

const axis = { stroke: '#64748b', fontSize: 11, tickLine: false, axisLine: false };
const DIFF = [
  { key: 'easy', label: 'Easy', color: '#22c55e' },
  { key: 'medium', label: 'Medium', color: '#f59e0b' },
  { key: 'hard', label: 'Hard', color: '#ef4444' }
];
const pct = (a, b) => (b > 0 ? Math.round((a / b) * 100) : 0);
const label = (v) => {
  const s = String(v || '').trim();
  if (!s) return 'Other';
  if (s.toLowerCase() === 'hr') return 'HR';
  const known = { cpp: 'C++', 'c++': 'C++', javascript: 'JavaScript', typescript: 'TypeScript', csharp: 'C#', golang: 'Go', sql: 'SQL', oop: 'OOP', dsa: 'DSA' };
  if (known[s.toLowerCase()]) return known[s.toLowerCase()];
  return s.split(/[-_\s]+/).map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
};

/* ── Hero ─────────────────────────────────────────────────────────────── */

export function ProfileHero({ loading, displayName, email, profile, avatar, completeness, onEdit, readOnly = false, actions }) {
  const joined = profile?.createdAt || profile?.memberSince;
  const memberSince = joined
    ? new Date(joined).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
    : null;
  const isPublic = profile?.isProfilePublic !== false && profile?.username;
  return (
    <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-white/5 backdrop-blur-xl shadow-[0_10px_40px_rgba(0,0,0,0.35)]">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute -top-24 -right-24 w-72 h-72 rounded-full bg-violet-600/20 blur-3xl" />
        <div className="absolute -bottom-24 -left-24 w-72 h-72 rounded-full bg-cyan-600/15 blur-3xl" />
      </div>
      <div className="relative p-5 sm:p-7 grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-6">
        <div className="flex flex-col sm:flex-row gap-5 min-w-0">
          {loading ? (
            <div className="w-24 h-24 rounded-3xl bg-white/10 animate-pulse border border-white/10 flex-shrink-0" />
          ) : avatar ? (
            <img src={avatar} alt="" className="w-24 h-24 rounded-3xl border border-white/10 object-cover flex-shrink-0" />
          ) : (
            <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-cyan-400/25 via-violet-400/25 to-pink-400/25 border border-white/10 flex items-center justify-center flex-shrink-0">
              <span className="text-3xl font-semibold text-white">{(displayName?.[0] || 'U').toUpperCase()}</span>
            </div>
          )}
          <div className="min-w-0 flex-1">
            {loading ? (
              <div className="space-y-2">
                <div className="h-8 w-56 bg-white/10 rounded-lg animate-pulse" />
                <div className="h-4 w-40 bg-white/10 rounded animate-pulse" />
                <div className="h-4 w-72 bg-white/10 rounded animate-pulse" />
              </div>
            ) : (
              <>
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-2xl sm:text-3xl font-bold text-slate-50 truncate">{displayName}</h1>
                  {profile?.experienceLevel && (
                    <span className="px-2 py-0.5 rounded-lg bg-violet-500/15 border border-violet-400/25 text-xs font-medium text-violet-200">
                      {profile.experienceLevel}
                    </span>
                  )}
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-400">
                  {profile?.username && <span className="text-slate-300">@{profile.username}</span>}
                  {profile?.targetRole && (
                    <span className="inline-flex items-center gap-1.5"><Target className="w-3.5 h-3.5" />{profile.targetRole}</span>
                  )}
                  {email && <span className="inline-flex items-center gap-1.5 min-w-0"><Mail className="w-3.5 h-3.5 flex-shrink-0" /><span className="truncate">{email}</span></span>}
                  {memberSince && <span className="inline-flex items-center gap-1.5"><CalendarDays className="w-3.5 h-3.5" />Joined {memberSince}</span>}
                </div>
                {profile?.bio ? (
                  <p className="mt-3 text-sm text-slate-300 whitespace-pre-wrap max-w-3xl line-clamp-4">{profile.bio}</p>
                ) : readOnly ? null : (
                  <button type="button" onClick={onEdit} className="mt-3 text-sm text-slate-500 hover:text-violet-300">
                    Add a short bio so others know what you work on.
                  </button>
                )}
                <div className="mt-4 flex flex-wrap gap-2">
                  {(profile?.skills || []).slice(0, 14).map((s) => (
                    <span key={s} className="px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 text-xs text-slate-200">{s}</span>
                  ))}
                  {!readOnly && !(profile?.skills || []).length && (
                    <button type="button" onClick={onEdit} className="px-2.5 py-1 rounded-lg border border-dashed border-white/15 text-xs text-slate-400 hover:text-violet-300">
                      + Add skills
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        </div>

        {readOnly ? (actions ? <div className="flex flex-col gap-3 lg:w-64">{actions}</div> : null) : (
        <div className="flex flex-col gap-3 lg:w-64">
          <button
            type="button"
            onClick={onEdit}
            className="h-10 px-4 rounded-xl bg-violet-600 hover:bg-violet-700 border border-violet-500 text-white text-sm font-semibold inline-flex items-center justify-center gap-2 shadow-[0_0_15px_rgba(139,92,246,0.2)]"
          >
            <PencilLine className="w-4 h-4" /> Edit profile
          </button>
          {!loading && (
            isPublic ? (
              <Link
                to={`/profile/${profile.username}`}
                className="h-10 px-4 rounded-xl bg-white/5 border border-white/10 hover:border-white/20 text-sm text-slate-200 inline-flex items-center justify-center gap-2"
              >
                <Globe className="w-4 h-4 text-emerald-300" /> View public profile
              </Link>
            ) : (
              <div className="h-10 px-4 rounded-xl bg-white/5 border border-white/10 text-sm text-slate-400 inline-flex items-center justify-center gap-2">
                <Lock className="w-4 h-4" /> Profile is private
              </div>
            )
          )}
          {!loading && completeness && completeness.done < completeness.total && (
            <div className="rounded-xl bg-black/20 border border-white/10 p-3">
              <div className="flex justify-between text-xs">
                <span className="text-slate-300">Profile completeness</span>
                <span className="text-slate-100 font-semibold">{pct(completeness.done, completeness.total)}%</span>
              </div>
              <div className="mt-2 h-1.5 rounded-full bg-white/5 overflow-hidden">
                <div className="h-full rounded-full bg-gradient-to-r from-violet-500 to-cyan-400" style={{ width: `${pct(completeness.done, completeness.total)}%` }} />
              </div>
              <div className="mt-2 text-[11px] text-slate-500">Missing: {completeness.missing.join(', ')}</div>
            </div>
          )}
        </div>
        )}
      </div>
    </div>
  );
}

/* ── KPI strip ────────────────────────────────────────────────────────── */

export function Kpi({ icon: Icon, iconClass, label: l, value, sub, loading }) {
  return (
    <div className="rounded-2xl bg-[#1e1e2d]/60 border border-white/10 backdrop-blur-xl p-4 min-w-0">
      <div className="flex items-center gap-2 text-xs text-slate-400">
        <Icon className={`w-3.5 h-3.5 ${iconClass}`} />
        <span className="truncate">{l}</span>
      </div>
      {loading
        ? <div className="mt-2 h-7 w-16 rounded bg-white/10 animate-pulse" />
        : <div className="mt-1 text-2xl font-bold text-slate-50">{value}</div>}
      {sub && !loading && <div className="mt-0.5 text-xs text-slate-500 truncate">{sub}</div>}
    </div>
  );
}

export function KpiStrip({ loading, coding, streak, overview, savedStats }) {
  const done = overview?.completedInterviews || 0;
  const total = overview?.totalInterviews || 0;
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
      <Kpi loading={loading} icon={CheckCircle2} iconClass="text-emerald-400" label="Problems solved"
        value={fmt(coding?.totalSolved || 0)} sub={coding?.totalProblems ? `of ${fmt(coding.totalProblems)} on DevPrep` : null} />
      <Kpi loading={loading} icon={TrendingUp} iconClass="text-cyan-400" label="Acceptance rate"
        value={`${coding?.acceptanceRate || 0}%`} sub={`${fmt(coding?.acceptedSubmissions || 0)} of ${fmt(coding?.totalSubmissions || 0)} submissions`} />
      <Kpi loading={loading} icon={Flame} iconClass="text-orange-400" label="Current streak"
        value={`${streak?.currentStreak || 0}d`} sub={`Best ${streak?.longestStreak || 0} days`} />
      <Kpi loading={loading} icon={MessageSquare} iconClass="text-violet-400" label="Interviews completed"
        value={fmt(done)} sub={total ? `${pct(done, total)}% of ${fmt(total)} started` : 'None started yet'} />
      <Kpi loading={loading} icon={Trophy} iconClass="text-amber-400" label="Avg interview score"
        value={overview?.averageScore != null ? overview.averageScore : '—'} sub={overview?.averageScore != null ? 'out of 100' : 'Complete an interview'} />
      <Kpi loading={loading} icon={BookOpen} iconClass="text-pink-400" label="Questions saved"
        value={fmt(Number(savedStats?.totalSaved) || 0)} sub="from the question generator" />
    </div>
  );
}

/* ── Problem solving ──────────────────────────────────────────────────── */

export function ProblemSolvingCard({ loading, coding }) {
  const c = coding || {};
  const solved = { easy: c.easySolved || 0, medium: c.mediumSolved || 0, hard: c.hardSolved || 0 };
  const totals = { easy: c.totalEasy || 0, medium: c.totalMedium || 0, hard: c.totalHard || 0 };
  const totalSolved = solved.easy + solved.medium + solved.hard;
  const pie = [
    ...DIFF.map((d) => ({ name: d.label, value: solved[d.key], fill: d.color })),
    { name: 'Unsolved', value: Math.max(0, (c.totalProblems || 0) - totalSolved), fill: '#1f2937' }
  ].filter((x) => x.value > 0);

  return (
    <Card title="Problem solving" icon={Code2} subtitle="DevPrep coding problems by difficulty" className="h-full">
      {loading ? <div className="h-40 rounded-xl bg-white/5 animate-pulse" /> : (
        <div className="flex flex-col sm:flex-row items-center gap-6">
          <div className="relative w-40 h-40 flex-shrink-0">
            {pie.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={pie} dataKey="value" innerRadius={52} outerRadius={70} stroke="none" startAngle={90} endAngle={-270}>
                    {pie.map((e) => <Cell key={e.name} fill={e.fill} />)}
                  </Pie>
                  <Tooltip {...chartTooltipStyle} />
                </PieChart>
              </ResponsiveContainer>
            ) : <div className="w-full h-full rounded-full border-[18px] border-white/5" />}
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <div className="text-3xl font-bold text-white">{totalSolved}</div>
              <div className="text-xs text-slate-400">of {c.totalProblems || 0} solved</div>
            </div>
          </div>
          <div className="flex-1 w-full space-y-4">
            {DIFF.map((d) => (
              <div key={d.key}>
                <div className="flex justify-between text-sm">
                  <span style={{ color: d.color }} className="font-medium">{d.label}</span>
                  <span className="text-slate-300">{solved[d.key]}<span className="text-slate-500"> / {totals[d.key]}</span></span>
                </div>
                <div className="mt-1.5 h-2 rounded-full bg-white/5 overflow-hidden">
                  <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct(solved[d.key], totals[d.key])}%`, background: d.color }} />
                </div>
              </div>
            ))}
            <p className="text-xs text-slate-500">
              {totalSolved === 0 ? 'Solve a problem in Coding Practice to start filling this in.' : `${pct(totalSolved, c.totalProblems)}% of the problem set solved.`}
            </p>
          </div>
        </div>
      )}
    </Card>
  );
}

/** Horizontal share bars (languages, categories) */
export function BreakdownCard({ title, icon, subtitle, items, loading, empty, color = '#a78bfa' }) {
  const rows = useMemo(() => {
    const map = {};
    (items || []).forEach((x) => { const k = label(x.name); map[k] = (map[k] || 0) + (Number(x.value) || 0); });
    const list = Object.entries(map).map(([name, value]) => ({ name, value })).filter((x) => x.value > 0).sort((a, b) => b.value - a.value);
    const sum = list.reduce((s, x) => s + x.value, 0);
    return list.map((x) => ({ ...x, share: pct(x.value, sum) }));
  }, [items]);
  return (
    <Card title={title} icon={icon} subtitle={subtitle} count={rows.length || null} scroll bodyHeight="max-h-[13.5rem]" className="h-full">
      {loading ? <ListSkeleton rows={4} /> : rows.length ? (
        <ul className="space-y-3">
          {rows.map((r) => (
            <li key={r.name}>
              <div className="flex justify-between text-xs">
                <span className="text-slate-200">{r.name}</span>
                <span className="text-slate-400">{fmt(r.value)} · {r.share}%</span>
              </div>
              <div className="mt-1 h-1.5 rounded-full bg-white/5 overflow-hidden">
                <div className="h-full rounded-full" style={{ width: `${Math.max(r.share, 2)}%`, background: color }} />
              </div>
            </li>
          ))}
        </ul>
      ) : <ListEmpty title={empty} />}
    </Card>
  );
}

/* ── Interview performance ────────────────────────────────────────────── */

export function InterviewPerformanceCard({ loading, overview, performance, topics }) {
  const points = (performance || []).map((p) => ({
    ...p, label: new Date(`${p.date}T00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
  }));
  const sortedTopics = [...(topics || [])].sort((a, b) => a.averageScore - b.averageScore);
  const weakest = sortedTopics.slice(0, 3);
  const strongest = sortedTopics.slice(-3).reverse().filter((t) => !weakest.includes(t));
  const byType = overview?.byType || [];
  const typeTotal = byType.reduce((s, t) => s + t.count, 0);

  return (
    <Card title="Interview performance" icon={TrendingUp} subtitle="AI evaluation scores of completed mock interviews" className="h-full">
      {loading ? <div className="h-56 rounded-xl bg-white/5 animate-pulse" /> : (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
          <div className="lg:col-span-3 min-w-0">
            {points.length ? (
              <div className="h-52">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={points} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid stroke="rgba(255,255,255,0.05)" vertical={false} />
                    <XAxis dataKey="label" {...axis} minTickGap={20} />
                    <YAxis {...axis} width={30} domain={[0, 100]} />
                    {overview?.averageScore != null && <ReferenceLine y={overview.averageScore} stroke="#64748b" strokeDasharray="4 4" />}
                    <Tooltip {...chartTooltipStyle} formatter={(v, n, p) => [`${v} (${p.payload.sessions} session${p.payload.sessions === 1 ? '' : 's'})`, 'Score']} />
                    <Line type="monotone" dataKey="averageScore" stroke="#a78bfa" strokeWidth={2} dot={{ r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : <div className="h-52"><ListEmpty icon={TrendingUp} title="No scored interviews yet" message="Your score trend appears after you complete a mock interview." /></div>}
            {points.length > 0 && <p className="mt-1 text-xs text-slate-500">Daily average score. The dashed line is your overall average.</p>}
          </div>
          <div className="lg:col-span-2 space-y-4 min-w-0">
            <div>
              <div className="text-xs font-semibold text-slate-300 mb-2">Interviews by type</div>
              {typeTotal ? (
                <div className="space-y-2">
                  {byType.map((t) => (
                    <div key={t.type}>
                      <div className="flex justify-between text-xs"><span className="text-slate-300">{label(t.type)}</span><span className="text-slate-400">{t.count}</span></div>
                      <div className="mt-1 h-1.5 rounded-full bg-white/5 overflow-hidden"><div className="h-full rounded-full bg-violet-400" style={{ width: `${pct(t.count, typeTotal)}%` }} /></div>
                    </div>
                  ))}
                </div>
              ) : <p className="text-xs text-slate-500">No interviews yet.</p>}
            </div>
            {sortedTopics.length > 0 && (
              <div className="grid grid-cols-2 gap-3">
                <TopicList title="Needs practice" items={weakest} tone="text-rose-300" />
                <TopicList title="Strongest" items={strongest} tone="text-emerald-300" />
              </div>
            )}
          </div>
        </div>
      )}
    </Card>
  );
}

function TopicList({ title, items, tone }) {
  return (
    <div className="min-w-0">
      <div className="text-xs font-semibold text-slate-300 mb-1.5">{title}</div>
      {items.length ? (
        <ul className="space-y-1">
          {items.map((t) => (
            <li key={t.topic} className="flex justify-between gap-2 text-xs">
              <span className="text-slate-400 truncate">{t.topic}</span>
              <span className={`${tone} font-medium flex-shrink-0`}>{t.averageScore}</span>
            </li>
          ))}
        </ul>
      ) : <p className="text-xs text-slate-500">—</p>}
    </div>
  );
}

/* ── External coding profiles ─────────────────────────────────────────── */

export function CodingProfilesCard({ loading, dev, onOpen }) {
  const conn = dev?.connections || {};
  const d = dev?.data || {};
  const rows = [
    conn.github && {
      p: 'github', user: conn.github.username,
      stats: d.github ? [
        [d.github.contributions?.source === 'graphql' ? 'Contributions (1y)' : 'Events (90d)', fmt(d.github.contributions?.total)],
        ['Stars', fmt(d.github.totals?.stars)],
        ['Repos', fmt(d.github.profile?.publicRepos)]
      ] : null,
      url: d.github?.profile?.htmlUrl
    },
    conn.leetcode && {
      p: 'leetcode', user: conn.leetcode.username,
      stats: d.leetcode ? [
        ['Solved', fmt(d.leetcode.solved?.all)],
        ['Rating', d.leetcode.contest?.rating ? fmt(d.leetcode.contest.rating) : '—'],
        ['Contests', fmt(d.leetcode.contest?.attended ?? 0)]
      ] : null,
      url: d.leetcode?.profile?.url
    },
    conn.codeforces && {
      p: 'codeforces', user: conn.codeforces.username,
      stats: d.codeforces ? [
        ['Rating', fmt(d.codeforces.profile?.rating)],
        ['Max', fmt(d.codeforces.profile?.maxRating)],
        ['Solved', fmt(d.codeforces.solvedCount)]
      ] : null,
      rank: d.codeforces?.profile?.rank,
      url: d.codeforces?.profile?.url
    }
  ].filter(Boolean);

  return (
    <Card
      title="Coding profiles"
      icon={Globe}
      subtitle="Synced from Dev Analytics"
      className="h-full"
      action={<button type="button" onClick={onOpen} className="text-xs text-violet-300 hover:text-violet-200">{rows.length ? 'Open analytics' : 'Connect'}</button>}
    >
      {loading ? <ListSkeleton rows={3} /> : rows.length ? (
        <ul className="space-y-2">
          {rows.map((r) => (
            <li key={r.p} className="rounded-xl bg-white/5 border border-white/5 px-3 py-2.5">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <span className={`text-sm font-semibold ${PLATFORM_META[r.p].text}`}>{PLATFORM_META[r.p].label}</span>
                  <span className="text-xs text-slate-500"> · {r.user}</span>
                  {r.rank && <span className={`text-xs capitalize ${cfRankColor(r.rank)}`}> · {r.rank}</span>}
                </div>
                {r.url && <a href={r.url} target="_blank" rel="noreferrer" className="text-slate-500 hover:text-slate-200" aria-label={`Open ${PLATFORM_META[r.p].label} profile`}><ExternalLink className="w-3.5 h-3.5" /></a>}
              </div>
              {r.stats ? (
                <div className="mt-2 grid grid-cols-3 gap-2">
                  {r.stats.map(([k, v]) => (
                    <div key={k} className="min-w-0">
                      <div className="text-sm font-semibold text-slate-100">{v}</div>
                      <div className="text-[10px] text-slate-500 truncate">{k}</div>
                    </div>
                  ))}
                </div>
              ) : <div className="mt-1 text-xs text-slate-500">Waiting for the first sync.</div>}
            </li>
          ))}
        </ul>
      ) : (
        <ListEmpty icon={Globe} title="No coding profiles connected" message="Connect GitHub, LeetCode or Codeforces to show them here and in your activity heatmap." />
      )}
    </Card>
  );
}

/* ── Recent activity ──────────────────────────────────────────────────── */

const ACTIVITY_ICON = {
  coding: { icon: Code2, cls: 'text-emerald-300 bg-emerald-500/10' },
  mock: { icon: MessageSquare, cls: 'text-violet-300 bg-violet-500/10' },
  resume: { icon: FileText, cls: 'text-cyan-300 bg-cyan-500/10' },
  quiz: { icon: Brain, cls: 'text-pink-300 bg-pink-500/10' }
};

export function RecentActivityCard({ loading, items }) {
  return (
    <Card title="Recent activity" icon={Zap} subtitle="Coding, interviews and quizzes on DevPrep" count={items?.length || null} scroll className="h-full">
      {loading ? <ListSkeleton rows={5} /> : items?.length ? (
        <ul className="space-y-2">
          {items.map((a, i) => {
            const meta = ACTIVITY_ICON[a.type] || ACTIVITY_ICON.coding;
            const Icon = meta.icon;
            const right = a.score != null
              ? <span className={`text-xs font-semibold ${a.score >= 70 ? 'text-emerald-300' : a.score >= 40 ? 'text-amber-300' : 'text-rose-300'}`}>{a.score}/100</span>
              : a.type === 'coding'
                ? <span className={`text-xs ${a.status === 'accepted' ? 'text-emerald-300' : 'text-slate-400'}`}>{a.status === 'accepted' ? 'Solved' : 'Attempted'}</span>
                : null;
            return (
              <ListRow key={`${a.type}-${a.timestamp}-${i}`}>
                <div className="flex items-center gap-3 min-w-0">
                  <span className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${meta.cls}`}><Icon className="w-4 h-4" /></span>
                  <div className="min-w-0">
                    {a.sessionId
                      ? <Link to={`/interview/mock/${a.sessionId}`} className="text-sm text-slate-200 hover:text-violet-300 truncate block">{a.title}</Link>
                      : <div className="text-sm text-slate-200 truncate">{a.title}</div>}
                    <div className="text-xs text-slate-500 truncate">{[a.meta, timeAgo(a.timestamp)].filter(Boolean).join(' · ')}</div>
                  </div>
                </div>
                {right && <div className="flex-shrink-0">{right}</div>}
              </ListRow>
            );
          })}
        </ul>
      ) : <ListEmpty icon={Zap} title="No activity yet" message="Solve a problem, take a mock interview or generate a quiz to see it here." />}
    </Card>
  );
}

/* ── Achievements ─────────────────────────────────────────────────────── */

/** Milestones from real numbers: earned ones, and progress towards the next step of each track */
export function buildAchievements({ coding, streak, overview, performance, savedStats, profileComplete }) {
  const tracks = [
    { id: 'solved', icon: CheckCircle2, name: 'Problem solver', unit: 'problems solved', value: coding?.totalSolved || 0, steps: [1, 10, 25, 50, 100, 250] },
    { id: 'hard', icon: Flame, name: 'Hard mode', unit: 'hard problems solved', value: coding?.hardSolved || 0, steps: [1, 5, 10, 25] },
    { id: 'streak', icon: Zap, name: 'Consistency', unit: 'day best streak', value: streak?.longestStreak || 0, steps: [3, 7, 14, 30, 60] },
    { id: 'interviews', icon: MessageSquare, name: 'Interview ready', unit: 'interviews completed', value: overview?.completedInterviews || 0, steps: [1, 5, 10, 25] },
    {
      id: 'score', icon: Trophy, name: 'High scorer', unit: 'best daily interview score',
      value: Math.round(Math.max(0, ...(performance || []).map((p) => p.averageScore || 0))), steps: [50, 70, 85, 95]
    },
    { id: 'saved', icon: BookOpen, name: 'Question collector', unit: 'questions saved', value: Number(savedStats?.totalSaved) || 0, steps: [10, 50, 100, 250] }
  ];
  const list = tracks.map((t) => {
    const reached = t.steps.filter((s) => t.value >= s);
    const next = t.steps.find((s) => t.value < s) || null;
    return { ...t, level: reached.length, levels: t.steps.length, earned: reached.length ? reached[reached.length - 1] : null, next };
  });
  list.push({
    id: 'profile', icon: UserCircle2, name: 'Complete profile', unit: 'profile fields filled',
    value: profileComplete.done, earned: profileComplete.done === profileComplete.total ? profileComplete.total : null,
    next: profileComplete.done === profileComplete.total ? null : profileComplete.total, level: profileComplete.done === profileComplete.total ? 1 : 0, levels: 1
  });
  return list;
}

export function AchievementsCard({ loading, achievements }) {
  const earned = achievements.filter((a) => a.earned != null).length;
  return (
    <Card title="Achievements and milestones" icon={Award} subtitle={`${earned} of ${achievements.length} tracks started · progress to the next milestone`} className="h-full">
      {loading ? <div className="h-40 rounded-xl bg-white/5 animate-pulse" /> : (
        <ul className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
          {achievements.map((a) => {
            const Icon = a.icon;
            const has = a.earned != null;
            const prev = has ? a.earned : 0;
            const progress = a.next ? pct(a.value - (a.id === 'profile' ? 0 : prev), a.next - (a.id === 'profile' ? 0 : prev)) : 100;
            return (
              <li key={a.id} className={`rounded-2xl border p-4 ${has ? 'bg-amber-500/[0.06] border-amber-400/20' : 'bg-white/[0.03] border-white/10'}`}>
                <div className="flex items-center gap-2">
                  <span className={`w-8 h-8 rounded-lg flex items-center justify-center ${has ? 'bg-amber-400/15 text-amber-300' : 'bg-white/5 text-slate-500'}`}><Icon className="w-4 h-4" /></span>
                  <div className="min-w-0">
                    <div className={`text-sm font-semibold truncate ${has ? 'text-slate-100' : 'text-slate-400'}`}>{a.name}</div>
                    <div className="text-[11px] text-slate-500">
                      {a.levels > 1 ? `Level ${a.level} of ${a.levels}` : has ? 'Done' : 'Not yet'}
                    </div>
                  </div>
                </div>
                <div className="mt-3 text-xs text-slate-300">
                  {fmt(a.value)} {a.unit}
                </div>
                <div className="mt-1.5 h-1.5 rounded-full bg-white/5 overflow-hidden">
                  <div className={`h-full rounded-full ${has ? 'bg-amber-400' : 'bg-slate-500'}`} style={{ width: `${progress}%` }} />
                </div>
                <div className="mt-1 text-[11px] text-slate-500">{a.next ? `Next: ${fmt(a.next)}` : 'All milestones reached'}</div>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

/* ── Recently solved (public profile) ─────────────────────────────────── */

const DIFF_TEXT = { easy: 'text-emerald-300', medium: 'text-amber-300', hard: 'text-rose-300' };

export function RecentSolvedCard({ loading, items }) {
  return (
    <Card title="Recently solved" icon={CheckCircle2} subtitle="Latest problems solved on DevPrep" count={items?.length || null} scroll className="h-full">
      {loading ? <ListSkeleton rows={5} /> : items?.length ? (
        <ul className="space-y-2">
          {items.map((p) => (
            <ListRow key={`${p.title}-${p.solvedAt}`}>
              <div className="flex items-center gap-3 min-w-0">
                <span className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 text-emerald-300 bg-emerald-500/10"><Code2 className="w-4 h-4" /></span>
                <div className="min-w-0">
                  <div className="text-sm text-slate-200 truncate">{p.title}</div>
                  <div className="text-xs text-slate-500 truncate">{[label(p.category), label(p.language), timeAgo(p.solvedAt)].filter((x) => x && x !== 'Other').join(' · ')}</div>
                </div>
              </div>
              <span className={`text-xs capitalize flex-shrink-0 ${DIFF_TEXT[String(p.difficulty).toLowerCase()] || 'text-slate-400'}`}>{p.difficulty}</span>
            </ListRow>
          ))}
        </ul>
      ) : <ListEmpty icon={CheckCircle2} title="No problems solved yet" />}
    </Card>
  );
}
