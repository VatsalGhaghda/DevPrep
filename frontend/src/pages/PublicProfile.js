import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { ArrowLeft, CalendarDays, CheckCircle2, Code2, Flame, Layers, Link2, MessageSquare, TrendingUp, User, Zap } from 'lucide-react';
import { EnhancedAnimatedBackground } from '../components/EnhancedAnimatedBackground';
import Navbar from '../components/layout/Navbar';
import Sidebar from '../components/layout/Sidebar';
import Footer from '../components/layout/Footer';
import { Card } from '../components/devAnalytics/ui';
import YearHeatmap from '../components/devAnalytics/YearHeatmap';
import {
  ProfileHero, Kpi, ProblemSolvingCard, BreakdownCard, RecentSolvedCard, AchievementsCard, buildAchievements
} from '../components/profile/ProfileSections';
import { userAPI } from '../services/api';
import { SIDEBAR_ITEMS, NAVBAR_LINKS } from '../config/navigation';

const DEVPREP_SOURCE = { id: 'devprep', label: 'DevPrep', color: '#a78bfa', unit: 'submissions' };
// Achievement tracks that only use data a public profile shares
const PUBLIC_TRACKS = ['solved', 'hard', 'streak', 'interviews'];

const fadeIn = (delay = 0) => ({
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.45, delay }
});

const PublicProfile = () => {
  const { username } = useParams();
  const navigate = useNavigate();

  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => localStorage.getItem('sidebarCollapsed') === 'true');
  const [profile, setProfile] = useState(null);
  const [stats, setStats] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!username) return undefined;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setNotFound(false);
      const [p, a] = await Promise.allSettled([userAPI.getPublicProfile(username), userAPI.getPublicAnalytics(username)]);
      if (cancelled) return;
      if (p.status === 'fulfilled') {
        setProfile(p.value.data.user);
        setStats(p.value.data.stats);
      } else if (p.reason?.response?.status === 404) {
        setNotFound(true);
      } else {
        toast.error('Could not load this profile. Please try again.');
      }
      setAnalytics(a.status === 'fulfilled' ? a.value.data : null);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [username]);

  const coding = analytics?.codingStats;
  const streak = analytics?.streak;
  const heatActivity = useMemo(() => {
    const devprep = {};
    (analytics?.activity || []).forEach(({ date, count }) => { devprep[date] = count; });
    return { devprep };
  }, [analytics]);

  const achievements = useMemo(() => buildAchievements({
    coding, streak, overview: { completedInterviews: stats?.interviewsCompleted || 0 }, performance: [], savedStats: null,
    profileComplete: { done: 0, total: 1 }
  }).filter((a) => PUBLIC_TRACKS.includes(a.id)), [coding, streak, stats]);

  const languages = (analytics?.languageUsage || []).map((x) => ({ name: x.language, value: x.count }));
  const categories = (analytics?.solvedCategories || []).map((x) => ({ name: x.category, value: x.count }));
  const name = profile?.name || profile?.username || username;

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      toast.success('Profile link copied');
    } catch (_) {
      toast.error('Could not copy the link');
    }
  };

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
              onNavigate={(path) => navigate(path === '/logout' ? '/profile' : path)}
              profile={{ name: 'DevPrep', avatar: '' }}
              profilePath="/profile"
            />

            <div className="flex-1 min-w-0">
              <Navbar
                brand=""
                activeLabel={profile ? `@${profile.username}` : 'User Profile'}
                links={NAVBAR_LINKS}
                onOpenMobileSidebar={() => setMobileSidebarOpen(true)}
              />

              <div className="mt-6">
                {!loading && notFound ? (
                  <motion.div {...fadeIn(0)} className="rounded-3xl border border-white/10 bg-white/5 backdrop-blur-xl p-10 text-center">
                    <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mx-auto mb-4">
                      <User className="w-8 h-8 text-slate-400" />
                    </div>
                    <div className="text-xl font-semibold mb-2">Profile not found</div>
                    <p className="text-slate-400 text-sm mb-6">
                      There is no public profile for <span className="text-slate-200 font-medium">@{username}</span>. It may be private or the username may have changed.
                    </p>
                    <button
                      type="button"
                      onClick={() => navigate(-1)}
                      className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white/5 border border-white/10 hover:border-white/20 text-slate-200 text-sm"
                    >
                      <ArrowLeft className="w-4 h-4" /> Go back
                    </button>
                  </motion.div>
                ) : (
                  <div className="space-y-5">
                    <motion.div {...fadeIn(0)}>
                      <ProfileHero
                        readOnly
                        loading={loading}
                        displayName={name}
                        profile={profile}
                        avatar={profile?.avatar}
                        actions={(
                          <>
                            <button
                              type="button"
                              onClick={copyLink}
                              className="h-10 px-4 rounded-xl bg-violet-600 hover:bg-violet-700 border border-violet-500 text-white text-sm font-semibold inline-flex items-center justify-center gap-2"
                            >
                              <Link2 className="w-4 h-4" /> Copy profile link
                            </button>
                            <button
                              type="button"
                              onClick={() => navigate(-1)}
                              className="h-10 px-4 rounded-xl bg-white/5 border border-white/10 hover:border-white/20 text-sm text-slate-200 inline-flex items-center justify-center gap-2"
                            >
                              <ArrowLeft className="w-4 h-4" /> Back
                            </button>
                          </>
                        )}
                      />
                    </motion.div>

                    <motion.div {...fadeIn(0.05)} className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
                      <Kpi loading={loading} icon={CheckCircle2} iconClass="text-emerald-400" label="Problems solved"
                        value={coding?.totalSolved ?? stats?.problemsSolved ?? 0} sub={coding?.totalProblems ? `of ${coding.totalProblems} on DevPrep` : null} />
                      <Kpi loading={loading} icon={TrendingUp} iconClass="text-cyan-400" label="Acceptance rate"
                        value={`${coding?.acceptanceRate || 0}%`} sub={`${coding?.totalSubmissions || 0} submissions`} />
                      <Kpi loading={loading} icon={Flame} iconClass="text-orange-400" label="Current streak"
                        value={`${streak?.currentStreak || 0}d`} sub={streak?.lastActiveDate ? `Last active ${new Date(`${streak.lastActiveDate}T00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}` : 'No activity yet'} />
                      <Kpi loading={loading} icon={Zap} iconClass="text-violet-400" label="Best streak"
                        value={`${streak?.longestStreak || 0}d`} sub="all time" />
                      <Kpi loading={loading} icon={MessageSquare} iconClass="text-pink-400" label="Interviews completed"
                        value={stats?.interviewsCompleted ?? 0} sub="AI mock interviews" />
                      <Kpi loading={loading} icon={CalendarDays} iconClass="text-amber-400" label="Member since"
                        value={profile?.memberSince ? new Date(profile.memberSince).toLocaleDateString(undefined, { month: 'short', year: 'numeric' }) : '—'} />
                    </motion.div>

                    <motion.div {...fadeIn(0.1)}>
                      <Card title="Coding activity" icon={CalendarDays} subtitle="Submissions on DevPrep">
                        {loading ? <div className="h-40 rounded-xl bg-white/5 animate-pulse" /> : (
                          <YearHeatmap sources={[DEVPREP_SOURCE]} activity={heatActivity} title={`${name}'s coding activity`} emptyHint="No submissions in this range." />
                        )}
                      </Card>
                    </motion.div>

                    <motion.div {...fadeIn(0.15)} className="grid grid-cols-1 xl:grid-cols-3 gap-5">
                      <div className="xl:col-span-2"><ProblemSolvingCard loading={loading} coding={coding} /></div>
                      <RecentSolvedCard loading={loading} items={analytics?.recentSolved} />
                    </motion.div>

                    <motion.div {...fadeIn(0.2)} className="grid grid-cols-1 md:grid-cols-2 gap-5">
                      <BreakdownCard title="Languages" icon={Code2} subtitle="Submissions by language" items={languages} loading={loading} empty="No submissions yet" color="#22d3ee" />
                      <BreakdownCard title="Solved by category" icon={Layers} subtitle="Accepted problems by topic" items={categories} loading={loading} empty="No solved problems yet" color="#a78bfa" />
                    </motion.div>

                    <motion.div {...fadeIn(0.25)}>
                      <AchievementsCard loading={loading} achievements={achievements} />
                    </motion.div>
                  </div>
                )}
              </div>

              <div className="mt-8">
                <Footer />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PublicProfile;
