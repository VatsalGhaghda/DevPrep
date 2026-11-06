import { useMemo } from 'react';
import {
  ResponsiveContainer, LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Cell
} from 'recharts';
import { ExternalLink, Code2, Trophy, Star, GitPullRequest, Activity, Flame, ListChecks } from 'lucide-react';
import YearHeatmap from './YearHeatmap';
import { Card, StatTile, EmptyState, PartialNotice, ListRow, ListEmpty, chartTooltipStyle } from './ui';
import {
  PLATFORM_META, platformSources, combineActivity, computeStreaks, monthlyBuckets, fmt, timeAgo, cfRankColor
} from '../../utils/devAnalytics';

const axis = { stroke: '#64748b', fontSize: 11, tickLine: false, axisLine: false };

function NotConnected({ platform, onConnect }) {
  return (
    <EmptyState
      title={`${PLATFORM_META[platform].label} is not connected`}
      message="Add your profile in Connections to see real stats from this platform."
      action={(
        <button
          type="button"
          onClick={onConnect}
          className="h-9 px-4 rounded-xl bg-violet-600 hover:bg-violet-700 border border-violet-500 text-white text-sm font-semibold"
        >
          Go to Connections
        </button>
      )}
    />
  );
}

function WaitingForSync({ platform, connection }) {
  return (
    <div className="space-y-3">
      <EmptyState
        title={`No ${PLATFORM_META[platform].label} data yet`}
        message={connection?.lastError ? 'The last sync did not finish. Try syncing again from Connections.' : 'Data appears here after the first successful sync.'}
      />
      <PartialNotice error={connection?.lastError} />
    </div>
  );
}

function ProfileHeader({ avatar, title, subtitle, url, connection, extra }) {
  return (
    <div className="flex flex-wrap items-center gap-4">
      {avatar && <img src={avatar} alt="" className="w-14 h-14 rounded-2xl border border-white/10 object-cover" />}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-bold text-slate-100 truncate">{title}</h2>
          {url && (
            <a href={url} target="_blank" rel="noreferrer" className="text-slate-400 hover:text-slate-200" aria-label="Open profile">
              <ExternalLink className="w-4 h-4" />
            </a>
          )}
        </div>
        {subtitle && <div className="text-sm text-slate-400">{subtitle}</div>}
        <div className="text-xs text-slate-500 mt-0.5">Last synced {timeAgo(connection?.lastSyncedAt)}</div>
      </div>
      {extra}
    </div>
  );
}

function PlatformActivity({ platform, activity, note }) {
  const days = useMemo(() => combineActivity(activity, [platform]), [activity, platform]);
  const streaks = useMemo(() => computeStreaks(days), [days]);
  const monthly = useMemo(() => monthlyBuckets(activity, 12, [platform]), [activity, platform]);
  const meta = PLATFORM_META[platform];
  return (
    <Card title={`${meta.label} activity`} icon={Activity}>
      <div className="grid grid-cols-3 gap-3 mb-4">
        <StatTile label="Current streak" value={`${streaks.current}d`} accent={meta.text} />
        <StatTile label="Longest streak" value={`${streaks.longest}d`} />
        <StatTile label="Active days" value={fmt(streaks.activeDays)} sub="all stored history" />
      </div>
      <YearHeatmap sources={platformSources([platform])} activity={activity} title={`${meta.label} activity`} showFilter={false} />
      {note && <p className="mt-3 text-xs text-slate-500">{note}</p>}
      <div className="mt-5 pt-4 border-t border-white/5">
        <div className="text-sm font-semibold text-slate-100 mb-3">{meta.unit[0].toUpperCase() + meta.unit.slice(1)} per month</div>
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={monthly}>
              <CartesianGrid stroke="rgba(255,255,255,0.05)" vertical={false} />
              <XAxis dataKey="label" {...axis} />
              <YAxis {...axis} width={32} allowDecimals={false} />
              <Tooltip {...chartTooltipStyle} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
              <Bar dataKey={platform} name={`${meta.unit} per month`} fill={meta.color} radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </Card>
  );
}

/* ── GitHub ─────────────────────────────────────────────────────────────── */

export function GitHubSection({ data, connection, activity, onConnect, tokenConfigured }) {
  if (!connection) return <NotConnected platform="github" onConnect={onConnect} />;
  if (!data) return <WaitingForSync platform="github" connection={connection} />;
  const { profile, totals, contributions: c, topRepos, languages } = data;
  const fromGraphql = c?.source === 'graphql';
  return (
    <div className="space-y-4">
      <Card>
        <ProfileHeader
          avatar={profile.avatarUrl}
          title={profile.name || profile.login}
          subtitle={`@${profile.login}${profile.bio ? ` · ${profile.bio}` : ''}`}
          url={profile.htmlUrl}
          connection={connection}
        />
        <div className="mt-4"><PartialNotice items={data.partial} error={connection.lastError} /></div>
      </Card>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatTile label="Public repositories" value={fmt(profile.publicRepos)} />
        <StatTile label="Followers" value={fmt(profile.followers)} sub={`Following ${fmt(profile.following)}`} />
        <StatTile label="Stars received" value={fmt(totals.stars)} sub={`across ${totals.ownedRepos} own repos`} accent="text-amber-300" />
        <StatTile
          label={fromGraphql ? 'Contributions (last year)' : 'Public events (90 days)'}
          value={fmt(c?.total)}
          accent="text-violet-300"
        />
        <StatTile label={fromGraphql ? 'Commits (last year)' : 'Pushed commits (90 days)'} value={fmt(c?.commits)} />
        <StatTile label="Pull requests" value={fmt(c?.allTime?.pullRequests)} sub="all time" />
        <StatTile label="Issues" value={fmt(c?.allTime?.issues)} sub="all time" />
        <StatTile label="PR reviews (last year)" value={fromGraphql ? fmt(c?.reviews) : '—'} sub={fromGraphql ? null : 'needs GITHUB_TOKEN'} />
      </div>

      <PlatformActivity
        platform="github"
        activity={activity}
        note={fromGraphql
          ? 'From your GitHub contribution calendar.'
          : `Counted from public events (GitHub keeps 90 days).${tokenConfigured ? '' : ' Set GITHUB_TOKEN on the server for the full contribution calendar.'}`}
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card
          title="Most active repositories"
          icon={GitPullRequest}
          count={c?.byRepository?.length || null}
          subtitle={fromGraphql ? 'Commits in the last year' : 'Pushed commits in the last 90 days'}
          scroll
        >
          {c?.byRepository?.length ? (
            <ul className="space-y-2">
              {c.byRepository.map((r) => (
                <ListRow key={r.name}>
                  <a href={r.url} target="_blank" rel="noreferrer" className="text-sm text-slate-200 hover:text-violet-300 truncate min-w-0">{r.name}</a>
                  <span className="text-xs text-slate-400 flex-shrink-0">{fmt(r.commits)} commits</span>
                </ListRow>
              ))}
            </ul>
          ) : <ListEmpty title="No commit activity" message="No commits were found in this period." />}
        </Card>

        <Card
          title="Top repositories"
          icon={Star}
          count={topRepos?.length || null}
          subtitle="Your repositories by stars"
          scroll
          footer={languages?.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {languages.slice(0, 8).map((l) => (
                <span key={l.name} className="px-2 py-1 rounded-lg bg-white/5 border border-white/10 text-xs text-slate-300">
                  {l.name} <span className="text-slate-500">{l.count}</span>
                </span>
              ))}
            </div>
          )}
        >
          {topRepos?.length ? (
            <ul className="space-y-2">
              {topRepos.map((r) => (
                <ListRow key={r.name}>
                  <div className="min-w-0">
                    <a href={r.url} target="_blank" rel="noreferrer" className="text-sm text-slate-200 hover:text-violet-300 truncate block">{r.name}</a>
                    <div className="text-xs text-slate-500 truncate">
                      {[r.language, `pushed ${timeAgo(r.pushedAt)}`].filter(Boolean).join(' · ')}
                    </div>
                  </div>
                  <span className="text-xs text-amber-300 flex-shrink-0 inline-flex items-center gap-1"><Star className="w-3 h-3" />{fmt(r.stars)}</span>
                </ListRow>
              ))}
            </ul>
          ) : <ListEmpty title="No public repositories" />}
        </Card>
      </div>
    </div>
  );
}

/* ── LeetCode ───────────────────────────────────────────────────────────── */

const LC_COLORS = { easy: '#34d399', medium: '#fbbf24', hard: '#f87171' };

export function LeetCodeSection({ data, connection, activity, onConnect }) {
  if (!connection) return <NotConnected platform="leetcode" onConnect={onConnect} />;
  if (!data) return <WaitingForSync platform="leetcode" connection={connection} />;
  const { profile, solved, questionTotals, submissions, acceptanceRate, contest, recent } = data;
  const history = (contest?.history || []).map((h) => ({
    ...h, label: new Date(h.startTime).toLocaleDateString(undefined, { month: 'short', year: '2-digit' })
  }));
  return (
    <div className="space-y-4">
      <Card>
        <ProfileHeader
          avatar={profile.avatarUrl}
          title={profile.realName || profile.username}
          subtitle={`@${profile.username}${profile.ranking ? ` · Global rank #${fmt(profile.ranking)}` : ''}`}
          url={profile.url}
          connection={connection}
        />
        <div className="mt-4"><PartialNotice items={data.partial} error={connection.lastError} /></div>
      </Card>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatTile label="Problems solved" value={fmt(solved.all)} sub={questionTotals?.all ? `of ${fmt(questionTotals.all)}` : null} accent="text-amber-300" />
        <StatTile label="Acceptance rate" value={acceptanceRate != null ? `${acceptanceRate}%` : '—'} sub="accepted / all submissions" />
        <StatTile label="Total submissions" value={fmt(submissions?.total)} />
        <StatTile label="Contest rating" value={contest?.rating ? fmt(contest.rating) : '—'} sub={contest?.maxRating ? `max ${fmt(contest.maxRating)}` : 'no rated contests'} accent="text-violet-300" />
        <StatTile label="Contest ranking" value={contest?.globalRanking ? `#${fmt(contest.globalRanking)}` : '—'} sub={contest?.topPercentage ? `top ${contest.topPercentage}%` : null} />
        <StatTile label="Contests attended" value={fmt(contest?.attended ?? 0)} sub={contest?.badge || null} />
        <StatTile label="Streak (LeetCode)" value={data.calendarInfo ? `${data.calendarInfo.streak}d` : '—'} sub="as reported by LeetCode" />
        <StatTile label="Active days (LeetCode)" value={fmt(data.calendarInfo?.totalActiveDays)} sub="past year" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card title="Solved by difficulty" icon={ListChecks}>
          <div className="space-y-3">
            {['easy', 'medium', 'hard'].map((d) => {
              const total = questionTotals?.[d] || 0;
              const pct = total ? Math.round((solved[d] / total) * 100) : 0;
              return (
                <div key={d}>
                  <div className="flex justify-between text-sm">
                    <span className="capitalize" style={{ color: LC_COLORS[d] }}>{d}</span>
                    <span className="text-slate-300">{fmt(solved[d])}{total ? <span className="text-slate-500"> / {fmt(total)}</span> : null}</span>
                  </div>
                  <div className="mt-1 h-2 rounded-full bg-white/5 overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${pct}%`, background: LC_COLORS[d] }} />
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        <Card title="Contest rating progression" icon={Trophy}>
          {history.length ? (
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={history}>
                  <CartesianGrid stroke="rgba(255,255,255,0.05)" vertical={false} />
                  <XAxis dataKey="label" {...axis} minTickGap={24} />
                  <YAxis {...axis} width={40} domain={['dataMin - 50', 'dataMax + 50']} />
                  <Tooltip {...chartTooltipStyle} labelFormatter={(_, p) => p?.[0]?.payload?.title || ''} />
                  <Line type="monotone" dataKey="rating" stroke="#22c55e" strokeWidth={2} dot={{ r: 2 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : <p className="text-sm text-slate-500">No rated contests yet.</p>}
        </Card>
      </div>

      <PlatformActivity platform="leetcode" activity={activity} note="LeetCode's public calendar counts all submissions per day (not only accepted ones) for the past 12 months. Older days are kept from earlier syncs." />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card title="Recent submissions" icon={Code2} count={recent?.length || null} subtitle="Latest public submissions" scroll>
          {recent?.length ? (
            <ul className="space-y-2">
              {recent.map((s) => (
                <ListRow key={`${s.url}-${s.timestamp}`}>
                  <div className="min-w-0">
                    <a href={s.url} target="_blank" rel="noreferrer" className="text-sm text-slate-200 hover:text-amber-300 truncate block">{s.title}</a>
                    <div className="text-xs text-slate-500 truncate">{s.lang} · {timeAgo(s.timestamp)}</div>
                  </div>
                  <span className={`text-xs flex-shrink-0 ${s.status === 'Accepted' ? 'text-emerald-300' : 'text-rose-300'}`}>{s.status}</span>
                </ListRow>
              ))}
            </ul>
          ) : <ListEmpty title="No recent submissions" message="LeetCode returned no recent public submissions." />}
        </Card>

        <Card title="Contest history" icon={Trophy} count={history.length || null} subtitle="Newest first" scroll>
          {history.length ? (
            <ul className="space-y-2">
              {[...history].reverse().map((h) => (
                <ListRow key={`${h.title}-${h.startTime}`}>
                  <div className="min-w-0">
                    <div className="text-sm text-slate-200 truncate">{h.title}</div>
                    <div className="text-xs text-slate-500 truncate">{new Date(h.startTime).toLocaleDateString()} · solved {h.solved}/{h.total} · rank #{fmt(h.ranking)}</div>
                  </div>
                  <span className="text-sm font-semibold text-amber-300 flex-shrink-0">{fmt(h.rating)}</span>
                </ListRow>
              ))}
            </ul>
          ) : <ListEmpty icon={Trophy} title="No contests yet" message="Rated LeetCode contests you take part in appear here." />}
        </Card>
      </div>
    </div>
  );
}

/* ── Codeforces ─────────────────────────────────────────────────────────── */

const VERDICT_LABELS = {
  OK: 'Accepted', WRONG_ANSWER: 'Wrong answer', TIME_LIMIT_EXCEEDED: 'Time limit', MEMORY_LIMIT_EXCEEDED: 'Memory limit',
  RUNTIME_ERROR: 'Runtime error', COMPILATION_ERROR: 'Compilation error', IDLENESS_LIMIT_EXCEEDED: 'Idleness limit',
  CHALLENGED: 'Hacked', SKIPPED: 'Skipped', TESTING: 'Testing', PARTIAL: 'Partial'
};

function cfRatingColor(r) {
  const n = Number(r);
  if (!n) return '#64748b';
  if (n < 1200) return '#94a3b8';
  if (n < 1400) return '#34d399';
  if (n < 1600) return '#22d3ee';
  if (n < 1900) return '#60a5fa';
  if (n < 2100) return '#c084fc';
  if (n < 2400) return '#fb923c';
  return '#f87171';
}

export function CodeforcesSection({ data, connection, activity, onConnect }) {
  if (!connection) return <NotConnected platform="codeforces" onConnect={onConnect} />;
  if (!data) return <WaitingForSync platform="codeforces" connection={connection} />;
  const { profile, ratingHistory, difficulty, tags, recent, verdicts } = data;
  const history = (ratingHistory || []).map((h) => ({
    ...h, label: new Date(h.time).toLocaleDateString(undefined, { month: 'short', year: '2-digit' }), change: h.newRating - h.oldRating
  }));
  const verdictRows = Object.entries(verdicts || {}).sort((a, b) => b[1] - a[1]).slice(0, 6);
  return (
    <div className="space-y-4">
      <Card>
        <ProfileHeader
          avatar={profile.avatarUrl}
          title={profile.handle}
          subtitle={<span className={`capitalize ${cfRankColor(profile.rank)}`}>{profile.rank}</span>}
          url={profile.url}
          connection={connection}
        />
        <div className="mt-4"><PartialNotice items={data.partial} error={connection.lastError} /></div>
      </Card>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatTile label="Current rating" value={fmt(profile.rating)} sub={<span className={`capitalize ${cfRankColor(profile.rank)}`}>{profile.rank}</span>} accent="text-sky-300" />
        <StatTile label="Max rating" value={fmt(profile.maxRating)} sub={<span className={`capitalize ${cfRankColor(profile.maxRank)}`}>{profile.maxRank}</span>} />
        <StatTile label="Problems solved" value={fmt(data.solvedCount)} sub={`${fmt(data.attemptedUnsolved)} tried, not solved`} accent="text-emerald-300" />
        <StatTile label="Contests" value={fmt(data.contestsAttended)} sub={`${fmt(data.submissionsTotal)} submissions`} />
      </div>

      <Card title="Rating progression" icon={Trophy}>
        {history.length ? (
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={history}>
                <CartesianGrid stroke="rgba(255,255,255,0.05)" vertical={false} />
                <XAxis dataKey="label" {...axis} minTickGap={24} />
                <YAxis {...axis} width={40} domain={['dataMin - 100', 'dataMax + 100']} />
                <Tooltip
                  {...chartTooltipStyle}
                  labelFormatter={(_, p) => p?.[0]?.payload?.contestName || ''}
                  formatter={(v, n, p) => [`${v} (${p.payload.change >= 0 ? '+' : ''}${p.payload.change}, rank ${p.payload.rank})`, 'Rating']}
                />
                <Line type="monotone" dataKey="newRating" stroke="#38bdf8" strokeWidth={2} dot={{ r: 2 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : <p className="text-sm text-slate-500">No rated contests yet.</p>}
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card title="Solved problems by difficulty" icon={ListChecks}>
          {difficulty?.length ? (
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={difficulty}>
                  <CartesianGrid stroke="rgba(255,255,255,0.05)" vertical={false} />
                  <XAxis dataKey="rating" {...axis} />
                  <YAxis {...axis} width={32} allowDecimals={false} />
                  <Tooltip {...chartTooltipStyle} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
                  <Bar dataKey="count" name="solved" radius={[6, 6, 0, 0]}>
                    {difficulty.map((d) => <Cell key={d.rating} fill={cfRatingColor(d.rating)} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : <p className="text-sm text-slate-500">No accepted submissions yet.</p>}
        </Card>

        <Card title="Topics solved (by problem tag)" icon={Flame}>
          {tags?.length ? (
            <div className="space-y-2">
              {tags.slice(0, 12).map((t) => (
                <div key={t.tag}>
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-300">{t.tag}</span>
                    <span className="text-slate-400">{t.count}</span>
                  </div>
                  <div className="mt-1 h-1.5 rounded-full bg-white/5 overflow-hidden">
                    <div className="h-full rounded-full bg-sky-400" style={{ width: `${Math.round((t.count / tags[0].count) * 100)}%` }} />
                  </div>
                </div>
              ))}
              <p className="text-xs text-slate-500 pt-1">A problem counts once for each of its tags.</p>
            </div>
          ) : <p className="text-sm text-slate-500">No tagged problems solved yet.</p>}
        </Card>
      </div>

      <PlatformActivity platform="codeforces" activity={activity} note="Counts every Codeforces submission per day (UTC)." />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card title="Recent submissions" icon={Code2} count={recent?.length || null} subtitle="Latest submissions" scroll>
          {recent?.length ? (
            <ul className="space-y-2">
              {recent.map((s) => (
                <ListRow key={s.id}>
                  <div className="min-w-0">
                    {s.url
                      ? <a href={s.url} target="_blank" rel="noreferrer" className="text-sm text-slate-200 hover:text-sky-300 truncate block">{s.contestId}{s.index}. {s.name}</a>
                      : <span className="text-sm text-slate-200 truncate block">{s.name}</span>}
                    <div className="text-xs text-slate-500 truncate">{[s.rating, s.lang, timeAgo(s.time)].filter(Boolean).join(' · ')}</div>
                  </div>
                  <span className={`text-xs flex-shrink-0 ${s.verdict === 'OK' ? 'text-emerald-300' : 'text-rose-300'}`}>{VERDICT_LABELS[s.verdict] || s.verdict}</span>
                </ListRow>
              ))}
            </ul>
          ) : <ListEmpty title="No submissions yet" />}
        </Card>

        <Card
          title="Contest history"
          icon={Trophy}
          count={history.length || null}
          subtitle="Newest first, with rating change"
          scroll
          footer={verdictRows.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {verdictRows.map(([v, n]) => (
                <span key={v} className="px-2 py-1 rounded-lg bg-white/5 border border-white/10 text-xs text-slate-300">
                  {VERDICT_LABELS[v] || v} <span className="text-slate-500">{fmt(n)}</span>
                </span>
              ))}
            </div>
          )}
        >
          {history.length ? (
            <ul className="space-y-2">
              {[...history].reverse().map((h) => (
                <ListRow key={h.contestId}>
                  <div className="min-w-0">
                    <a href={`https://codeforces.com/contest/${h.contestId}`} target="_blank" rel="noreferrer" className="text-sm text-slate-200 hover:text-sky-300 truncate block">{h.contestName}</a>
                    <div className="text-xs text-slate-500 truncate">{new Date(h.time).toLocaleDateString()} · rank #{fmt(h.rank)} · rating {fmt(h.newRating)}</div>
                  </div>
                  <span className={`text-sm font-semibold flex-shrink-0 ${h.change >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>
                    {h.change >= 0 ? '+' : ''}{h.change}
                  </span>
                </ListRow>
              ))}
            </ul>
          ) : <ListEmpty icon={Trophy} title="No rated contests yet" message="Rated Codeforces rounds you take part in appear here." />}
        </Card>
      </div>
    </div>
  );
}

