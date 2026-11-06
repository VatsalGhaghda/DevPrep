import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useClerk, useUser } from '@clerk/clerk-react';
import { useReadyAuth } from '../hooks/useReadyAuth';
import { toast } from 'sonner';
import { CalendarDays, Code2, Layers } from 'lucide-react';
import { EnhancedAnimatedBackground } from '../components/EnhancedAnimatedBackground';
import Navbar from '../components/layout/Navbar';
import Sidebar from '../components/layout/Sidebar';
import Footer from '../components/layout/Footer';
import Modal from '../components/ui/Modal';
import { Card } from '../components/devAnalytics/ui';
import YearHeatmap from '../components/devAnalytics/YearHeatmap';
import {
  ProfileHero, KpiStrip, ProblemSolvingCard, BreakdownCard, InterviewPerformanceCard, CodingProfilesCard,
  RecentActivityCard, AchievementsCard, buildAchievements
} from '../components/profile/ProfileSections';
import { clerkAPI, questionsAPI, analyticsAPI, devAnalyticsAPI } from '../services/api';
import { PLATFORMS, platformSources } from '../utils/devAnalytics';
import { SIDEBAR_ITEMS, NAVBAR_LINKS } from '../config/navigation';

const DEVPREP_SOURCE = { id: 'devprep', label: 'DevPrep', color: '#a78bfa', unit: 'submissions' };

const fadeIn = (delay = 0) => ({
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.45, delay }
});

const Profile = () => {
  const navigate = useNavigate();
  const { user } = useUser();
  const { ready, getToken } = useReadyAuth();
  const { signOut } = useClerk();

  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => localStorage.getItem('sidebarCollapsed') === 'true');
  const [confirmLogoutOpen, setConfirmLogoutOpen] = useState(false);
  const [logoutLoading, setLogoutLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState({});

  /* ── Load everything in parallel; each part fails on its own ── */
  useEffect(() => {
    if (!ready) return undefined;
    let cancelled = false;
    (async () => {
      try {
        const token = await getToken();
        if (!token) return;
        const calls = {
          profile: clerkAPI.getProfile(token).then((r) => r.data?.user || null),
          savedStats: questionsAPI.getSavedStats(token).then((r) => r.data || null),
          overview: analyticsAPI.getOverview(token).then((r) => r.data?.overview || null),
          insights: analyticsAPI.getProfileInsights(token).then((r) => r.data?.insights || null),
          coding: analyticsAPI.getCodingStats(token).then((r) => r.data?.codingStats || null),
          activity: analyticsAPI.getSubmissionActivity(token).then((r) => r.data?.activity || []),
          streak: analyticsAPI.getStreak(token).then((r) => r.data?.streak || null),
          performance: analyticsAPI.getPerformance(token).then((r) => r.data?.performance?.points || []),
          topics: analyticsAPI.getTopics(token).then((r) => r.data?.topics || []),
          recent: analyticsAPI.getRecentActivity(token).then((r) => r.data?.activity || []),
          dev: devAnalyticsAPI.get(token).then((r) => r.data || null)
        };
        const keys = Object.keys(calls);
        const results = await Promise.allSettled(Object.values(calls));
        if (cancelled) return;
        const next = {};
        results.forEach((r, i) => { next[keys[i]] = r.status === 'fulfilled' ? r.value : null; });
        setData(next);
        if (!next.profile && !next.coding) toast.error('Could not load your profile. Please refresh the page.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [ready, getToken]);

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

  const profile = data.profile;
  const displayName = profile?.name || user?.fullName
    || [user?.firstName, user?.lastName].filter(Boolean).join(' ') || user?.username || 'User';
  const email = profile?.email || user?.primaryEmailAddress?.emailAddress || '';
  const avatar = profile?.avatar || user?.imageUrl || '';

  // Only real, saved fields count; nothing is filled in with defaults
  const completeness = useMemo(() => {
    const checks = [
      ['photo', Boolean(profile?.avatar || user?.imageUrl)],
      ['bio', Boolean(profile?.bio)],
      ['3+ skills', (profile?.skills || []).length >= 3],
      ['target role', Boolean(profile?.targetRole)],
      ['username', Boolean(profile?.username)]
    ];
    return { done: checks.filter(([, ok]) => ok).length, total: checks.length, missing: checks.filter(([, ok]) => !ok).map(([k]) => k) };
  }, [profile, user]);

  // Heatmap: DevPrep submissions plus any connected platform
  const connected = useMemo(() => PLATFORMS.filter((p) => data.dev?.connections?.[p]), [data.dev]);
  const heatSources = useMemo(() => [DEVPREP_SOURCE, ...platformSources(connected)], [connected]);
  const heatActivity = useMemo(() => {
    const devprep = {};
    (data.activity || []).forEach(({ date, count }) => { devprep[date] = count; });
    return { ...(data.dev?.activity || {}), devprep };
  }, [data.activity, data.dev]);

  const achievements = useMemo(() => buildAchievements({
    coding: data.coding, streak: data.streak, overview: data.overview, performance: data.performance,
    savedStats: data.savedStats, profileComplete: completeness
  }), [data, completeness]);

  const languages = (data.insights?.languageUsage || []).map((x) => ({ name: x.language, value: x.count }));
  const categories = (data.insights?.solvedCategories || []).map((x) => ({ name: x.category, value: x.count }));

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
              onNavigate={(path) => {
                if (path === '/logout') { setConfirmLogoutOpen(true); return; }
                navigate(path);
              }}
              profile={{ name: displayName, avatar }}
              profilePath="/profile"
            />

            <div className="flex-1 min-w-0">
              <Navbar
                brand=""
                activeLabel="Profile"
                links={NAVBAR_LINKS}
                onOpenMobileSidebar={() => setMobileSidebarOpen(true)}
                avatarUrl={avatar}
                onLogout={() => setConfirmLogoutOpen(true)}
              />

              <div className="mt-6 space-y-5">
                <motion.div {...fadeIn(0)}>
                  <ProfileHero
                    loading={loading}
                    displayName={displayName}
                    email={email}
                    profile={profile}
                    avatar={avatar}
                    completeness={completeness}
                    onEdit={() => navigate('/profile/edit')}
                  />
                </motion.div>

                <motion.div {...fadeIn(0.05)}>
                  <KpiStrip loading={loading} coding={data.coding} streak={data.streak} overview={data.overview} savedStats={data.savedStats} />
                </motion.div>

                <motion.div {...fadeIn(0.1)}>
                  <Card title="Coding activity" icon={CalendarDays} subtitle={connected.length ? 'DevPrep submissions and your connected platforms' : 'Your DevPrep submissions'}>
                    {loading ? <div className="h-40 rounded-xl bg-white/5 animate-pulse" /> : (
                      <YearHeatmap
                        sources={heatSources}
                        activity={heatActivity}
                        title="Coding activity"
                        emptyHint="No activity in this range yet. Submissions in Coding Practice show up here."
                      />
                    )}
                  </Card>
                </motion.div>

                <motion.div {...fadeIn(0.15)} className="grid grid-cols-1 xl:grid-cols-3 gap-5">
                  <div className="xl:col-span-2"><ProblemSolvingCard loading={loading} coding={data.coding} /></div>
                  <CodingProfilesCard loading={loading} dev={data.dev} onOpen={() => navigate(connected.length ? '/analytics' : '/analytics?tab=connections')} />
                </motion.div>

                <motion.div {...fadeIn(0.2)} className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <BreakdownCard title="Languages" icon={Code2} subtitle="Your DevPrep submissions by language" items={languages} loading={loading} empty="No submissions yet" color="#22d3ee" />
                  <BreakdownCard title="Solved by category" icon={Layers} subtitle="Accepted problems by topic" items={categories} loading={loading} empty="No solved problems yet" color="#a78bfa" />
                </motion.div>

                <motion.div {...fadeIn(0.25)} className="grid grid-cols-1 xl:grid-cols-5 gap-5">
                  <div className="xl:col-span-3">
                    <InterviewPerformanceCard loading={loading} overview={data.overview} performance={data.performance} topics={data.topics} />
                  </div>
                  <div className="xl:col-span-2">
                    <RecentActivityCard loading={loading} items={data.recent} />
                  </div>
                </motion.div>

                <motion.div {...fadeIn(0.3)}>
                  <AchievementsCard loading={loading} achievements={achievements} />
                </motion.div>
              </div>

              <div className="mt-8">
                <Footer />
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
            <button
              type="button"
              className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 hover:border-white/20 text-slate-200"
              onClick={() => setConfirmLogoutOpen(false)}
              disabled={logoutLoading}
            >
              Cancel
            </button>
            <button
              type="button"
              className="px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-700 border border-violet-500 text-white font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={handleLogout}
              disabled={logoutLoading}
            >
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

export default Profile;
