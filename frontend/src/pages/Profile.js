import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useAuth, useClerk, useUser } from '@clerk/clerk-react';
import { toast } from 'sonner';
import {
  LayoutDashboard,
  FileUp,
  FileText,
  Code2,
  PlayCircle,
  Sparkles,
  ClipboardCheck,
  User,
  Shield,
  BarChart3,
  PencilLine,
  ChevronRight
} from 'lucide-react';
import { EnhancedAnimatedBackground } from '../components/EnhancedAnimatedBackground';
import Navbar from '../components/layout/Navbar';
import Sidebar from '../components/layout/Sidebar';
import Footer from '../components/layout/Footer';
import Modal from '../components/ui/Modal';
import { clerkAPI } from '../services/api';

const Profile = () => {
  const navigate = useNavigate();
  const { user } = useUser();
  const { getToken, isLoaded: authLoaded } = useAuth();
  const { signOut } = useClerk();
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [dbProfile, setDbProfile] = useState(null);
  const [confirmLogoutOpen, setConfirmLogoutOpen] = useState(false);
  const [logoutLoading, setLogoutLoading] = useState(false);

  const knownRoutes = useMemo(
    () => new Set(['/dashboard', '/profile', '/profile/edit', '/questions/generate']),
    []
  );

  const safeNavigate = (path) => {
    if (path === '/logout') {
      setConfirmLogoutOpen(true);
      return;
    }

    if (!knownRoutes.has(path)) {
      toast.info('Coming soon');
      return;
    }
    navigate(path);
  };

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

  const displayName =
    user?.fullName ||
    [user?.firstName, user?.lastName].filter(Boolean).join(' ') ||
    user?.username ||
    'User';
  const email = user?.primaryEmailAddress?.emailAddress || '';

  useEffect(() => {
    if (!authLoaded) return;
    if (!user) return;

    (async () => {
      try {
        const token = await getToken();
        if (!token) return;
        const res = await clerkAPI.getProfile(token);
        setDbProfile(res.data?.user || null);
      } catch (_) {
        // Ignore: we can fall back to Clerk-only display
      }
    })();
  }, [authLoaded, getToken, user]);

  const profileData = useMemo(() => {
    const md = user?.publicMetadata || {};
    const experienceLevel =
      (dbProfile && dbProfile.experienceLevel) ||
      (typeof md.experienceLevel === 'string' ? md.experienceLevel : 'Beginner');
    const targetRole =
      (dbProfile && dbProfile.targetRole) ||
      (typeof md.targetRole === 'string' ? md.targetRole : 'Frontend Developer');
    const skills =
      (dbProfile && Array.isArray(dbProfile.skills) ? dbProfile.skills : null) ||
      (Array.isArray(md.skills) ? md.skills.filter((s) => typeof s === 'string') : ['React', 'JavaScript', 'DSA']);

    const bio = (dbProfile && typeof dbProfile.bio === 'string' ? dbProfile.bio : '') || '';
    const avatar = (dbProfile && typeof dbProfile.avatar === 'string' ? dbProfile.avatar : '') || '';

    return { experienceLevel, targetRole, skills: skills.slice(0, 12), bio, avatar };
  }, [dbProfile, user]);

  const sidebarItems = useMemo(
    () => [
      { label: 'Dashboard', path: '/dashboard', Icon: LayoutDashboard },
      { label: 'Profile', path: '/profile', Icon: User },
      { label: 'Question Generator', path: '/questions/generate', Icon: Sparkles },
      { label: 'Mock Interview', path: '/interview/mock', Icon: PlayCircle },
      { label: 'Answer Evaluation', path: '/evaluate', Icon: ClipboardCheck },
      { label: 'Resume Upload', path: '/resume/upload', Icon: FileUp },
      { label: 'Resume Interview', path: '/interview/resume', Icon: FileText },
      { label: 'Coding Practice', path: '/coding/practice', Icon: Code2 }
    ],
    []
  );

  const navbarLinks = useMemo(
    () => [
      { label: 'Dashboard', path: '/dashboard' },
      { label: 'Questions', path: '/questions/generate' },
      { label: 'Mock', path: '/interview/mock' },
      { label: 'Evaluate', path: '/evaluate' },
      { label: 'Coding', path: '/coding/practice' }
    ],
    []
  );

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-[#0f172a] via-[#030712] to-[#020617] text-white overflow-hidden relative">
      <EnhancedAnimatedBackground />

      <div className="relative z-10 min-h-screen p-4 lg:p-8">
        <div className="mx-auto w-full max-w-7xl">
          <div className="flex gap-4">
            <Sidebar
              openMobile={mobileSidebarOpen}
              onCloseMobile={() => setMobileSidebarOpen(false)}
              collapsed={sidebarCollapsed}
              onToggleCollapsed={() => setSidebarCollapsed((v) => !v)}
              items={sidebarItems}
              onNavigate={safeNavigate}
              profile={{ name: displayName, avatar: profileData.avatar || user?.imageUrl || '' }}
              profilePath="/profile"
            />

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <Navbar
                    brand="DevPrep"
                    activeLabel="Profile"
                    links={navbarLinks}
                    onNavigate={safeNavigate}
                    onOpenMobileSidebar={() => setMobileSidebarOpen(true)}
                    avatarUrl={profileData.avatar || user?.imageUrl || ''}
                  />
                </div>
              </div>

              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6 }}
                className="mt-6 relative overflow-hidden rounded-3xl border border-white/10 bg-white/5 backdrop-blur-xl shadow-[0_10px_40px_rgba(0,0,0,0.35)]"
              >
                <div className="absolute inset-0">
                  <div className="absolute -top-24 -right-24 w-72 h-72 rounded-full bg-violet-600/20 blur-3xl" />
                  <div className="absolute -bottom-24 -left-24 w-72 h-72 rounded-full bg-cyan-600/15 blur-3xl" />
                </div>

                <div className="relative p-6 sm:p-7 flex flex-col sm:flex-row sm:items-center gap-5">
                  <div className="flex items-center gap-4 min-w-0">
                    {profileData.avatar ? (
                      <img
                        src={profileData.avatar}
                        alt="Avatar"
                        className="w-14 h-14 rounded-2xl border border-white/10 object-cover"
                      />
                    ) : (
                      <div className="w-14 h-14 rounded-2xl bg-gradient-to-r from-cyan-400/20 via-violet-400/20 to-pink-400/20 border border-white/10 flex items-center justify-center">
                        <span className="text-lg font-semibold text-white">
                          {(displayName?.[0] || 'U').toUpperCase()}
                        </span>
                      </div>
                    )}
                    <div className="min-w-0">
                      <div className="text-xl sm:text-2xl font-semibold truncate">{displayName}</div>
                      <div className="text-sm text-slate-400 truncate">{email}</div>
                    </div>
                  </div>

                  <div className="sm:ml-auto flex items-center gap-3">
                    <motion.button
                      type="button"
                      whileHover={{ y: -1 }}
                      whileTap={{ scale: 0.98 }}
                      className="px-4 py-2 rounded-2xl bg-gradient-to-r from-violet-600 to-indigo-600 border border-white/10 hover:border-white/20 font-semibold inline-flex items-center gap-2"
                      onClick={() => safeNavigate('/profile/edit')}
                    >
                      <PencilLine className="w-4 h-4" />
                      Edit profile
                    </motion.button>
                  </div>
                </div>
              </motion.div>

              <div className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-6">
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, delay: 0.05 }}
                    className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl p-5 shadow-[0_8px_32px_rgba(0,0,0,0.35)]"
                  >
                    <div className="flex items-center justify-between gap-4">
                      <div className="min-w-0">
                        <div className="text-lg font-semibold">Personal information</div>
                        <div className="text-sm text-slate-400 mt-1">Your core profile details</div>
                      </div>
                    </div>

                    <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="rounded-2xl bg-white/5 border border-white/10 p-4">
                        <div className="text-xs text-slate-500">Name</div>
                        <div className="text-sm font-semibold text-slate-100 mt-1 truncate">{displayName}</div>
                      </div>
                      <div className="rounded-2xl bg-white/5 border border-white/10 p-4">
                        <div className="text-xs text-slate-500">Email</div>
                        <div className="text-sm font-semibold text-slate-100 mt-1 truncate">{email || '-'}</div>
                      </div>
                      <div className="rounded-2xl bg-white/5 border border-white/10 p-4">
                        <div className="text-xs text-slate-500">Experience level</div>
                        <div className="text-sm font-semibold text-slate-100 mt-1 truncate">{profileData.experienceLevel}</div>
                      </div>
                      <div className="rounded-2xl bg-white/5 border border-white/10 p-4">
                        <div className="text-xs text-slate-500">Target role</div>
                        <div className="text-sm font-semibold text-slate-100 mt-1 truncate">{profileData.targetRole}</div>
                      </div>
                    </div>

                    <div className="mt-4 rounded-2xl bg-white/5 border border-white/10 p-4">
                      <div className="text-xs text-slate-500">Skills</div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {profileData.skills.map((s) => (
                          <div
                            key={s}
                            className="px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-xs text-slate-200"
                          >
                            {s}
                          </div>
                        ))}
                      </div>
                    </div>

                    {profileData.bio && (
                      <div className="mt-4 rounded-2xl bg-white/5 border border-white/10 p-4">
                        <div className="text-xs text-slate-500">About</div>
                        <div className="mt-2 text-sm text-slate-200 whitespace-pre-wrap">{profileData.bio}</div>
                      </div>
                    )}
                  </motion.div>

                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, delay: 0.08 }}
                    className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl p-5 shadow-[0_8px_32px_rgba(0,0,0,0.35)]"
                  >
                    <div className="flex items-center justify-between gap-4">
                      <div className="min-w-0">
                        <div className="text-lg font-semibold">Account settings</div>
                        <div className="text-sm text-slate-400 mt-1">Manage your account preferences</div>
                      </div>
                      <div className="w-10 h-10 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center">
                        <Shield className="w-5 h-5 text-slate-300" />
                      </div>
                    </div>

                    <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <button
                        type="button"
                        className="text-left rounded-2xl bg-white/5 border border-white/10 p-4 hover:border-white/20 transition-colors"
                        onClick={() => toast.info('Coming soon')}
                      >
                        <div className="text-sm font-semibold text-slate-100">Security</div>
                        <div className="text-xs text-slate-500 mt-1">Password, sessions, MFA</div>
                      </button>
                      <button
                        type="button"
                        className="text-left rounded-2xl bg-white/5 border border-white/10 p-4 hover:border-white/20 transition-colors"
                        onClick={() => toast.info('Coming soon')}
                      >
                        <div className="text-sm font-semibold text-slate-100">Notifications</div>
                        <div className="text-xs text-slate-500 mt-1">Email and product updates</div>
                      </button>
                    </div>
                  </motion.div>
                </div>

                <div className="space-y-6">
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, delay: 0.06 }}
                    className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl p-5 shadow-[0_8px_32px_rgba(0,0,0,0.35)]"
                  >
                    <div className="flex items-center justify-between gap-4">
                      <div className="min-w-0">
                        <div className="text-lg font-semibold">Statistics</div>
                        <div className="text-sm text-slate-400 mt-1">Your recent activity</div>
                      </div>
                      <div className="w-10 h-10 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center">
                        <BarChart3 className="w-5 h-5 text-slate-300" />
                      </div>
                    </div>

                    <div className="mt-4 grid grid-cols-2 gap-3">
                      <div className="rounded-2xl bg-white/5 border border-white/10 p-4">
                        <div className="text-xs text-slate-500">Questions</div>
                        <div className="text-xl font-semibold text-slate-100 mt-1">0</div>
                      </div>
                      <div className="rounded-2xl bg-white/5 border border-white/10 p-4">
                        <div className="text-xs text-slate-500">Mock sessions</div>
                        <div className="text-xl font-semibold text-slate-100 mt-1">0</div>
                      </div>
                      <div className="rounded-2xl bg-white/5 border border-white/10 p-4">
                        <div className="text-xs text-slate-500">Evaluations</div>
                        <div className="text-xl font-semibold text-slate-100 mt-1">0</div>
                      </div>
                      <div className="rounded-2xl bg-white/5 border border-white/10 p-4">
                        <div className="text-xs text-slate-500">Streak</div>
                        <div className="text-xl font-semibold text-slate-100 mt-1">0</div>
                      </div>
                    </div>

                    <button
                      type="button"
                      className="mt-4 w-full flex items-center justify-between px-4 py-3 rounded-2xl bg-white/5 border border-white/10 hover:border-white/20 text-sm text-slate-200"
                      onClick={() => safeNavigate('/dashboard')}
                    >
                      <span>Go to dashboard</span>
                      <ChevronRight className="w-4 h-4 text-slate-400" />
                    </button>
                  </motion.div>
                </div>
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
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 border border-white/10 hover:border-white/20 font-semibold disabled:opacity-60"
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
