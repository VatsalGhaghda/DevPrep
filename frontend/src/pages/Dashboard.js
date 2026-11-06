import { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useClerk, useUser } from '@clerk/clerk-react';
import { useReadyAuth } from '../hooks/useReadyAuth';
import {
  ArrowRight, BarChart3, Brain, CalendarDays, ChevronRight, Code2, FileText, Lightbulb, PlayCircle, Sparkles
} from 'lucide-react';
import { EnhancedAnimatedBackground } from '../components/EnhancedAnimatedBackground';
import Navbar from '../components/layout/Navbar';
import Sidebar from '../components/layout/Sidebar';
import Footer from '../components/layout/Footer';
import Modal from '../components/ui/Modal';
import { Card } from '../components/devAnalytics/ui';
import YearHeatmap from '../components/devAnalytics/YearHeatmap';
import { KpiStrip, RecentActivityCard } from '../components/profile/ProfileSections';
import { clerkAPI, questionsAPI, analyticsAPI, devAnalyticsAPI } from '../services/api';
import { PLATFORMS, PLATFORM_META, platformSources, toKey, addDays, keyToDate } from '../utils/devAnalytics';
import { SIDEBAR_ITEMS, NAVBAR_LINKS } from '../config/navigation';

const DEVPREP_SOURCE = { id: 'devprep', label: 'DevPrep', color: '#a78bfa', unit: 'submissions' };

const fadeIn = (delay = 0) => ({
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.45, delay }
});

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

/** Monday-to-Sunday of the current week, with whether each day had activity */
function thisWeek(days) {
  const today = toKey();
  const t = keyToDate(today);
  const monday = addDays(today, -((t.getDay() + 6) % 7));
  return Array.from({ length: 7 }, (_, i) => {
    const key = addDays(monday, i);
    return {
      key,
      label: keyToDate(key).toLocaleDateString(undefined, { weekday: 'narrow' }),
      count: days[key] || 0,
      future: key > today,
      today: key === today
    };
  });
}

const Dashboard = () => {
  const navigate = useNavigate();
  const { ready, getToken } = useReadyAuth();
  const { user } = useUser();
  const { signOut } = useClerk();

  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => localStorage.getItem('sidebarCollapsed') === 'true');
  const [confirmLogoutOpen, setConfirmLogoutOpen] = useState(false);
  const [logoutLoading, setLogoutLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState({});
  const didSyncRef = useRef(false);

  // One token, all requests in parallel; each one can fail on its own
  useEffect(() => {
    if (!ready) return undefined;
    let cancelled = false;
    (async () => {
      try {
        const token = await getToken();
        if (!token) return;
        if (!didSyncRef.current) {
          didSyncRef.current = true;
          clerkAPI.syncMe(token).catch(() => {});
        }
        const calls = {
          profile: clerkAPI.getProfile(token).then((r) => r.data?.user || null),
          savedStats: questionsAPI.getSavedStats(token).then((r) => r.data || null),
          overview: analyticsAPI.getOverview(token).then((r) => r.data?.overview || null),
          recent: analyticsAPI.getRecentActivity(token).then((r) => r.data?.activity || []),
          coding: analyticsAPI.getCodingStats(token).then((r) => r.data?.codingStats || null),
          streak: analyticsAPI.getStreak(token).then((r) => r.data?.streak || null),
          activity: analyticsAPI.getSubmissionActivity(token).then((r) => r.data?.activity || []),
          topics: analyticsAPI.getTopics(token).then((r) => r.data?.topics || []),
          insights: analyticsAPI.getProfileInsights(token).then((r) => r.data?.insights || null),
          dev: devAnalyticsAPI.get(token).then((r) => r.data || null)
        };
        const keys = Object.keys(calls);
        const results = await Promise.allSettled(Object.values(calls));
        if (cancelled) return;
        const next = {};
        results.forEach((r, i) => { next[keys[i]] = r.status === 'fulfilled' ? r.value : null; });
        setData(next);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [ready, getToken]);

  const profile = data.profile;
  const displayName = profile?.name || user?.fullName
    || [user?.firstName, user?.lastName].filter(Boolean).join(' ') || user?.username || 'there';
  const firstName = displayName.split(' ')[0];
  const avatar = profile?.avatar || user?.imageUrl || '';

  const handleLogout = async () => {
    if (logoutLoading) return;
    setLogoutLoading(true);
    try {
      await signOut({ redirectUrl: '/login' });
    } catch (_) {
      toast.error('Failed to logout');
      setLogoutLoading(false);
    }
  };
  const safeNavigate = (path) => {
    if (path === '/logout') { setConfirmLogoutOpen(true); return; }
    navigate(path);
  };

  const devprepDays = useMemo(() => {
    const out = {};
    (data.activity || []).forEach(({ date, count }) => { out[date] = count; });
    return out;
  }, [data.activity]);
  const week = useMemo(() => thisWeek(devprepDays), [devprepDays]);
  const weekActive = week.filter((d) => d.count > 0).length;
  const connected = useMemo(() => PLATFORMS.filter((p) => data.dev?.connections?.[p]), [data.dev]);
  const heatSources = useMemo(() => [DEVPREP_SOURCE, ...platformSources(connected)], [connected]);
  const heatActivity = useMemo(() => ({ ...(data.dev?.activity || {}), devprep: devprepDays }), [data.dev, devprepDays]);

  const ongoing = (data.recent || []).find((a) => a.sessionId && a.status === 'active');
  const streak = data.streak?.currentStreak || 0;
  const solvedToday = (devprepDays[toKey()] || 0) > 0;

  const headline = loading ? '' : streak > 0
    ? `You're on a ${streak}-day streak${solvedToday ? ' and already practised today' : '. Practise today to keep it going'}.`
    : 'Solve a problem or take a mock interview to start a streak.';

  // Suggestions built only from the user's own numbers
  const nextSteps = useMemo(() => {
    const out = [];
    if (ongoing) out.push({ icon: PlayCircle, tone: 'text-violet-300', title: `Finish your ${ongoing.title.toLowerCase()}`, detail: 'It is still in progress.', path: `/interview/mock/${ongoing.sessionId}` });
    const weak = [...(data.topics || [])].sort((a, b) => a.averageScore - b.averageScore)[0];
    if (weak && weak.averageScore < 70) out.push({ icon: Lightbulb, tone: 'text-amber-300', title: `Practise ${weak.topic}`, detail: `Your interview average on it is ${weak.averageScore}.`, path: '/interview/mock' });
    if (!solvedToday) out.push({ icon: Code2, tone: 'text-emerald-300', title: streak > 0 ? `Keep your ${streak}-day streak` : 'Start a coding streak', detail: 'Solve one problem today.', path: '/coding/practice' });
    const c = data.coding;
    if (c && c.hardSolved === 0 && c.mediumSolved >= 5) out.push({ icon: Sparkles, tone: 'text-rose-300', title: 'Try your first hard problem', detail: `You've solved ${c.mediumSolved} medium ones.`, path: '/coding/practice' });
    if ((data.overview?.completedInterviews || 0) === 0) out.push({ icon: PlayCircle, tone: 'text-violet-300', title: 'Take your first mock interview', detail: 'Get an AI evaluation of your answers.', path: '/interview/mock' });
    if (data.dev && connected.length === 0) out.push({ icon: BarChart3, tone: 'text-sky-300', title: 'Connect your coding profiles', detail: 'Track GitHub, LeetCode and Codeforces here.', path: '/analytics?tab=connections' });
    if (profile && (!profile.bio || !(profile.skills || []).length || !profile.targetRole)) out.push({ icon: FileText, tone: 'text-cyan-300', title: 'Complete your profile', detail: 'Add a bio, skills and target role.', path: '/profile/edit' });
    return out.slice(0, 4);
  }, [ongoing, data, solvedToday, streak, connected, profile]);

  const modules = [
    {
      title: 'Coding Practice', desc: 'Solve DSA problems in the built-in editor', Icon: Code2, path: '/coding/practice',
      accent: 'from-emerald-500/20 to-emerald-500/0', iconCls: 'text-emerald-300 bg-emerald-500/10 border-emerald-400/20',
      stat: data.coding ? `${data.coding.totalSolved} of ${data.coding.totalProblems} solved` : null
    },
    {
      title: 'Mock Interview', desc: 'Timed AI interview with an evaluation', Icon: PlayCircle, path: '/interview/mock',
      accent: 'from-violet-500/20 to-violet-500/0', iconCls: 'text-violet-300 bg-violet-500/10 border-violet-400/20',
      stat: data.overview ? `${data.overview.completedInterviews} completed${data.overview.averageScore != null ? ` · avg ${data.overview.averageScore}` : ''}` : null
    },
    {
      title: 'Resume Interview', desc: 'Questions based on your own resume', Icon: FileText, path: '/interview/resume',
      accent: 'from-cyan-500/20 to-cyan-500/0', iconCls: 'text-cyan-300 bg-cyan-500/10 border-cyan-400/20',
      stat: data.insights ? `${data.insights.mock?.resumeInterviews || 0} done · ${data.insights.resume?.uploadedCount || 0} resume${data.insights.resume?.uploadedCount === 1 ? '' : 's'}` : null
    },
    {
      title: 'Question Generator', desc: 'AI practice sets for any role and topic', Icon: Brain, path: '/questions/generate',
      accent: 'from-pink-500/20 to-pink-500/0', iconCls: 'text-pink-300 bg-pink-500/10 border-pink-400/20',
      stat: data.savedStats ? `${Number(data.savedStats.totalSaved) || 0} questions saved` : null
    }
  ];

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-[#0f172a] via-[#030712] to-[#020617] text-white overflow-x-hidden relative">
      <EnhancedAnimatedBackground />

      <div className="relative z-10 min-h-screen p-4 lg:p-8">
        <div className="mx-auto w-full max-w-[1600px]">
          <div className="flex gap-5">
            <Sidebar
              openMobile={mobileSidebarOpen}
              onCloseMobile={() => setMobileSidebarOpen(false)}
              collapsed={sidebarCollapsed}
              onToggleCollapsed={() => setSidebarCollapsed((v) => !v)}
              items={SIDEBAR_ITEMS}
              onNavigate={safeNavigate}
              profile={{ name: displayName, avatar }}
              profilePath="/profile"
            />

            <div className="flex-1 min-w-0">
              <Navbar
                brand=""
                activeLabel="Dashboard"
                links={NAVBAR_LINKS}
                onNavigate={safeNavigate}
                onOpenMobileSidebar={() => setMobileSidebarOpen(true)}
                avatarUrl={avatar}
                onLogout={() => setConfirmLogoutOpen(true)}
              />

              <div className="mt-6 space-y-5">
                {/* Hero */}
                <motion.div {...fadeIn(0)} className="relative overflow-hidden rounded-3xl border border-white/10 bg-white/5 backdrop-blur-xl shadow-[0_10px_40px_rgba(0,0,0,0.35)]">
                  <div className="absolute inset-0 pointer-events-none">
                    <div className="absolute -top-24 -right-24 w-72 h-72 rounded-full bg-violet-600/20 blur-3xl" />
                    <div className="absolute -bottom-24 -left-24 w-72 h-72 rounded-full bg-cyan-600/15 blur-3xl" />
                  </div>
                  <div className="relative p-5 sm:p-7 grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-6 items-center">
                    <div className="min-w-0">
                      <div className="text-sm text-slate-400">{greeting()},</div>
                      {loading
                        ? <div className="mt-2 h-9 w-56 bg-white/10 rounded-lg animate-pulse" />
                        : <h1 className="text-2xl sm:text-3xl font-bold text-slate-50 mt-0.5 truncate">{firstName}</h1>}
                      {loading
                        ? <div className="mt-3 h-4 w-72 bg-white/10 rounded animate-pulse" />
                        : <p className="mt-2 text-sm text-slate-300">{headline}</p>}
                      <div className="mt-5 flex flex-wrap gap-3">
                        {ongoing ? (
                          <button type="button" onClick={() => navigate(`/interview/mock/${ongoing.sessionId}`)} className="h-10 px-5 rounded-xl bg-violet-600 hover:bg-violet-700 border border-violet-500 text-white text-sm font-semibold inline-flex items-center gap-2 shadow-[0_0_15px_rgba(139,92,246,0.25)]">
                            <PlayCircle className="w-4 h-4" /> Continue interview
                          </button>
                        ) : (
                          <button type="button" onClick={() => navigate('/interview/mock')} className="h-10 px-5 rounded-xl bg-violet-600 hover:bg-violet-700 border border-violet-500 text-white text-sm font-semibold inline-flex items-center gap-2 shadow-[0_0_15px_rgba(139,92,246,0.25)]">
                            <PlayCircle className="w-4 h-4" /> Start mock interview
                          </button>
                        )}
                        <button type="button" onClick={() => navigate('/coding/practice')} className="h-10 px-5 rounded-xl bg-white/5 border border-white/10 hover:border-white/20 text-sm text-slate-200 inline-flex items-center gap-2">
                          <Code2 className="w-4 h-4" /> Practise coding
                        </button>
                      </div>
                    </div>

                    <div className="rounded-2xl bg-black/20 border border-white/10 p-4 lg:w-80">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-300 font-medium">This week</span>
                        <span className="text-slate-500">{weekActive} of 7 days active</span>
                      </div>
                      <div className="mt-3 grid grid-cols-7 gap-1.5">
                        {week.map((d) => (
                          <div key={d.key} className="flex flex-col items-center gap-1.5" title={`${d.key}: ${d.count} submission${d.count === 1 ? '' : 's'}`}>
                            <div className={`w-full aspect-square rounded-lg border flex items-center justify-center text-[11px] font-semibold ${
                              d.count > 0 ? 'bg-violet-500/80 border-violet-300/40 text-white'
                                : d.future ? 'bg-white/[0.02] border-white/5 text-slate-600'
                                  : 'bg-white/5 border-white/10 text-slate-500'
                            } ${d.today ? 'ring-2 ring-violet-300/60' : ''}`}>
                              {d.count > 0 ? d.count : ''}
                            </div>
                            <span className={`text-[10px] ${d.today ? 'text-violet-200' : 'text-slate-500'}`}>{d.label}</span>
                          </div>
                        ))}
                      </div>
                      <div className="mt-3 text-[11px] text-slate-500">DevPrep submissions per day</div>
                    </div>
                  </div>
                </motion.div>

                <motion.div {...fadeIn(0.05)}>
                  <KpiStrip loading={loading} coding={data.coding} streak={data.streak} overview={data.overview} savedStats={data.savedStats} />
                </motion.div>

                <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
                  <motion.div {...fadeIn(0.1)} className="xl:col-span-2 min-w-0">
                    <Card className="h-full" title="Practice" icon={Sparkles} subtitle="Pick up where you left off">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {modules.map((m) => (
                          <motion.button
                            key={m.title}
                            type="button"
                            whileHover={{ y: -2 }}
                            whileTap={{ scale: 0.99 }}
                            onClick={() => navigate(m.path)}
                            className="group text-left relative overflow-hidden rounded-2xl p-4 bg-white/5 border border-white/10 hover:border-white/20 transition-colors"
                          >
                            <div className={`absolute inset-0 bg-gradient-to-br ${m.accent} pointer-events-none`} />
                            <div className="relative flex items-start gap-3">
                              <span className={`w-11 h-11 rounded-xl border flex items-center justify-center flex-shrink-0 ${m.iconCls}`}>
                                <m.Icon className="w-5 h-5" />
                              </span>
                              <div className="min-w-0 flex-1">
                                <div className="font-semibold text-slate-100">{m.title}</div>
                                <div className="text-sm text-slate-400 mt-0.5">{m.desc}</div>
                                <div className="mt-2 text-xs text-slate-300 min-h-[1rem]">
                                  {loading ? <span className="inline-block h-3 w-24 rounded bg-white/10 animate-pulse" /> : m.stat}
                                </div>
                              </div>
                              <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-slate-200 group-hover:translate-x-0.5 transition-all mt-1" />
                            </div>
                          </motion.button>
                        ))}
                      </div>
                    </Card>
                  </motion.div>
                  <motion.div {...fadeIn(0.12)} className="min-w-0">
                    <Card className="h-full" title="Next steps" icon={Lightbulb} subtitle="Based on your recent progress">
                      {loading ? (
                        <div className="space-y-2">{[1, 2, 3].map((i) => <div key={i} className="h-14 rounded-xl bg-white/5 animate-pulse" />)}</div>
                      ) : nextSteps.length ? (
                        <ul className="space-y-2">
                          {nextSteps.map((s) => (
                            <li key={s.title}>
                              <button type="button" onClick={() => navigate(s.path)} className="group w-full text-left flex items-center gap-3 rounded-xl bg-white/5 border border-white/5 hover:border-white/15 px-3 py-2.5">
                                <s.icon className={`w-4 h-4 flex-shrink-0 ${s.tone}`} />
                                <div className="min-w-0 flex-1">
                                  <div className="text-sm text-slate-100 truncate">{s.title}</div>
                                  <div className="text-xs text-slate-500 truncate">{s.detail}</div>
                                </div>
                                <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-slate-200" />
                              </button>
                            </li>
                          ))}
                        </ul>
                      ) : <p className="text-sm text-slate-400">You're all caught up. Nice work.</p>}
                    </Card>
                  </motion.div>
                </div>

                <motion.div {...fadeIn(0.15)}>
                  <Card
                    title="Coding activity"
                    icon={CalendarDays}
                    subtitle={connected.length ? `DevPrep plus ${connected.map((p) => PLATFORM_META[p].label).join(', ')}` : 'Your DevPrep submissions'}
                    action={(
                      <button type="button" onClick={() => navigate('/analytics?tab=activity')} className="text-xs text-violet-300 hover:text-violet-200 inline-flex items-center gap-1">
                        Dev Analytics <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    )}
                  >
                    {loading ? <div className="h-40 rounded-xl bg-white/5 animate-pulse" /> : (
                      <YearHeatmap sources={heatSources} activity={heatActivity} title="Coding activity" emptyHint="No activity in this range yet." />
                    )}
                  </Card>
                </motion.div>

                <motion.div {...fadeIn(0.2)}>
                  <RecentActivityCard loading={loading} items={data.recent} />
                </motion.div>
              </div>

              <div className="mt-8">
                <Footer onNavigate={safeNavigate} />
              </div>
            </div>
          </div>
        </div>
      </div>

      <Modal
        open={confirmLogoutOpen}
        title="Confirm Logout"
        onClose={() => setConfirmLogoutOpen(false)}
        footer={
          <div className="flex items-center justify-end gap-3">
            <button type="button" className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 hover:border-white/20 text-slate-200" onClick={() => setConfirmLogoutOpen(false)} disabled={logoutLoading}>
              Cancel
            </button>
            <button type="button" className="px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-700 border border-violet-500 text-white font-semibold disabled:opacity-50" onClick={handleLogout} disabled={logoutLoading}>
              Logout
            </button>
          </div>
        }
      >
        Are you sure you want to logout? You will need to sign in again to access your dashboard.
      </Modal>
    </div>
  );
};

export default Dashboard;
