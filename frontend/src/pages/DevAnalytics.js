import { useCallback, useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useClerk, useUser } from '@clerk/clerk-react';
import { toast } from 'sonner';
import { BarChart3, Loader2, RefreshCw } from 'lucide-react';
import { useReadyAuth } from '../hooks/useReadyAuth';
import { EnhancedAnimatedBackground } from '../components/EnhancedAnimatedBackground';
import Navbar from '../components/layout/Navbar';
import Sidebar from '../components/layout/Sidebar';
import Footer from '../components/layout/Footer';
import Modal from '../components/ui/Modal';
import { clerkAPI, devAnalyticsAPI } from '../services/api';
import { SIDEBAR_ITEMS, NAVBAR_LINKS } from '../config/navigation';
import { PLATFORMS, PLATFORM_META, timeAgo } from '../utils/devAnalytics';
import { OverviewSection, ActivitySection, InsightsSection } from '../components/devAnalytics/OverviewInsights';
import { GitHubSection, LeetCodeSection, CodeforcesSection } from '../components/devAnalytics/PlatformSections';
import ContestsSection from '../components/devAnalytics/ContestsSection';
import ConnectionsSection from '../components/devAnalytics/ConnectionsSection';

const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'activity', label: 'Activity' },
  { id: 'github', label: 'GitHub' },
  { id: 'leetcode', label: 'LeetCode' },
  { id: 'codeforces', label: 'Codeforces' },
  { id: 'contests', label: 'Contests' },
  { id: 'insights', label: 'Insights' },
  { id: 'connections', label: 'Connections' }
];

const errorMessage = (err, fallback) => err?.response?.data?.message || err?.message || fallback;

const DevAnalytics = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useUser();
  const { ready, getToken } = useReadyAuth();
  const { signOut } = useClerk();

  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => localStorage.getItem('sidebarCollapsed') === 'true');
  const [confirmLogoutOpen, setConfirmLogoutOpen] = useState(false);
  const [logoutLoading, setLogoutLoading] = useState(false);
  const [dbProfile, setDbProfile] = useState(null);

  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [busy, setBusy] = useState({});
  const [contests, setContests] = useState(null);
  const [contestsLoading, setContestsLoading] = useState(false);
  const autoSynced = useRef(false);

  const tab = TABS.some((t) => t.id === searchParams.get('tab')) ? searchParams.get('tab') : 'overview';
  const setTab = (id) => setSearchParams(id === 'overview' ? {} : { tab: id }, { replace: true });

  const safeNavigate = (path) => {
    if (path === '/logout') { setConfirmLogoutOpen(true); return; }
    navigate(path);
  };

  const handleLogout = async () => {
    if (logoutLoading) return;
    setLogoutLoading(true);
    try { await signOut({ redirectUrl: '/login' }); } catch (_) { toast.error('Failed to logout'); setLogoutLoading(false); }
  };

  const displayName = user?.fullName || [user?.firstName, user?.lastName].filter(Boolean).join(' ') ||
    user?.username || (dbProfile && dbProfile.name) || 'User';
  const avatarUrl = (dbProfile && dbProfile.avatar) || user?.imageUrl || '';

  useEffect(() => {
    if (!ready) return;
    (async () => {
      try {
        const token = await getToken();
        if (!token) return;
        const res = await clerkAPI.getProfile(token);
        setDbProfile(res.data?.user || null);
      } catch (_) { /* ignore */ }
    })();
  }, [ready, getToken]);

  const withToken = useCallback(async (fn) => {
    const token = await getToken();
    if (!token) throw new Error('Not authenticated');
    return fn(token);
  }, [getToken]);

  const reportResults = (results = []) => {
    results.forEach((r) => {
      const label = PLATFORM_META[r.platform]?.label || r.platform;
      if (r.ok) toast.success(`${label} synced`);
      else if (r.skipped) toast.message(r.error);
      else toast.error(`${label}: ${r.error}`);
    });
  };

  const sync = useCallback(async (platform, { onlyStale = false, quiet = false } = {}) => {
    const key = platform || 'all';
    setBusy((b) => ({ ...b, [key]: true }));
    try {
      const res = await withToken((t) => devAnalyticsAPI.sync(t, { platform, onlyStale }));
      setAnalytics(res.data);
      if (!quiet) reportResults(res.data.results);
      else (res.data.results || []).filter((r) => !r.ok && !r.skipped).forEach((r) => toast.error(`${PLATFORM_META[r.platform].label}: ${r.error}`));
    } catch (err) {
      toast.error(errorMessage(err, 'Sync failed'));
    } finally {
      setBusy((b) => ({ ...b, [key]: false }));
    }
  }, [withToken]);

  // Load stored analytics, then refresh anything older than the server's stale window
  useEffect(() => {
    if (!ready) return;
    (async () => {
      try {
        const res = await withToken((t) => devAnalyticsAPI.get(t));
        setAnalytics(res.data);
        setLoadError('');
        const staleAfter = res.data.settings?.staleAfterMs || 6 * 3600 * 1000;
        const stale = PLATFORMS.some((p) => {
          const c = res.data.connections?.[p];
          return c && (!c.lastSyncedAt || Date.now() - new Date(c.lastSyncedAt).getTime() > staleAfter);
        });
        if (stale && !autoSynced.current) {
          autoSynced.current = true;
          sync(undefined, { onlyStale: true, quiet: true });
        }
      } catch (err) {
        setLoadError(errorMessage(err, 'Could not load your analytics'));
      } finally {
        setLoading(false);
      }
    })();
  }, [ready, withToken, sync]);

  const loadContests = useCallback(async (refresh = false) => {
    setContestsLoading(true);
    try {
      const res = await withToken((t) => devAnalyticsAPI.contests(t, refresh));
      setContests(res.data);
    } catch (err) {
      toast.error(errorMessage(err, 'Could not load contests'));
    } finally {
      setContestsLoading(false);
    }
  }, [withToken]);

  useEffect(() => {
    if (ready && (tab === 'contests') && !contests && !contestsLoading) loadContests();
  }, [ready, tab, contests, contestsLoading, loadContests]);

  const saveConnection = async (platform, value) => {
    setBusy((b) => ({ ...b, [platform]: true }));
    try {
      const res = await withToken((t) => devAnalyticsAPI.connect(t, platform, value));
      setAnalytics(res.data);
      const conn = res.data.connections?.[platform];
      if (conn?.status === 'unverified') toast.message(`${PLATFORM_META[platform].label} saved. ${conn.lastError || ''}`);
      else if (res.data.sync && !res.data.sync.ok) toast.error(`${PLATFORM_META[platform].label} connected, but sync failed: ${res.data.sync.error}`);
      else toast.success(`${PLATFORM_META[platform].label} connected`);
    } catch (err) {
      toast.error(errorMessage(err, 'Could not save that profile'));
    } finally {
      setBusy((b) => ({ ...b, [platform]: false }));
    }
  };

  const removeConnection = async (platform) => {
    if (!window.confirm(`Remove your ${PLATFORM_META[platform].label} profile and its stored analytics?`)) return;
    setBusy((b) => ({ ...b, [platform]: true }));
    try {
      const res = await withToken((t) => devAnalyticsAPI.disconnect(t, platform));
      setAnalytics(res.data);
      toast.success(`${PLATFORM_META[platform].label} removed`);
    } catch (err) {
      toast.error(errorMessage(err, 'Could not remove that profile'));
    } finally {
      setBusy((b) => ({ ...b, [platform]: false }));
    }
  };

  const lastSynced = PLATFORMS
    .map((p) => analytics?.connections?.[p]?.lastSyncedAt)
    .filter(Boolean)
    .sort()
    .pop();
  const anyConnected = PLATFORMS.some((p) => analytics?.connections?.[p]);
  const syncingAny = Object.values(busy).some(Boolean);
  const goConnections = () => setTab('connections');

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
              profile={{ name: displayName, avatar: avatarUrl }}
              profilePath="/profile"
            />

            <div className="flex-1 min-w-0 flex flex-col">
              <Navbar
                brand=""
                activeLabel="Dev Analytics"
                links={NAVBAR_LINKS}
                onNavigate={safeNavigate}
                onOpenMobileSidebar={() => setMobileSidebarOpen(true)}
                avatarUrl={avatarUrl}
                onLogout={() => setConfirmLogoutOpen(true)}
              />

              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="mt-6 flex-1">
                <div className="flex flex-wrap items-end justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <BarChart3 className="w-6 h-6 text-violet-300" />
                      <h1 className="text-2xl font-bold text-slate-100">Developer Analytics</h1>
                    </div>
                    <p className="text-sm text-slate-400 mt-1">
                      Your GitHub, LeetCode and Codeforces progress in one place.
                      {lastSynced && <span className="text-slate-500"> Last synced {timeAgo(lastSynced)}.</span>}
                    </p>
                  </div>
                  {anyConnected && (
                    <button
                      type="button"
                      onClick={() => sync(undefined)}
                      disabled={syncingAny}
                      className="h-10 px-4 rounded-xl bg-violet-600 hover:bg-violet-700 border border-violet-500 text-white text-sm font-semibold inline-flex items-center gap-2 disabled:opacity-60 shadow-[0_0_20px_rgba(139,92,246,0.2)]"
                    >
                      {syncingAny ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                      {syncingAny ? 'Syncing…' : 'Sync all'}
                    </button>
                  )}
                </div>

                <div className="mt-5 overflow-x-auto">
                  <div role="tablist" className="inline-flex gap-1 rounded-2xl bg-[#1e1e2d]/60 border border-white/10 p-1 backdrop-blur-xl">
                    {TABS.map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        role="tab"
                        aria-selected={tab === t.id}
                        onClick={() => setTab(t.id)}
                        className={`h-9 px-3.5 rounded-xl text-sm font-medium whitespace-nowrap transition-colors ${
                          tab === t.id ? 'bg-violet-600/40 text-violet-50' : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="mt-5">
                  {loading ? (
                    <div className="py-16 text-center">
                      <div className="w-10 h-10 rounded-full border-2 border-violet-400 border-t-transparent animate-spin mx-auto" />
                      <p className="text-sm text-slate-400 mt-3">Loading your analytics…</p>
                    </div>
                  ) : loadError ? (
                    <div className="rounded-2xl border border-rose-500/20 bg-rose-600/10 p-6 text-center text-sm text-rose-300">{loadError}</div>
                  ) : (
                    <>
                      {tab === 'overview' && <OverviewSection analytics={analytics} onGo={setTab} />}
                      {tab === 'activity' && <ActivitySection analytics={analytics} />}
                      {tab === 'github' && (
                        <GitHubSection
                          data={analytics?.data?.github}
                          connection={analytics?.connections?.github}
                          activity={analytics?.activity}
                          tokenConfigured={analytics?.settings?.githubTokenConfigured}
                          onConnect={goConnections}
                        />
                      )}
                      {tab === 'leetcode' && (
                        <LeetCodeSection data={analytics?.data?.leetcode} connection={analytics?.connections?.leetcode} activity={analytics?.activity} onConnect={goConnections} />
                      )}
                      {tab === 'codeforces' && (
                        <CodeforcesSection data={analytics?.data?.codeforces} connection={analytics?.connections?.codeforces} activity={analytics?.activity} onConnect={goConnections} />
                      )}
                      {tab === 'contests' && (
                        <ContestsSection contests={contests} loading={contestsLoading} onRefresh={() => loadContests(true)} data={analytics?.data} />
                      )}
                      {tab === 'insights' && <InsightsSection analytics={analytics} />}
                      {tab === 'connections' && (
                        <ConnectionsSection
                          analytics={analytics}
                          busy={busy}
                          onSave={saveConnection}
                          onRemove={removeConnection}
                          onSync={(p) => sync(p)}
                          onSyncAll={() => sync(undefined)}
                        />
                      )}
                    </>
                  )}
                </div>
              </motion.div>

              <Footer onNavigate={safeNavigate} />
            </div>
          </div>
        </div>
      </div>

      <Modal open={confirmLogoutOpen} onClose={() => setConfirmLogoutOpen(false)}>
        <div className="p-6">
          <div className="text-lg font-semibold text-slate-100">Confirm Logout</div>
          <p className="text-sm text-slate-300 mt-2">Are you sure you want to logout?</p>
          <div className="mt-5 flex items-center justify-end gap-3">
            <button type="button" onClick={() => setConfirmLogoutOpen(false)} className="h-10 px-4 rounded-xl bg-white/5 border border-white/10 hover:border-white/20 text-slate-200">
              Cancel
            </button>
            <button
              type="button"
              onClick={handleLogout}
              disabled={logoutLoading}
              className="h-10 px-4 rounded-xl bg-rose-600/80 border border-rose-500/30 hover:bg-rose-600 text-white font-semibold disabled:opacity-60"
            >
              {logoutLoading ? 'Logging out…' : 'Logout'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default DevAnalytics;
