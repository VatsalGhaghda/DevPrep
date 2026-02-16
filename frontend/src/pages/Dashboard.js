import { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuth, useUser, useClerk } from '@clerk/clerk-react';
import {
  LayoutDashboard,
  FileUp,
  FileText,
  Code2,
  PlayCircle,
  BookOpen,
  Sparkles,
  ClipboardCheck,
  ChevronRight,
  User
} from 'lucide-react';
import { EnhancedAnimatedBackground } from '../components/EnhancedAnimatedBackground';
import Navbar from '../components/layout/Navbar';
import Sidebar from '../components/layout/Sidebar';
import Footer from '../components/layout/Footer';
import Modal from '../components/ui/Modal';
import { clerkAPI } from '../services/api';

const Dashboard = () => {
  const navigate = useNavigate();
  const { user } = useUser();
  const { getToken, isLoaded: authLoaded } = useAuth();
  const { signOut } = useClerk();
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [confirmLogoutOpen, setConfirmLogoutOpen] = useState(false);
  const [logoutLoading, setLogoutLoading] = useState(false);
  const [dbProfile, setDbProfile] = useState(null);
  const didSyncRef = useRef(false);

  useEffect(() => {
    if (!authLoaded) return;
    if (!user) return;
    if (didSyncRef.current) return;

    didSyncRef.current = true;

    (async () => {
      try {
        const token = await getToken();
        if (!token) return;
        await clerkAPI.syncMe(token);
      } catch (_) {
        // Intentionally ignore: webhooks may still cover this; don't spam users with errors
      }
    })();
  }, [authLoaded, getToken, user]);

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
        // Ignore
      }
    })();
  }, [authLoaded, getToken, user]);

  const displayName =
    user?.fullName ||
    [user?.firstName, user?.lastName].filter(Boolean).join(' ') ||
    user?.username ||
    (dbProfile && dbProfile.name) ||
    'User';

  const knownRoutes = useMemo(() => new Set(['/dashboard', '/profile', '/questions/generate']), []);

  const handleLogout = async () => {
    if (logoutLoading) return;
    setLogoutLoading(true);
    try {
      // Let Clerk handle navigation to avoid double redirects / double loads
      await signOut({ redirectUrl: '/login' });
    } catch (error) {
      toast.error('Failed to logout');
      setLogoutLoading(false);
    }
  };

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

  const modules = [
    {
      title: 'Question Generator',
      desc: 'Create practice sets by topic',
      Icon: Sparkles,
      gradient: 'from-cyan-600/25 to-violet-600/10',
      path: '/questions/generate'
    },
    {
      title: 'Mock Interview',
      desc: 'Start a new interview session',
      Icon: PlayCircle,
      gradient: 'from-violet-600/25 to-indigo-600/10',
      path: '/interview/mock'
    },
    {
      title: 'Answer Evaluation',
      desc: 'Get feedback on your answers',
      Icon: ClipboardCheck,
      gradient: 'from-pink-600/25 to-violet-600/10',
      path: '/evaluate'
    },
    {
      title: 'Resume Upload',
      desc: 'Upload to personalize interviews',
      Icon: FileUp,
      gradient: 'from-indigo-600/25 to-cyan-600/10',
      path: '/resume/upload'
    },
    {
      title: 'Resume-Based Interview',
      desc: 'Interview based on your resume',
      Icon: FileText,
      gradient: 'from-cyan-600/25 to-indigo-600/10',
      path: '/interview/resume'
    },
    {
      title: 'Coding Practice',
      desc: 'DSA, patterns, and solutions',
      Icon: Code2,
      gradient: 'from-violet-600/25 to-cyan-600/10',
      path: '/coding/practice'
    }
  ];

  const actions = [
    {
      title: 'Generate Questions',
      desc: 'AI-curated practice set',
      Icon: Sparkles,
      gradient: 'from-cyan-600/25 to-violet-600/10',
      path: '/questions/generate'
    },
    {
      title: 'Start Mock Interview',
      desc: 'Timed + feedback loop',
      Icon: PlayCircle,
      gradient: 'from-violet-600/25 to-indigo-600/10',
      path: '/interview/mock'
    },
    {
      title: 'Evaluate Answer',
      desc: 'Structure + improvement tips',
      Icon: ClipboardCheck,
      gradient: 'from-pink-600/25 to-violet-600/10',
      path: '/evaluate'
    },
    {
      title: 'Upload Resume',
      desc: 'Resume-based questions',
      Icon: FileUp,
      gradient: 'from-indigo-600/25 to-cyan-600/10',
      path: '/resume/upload'
    },
    {
      title: 'Resume Interview',
      desc: 'Interview from your resume',
      Icon: FileText,
      gradient: 'from-cyan-600/25 to-indigo-600/10',
      path: '/interview/resume'
    },
    {
      title: 'Coding Practice',
      desc: 'DSA + patterns',
      Icon: Code2,
      gradient: 'from-violet-600/25 to-cyan-600/10',
      path: '/coding/practice'
    }
  ];

  const recent = [
    {
      title: 'Completed: Arrays — Two pointers',
      meta: '12 questions • 28m',
      tone: 'border-cyan-500/30 bg-cyan-500/5'
    },
    {
      title: 'Mock interview session saved',
      meta: 'Frontend • React • 35m',
      tone: 'border-violet-500/30 bg-violet-500/5'
    },
    {
      title: 'Answer evaluation generated',
      meta: 'Behavioral • STAR format',
      tone: 'border-pink-500/30 bg-pink-500/5'
    }
  ];

  const today = [
    { label: 'Generate: 10 questions (DSA basics)', Icon: Sparkles },
    { label: 'Mock interview: 1 session', Icon: PlayCircle },
    { label: 'Upload resume for resume interview', Icon: FileUp },
    { label: 'Evaluate 1 answer to improve structure', Icon: ClipboardCheck },
    { label: 'Coding practice: 20 min patterns', Icon: BookOpen }
  ];

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
              profile={{ 
                name: displayName,
                avatar: (dbProfile && dbProfile.avatar) || user?.imageUrl || ''
              }}
              profilePath="/profile"
            />

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <Navbar
                    brand="DevPrep"
                    activeLabel="Dashboard"
                    links={navbarLinks}
                    onNavigate={safeNavigate}
                    onOpenMobileSidebar={() => setMobileSidebarOpen(true)}
                    avatarUrl={(dbProfile && dbProfile.avatar) || user?.imageUrl || ''}
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
                  <div className="min-w-0">
                    <div className="text-sm text-slate-300">Welcome back</div>
                    <div className="text-2xl sm:text-3xl font-semibold mt-1 truncate">
                      {displayName}
                    </div>
                    <div className="text-sm text-slate-400 mt-2">
                      Pick up where you left off — or start a new session.
                    </div>
                  </div>

                  <div className="sm:ml-auto flex items-center gap-3">
                    <motion.button
                      type="button"
                      whileHover={{ y: -1 }}
                      whileTap={{ scale: 0.98 }}
                      className="px-4 py-2 rounded-2xl bg-gradient-to-r from-violet-600 to-indigo-600 border border-white/10 hover:border-white/20 font-semibold"
                      onClick={() => safeNavigate('/questions/generate')}
                    >
                      Generate questions
                    </motion.button>
                    <motion.button
                      type="button"
                      whileHover={{ y: -1 }}
                      whileTap={{ scale: 0.98 }}
                      className="px-4 py-2 rounded-2xl bg-white/5 border border-white/10 hover:border-white/20 text-slate-200"
                      onClick={() => safeNavigate('/interview/mock')}
                    >
                      Start mock
                    </motion.button>
                  </div>
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.05 }}
                className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-6"
              >
                <div className="lg:col-span-2 space-y-6">
                  <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl p-5 shadow-[0_8px_32px_rgba(0,0,0,0.35)]">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-lg font-semibold">Modules</div>
                        <div className="text-sm text-slate-400 mt-1">Access key parts of the app from one place</div>
                      </div>
                    </div>

                    <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {modules.map(({ title, desc, Icon, gradient, path }, i) => (
                        <motion.button
                          key={title}
                          type="button"
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.5, delay: 0.08 + i * 0.05 }}
                          whileHover={{ scale: 1.01, y: -2 }}
                          whileTap={{ scale: 0.99 }}
                          className="text-left relative overflow-hidden rounded-2xl p-4 bg-white/5 border border-white/10 hover:border-white/20 shadow-[0_10px_30px_rgba(0,0,0,0.25)]"
                          onClick={() => {
                            safeNavigate(path);
                          }}
                        >
                          <div className={`absolute inset-0 bg-gradient-to-br ${gradient}`} />
                          <div className="absolute inset-0 opacity-0 hover:opacity-100 transition-opacity duration-300 bg-white/5" />
                          <div className="relative flex items-start gap-3">
                            <div className="w-11 h-11 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center">
                              <Icon className="w-5 h-5 text-white" />
                            </div>
                            <div className="min-w-0">
                              <div className="font-semibold">{title}</div>
                              <div className="text-sm text-slate-400 mt-1">{desc}</div>
                              <div className="text-xs text-slate-500 mt-2">{path}</div>
                            </div>
                            <div className="ml-auto pt-1 text-slate-300">
                              <ChevronRight className="w-4 h-4" />
                            </div>
                          </div>
                        </motion.button>
                      ))}
                    </div>
                  </div>

                  <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl p-5 shadow-[0_8px_32px_rgba(0,0,0,0.35)]">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-lg font-semibold">Quick Actions</div>
                        <div className="text-sm text-slate-400 mt-1">Jump back in with your next best step</div>
                      </div>
                      <button type="button" className="text-sm text-cyan-300 hover:text-cyan-200 flex items-center gap-1">
                        View all
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {actions.map(({ title, desc, Icon, gradient, path }, i) => (
                        <motion.button
                          key={title}
                          type="button"
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.5, delay: 0.18 + i * 0.06 }}
                          whileHover={{ scale: 1.01, y: -2 }}
                          whileTap={{ scale: 0.99 }}
                          className="text-left relative overflow-hidden rounded-2xl p-4 bg-white/5 border border-white/10 hover:border-white/20 shadow-[0_10px_30px_rgba(0,0,0,0.25)]"
                          onClick={() => {
                            safeNavigate(path);
                          }}
                        >
                          <div className={`absolute inset-0 bg-gradient-to-br ${gradient}`} />
                          <div className="absolute inset-0 opacity-0 hover:opacity-100 transition-opacity duration-300 bg-white/5" />
                          <div className="relative flex items-start gap-3">
                            <div className="w-11 h-11 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center">
                              <Icon className="w-5 h-5 text-white" />
                            </div>
                            <div className="min-w-0">
                              <div className="font-semibold">{title}</div>
                              <div className="text-sm text-slate-400 mt-1">{desc}</div>
                            </div>
                          </div>
                        </motion.button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="lg:col-span-1 space-y-6">
                  <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl p-5 shadow-[0_8px_32px_rgba(0,0,0,0.35)]">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-lg font-semibold">Today</div>
                        <div className="text-sm text-slate-400 mt-1">Your focused plan</div>
                      </div>
                      <div className="text-xs text-slate-500">{today.length} items</div>
                    </div>

                    <div className="mt-4 space-y-3">
                      {today.map(({ label, Icon }) => (
                        <motion.div
                          key={label}
                          initial={{ opacity: 0, x: 6 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ duration: 0.35 }}
                          whileHover={{ x: 2 }}
                          className="flex items-center gap-3 rounded-xl bg-white/5 border border-white/10 hover:border-white/20 px-3 py-2"
                        >
                          <div className="w-9 h-9 rounded-lg bg-gradient-to-r from-violet-600/25 to-indigo-600/10 border border-white/10 flex items-center justify-center">
                            <Icon className="w-4 h-4 text-violet-200" />
                          </div>
                          <div className="text-sm text-slate-200">{label}</div>
                        </motion.div>
                      ))}
                    </div>
                  </div>

                  <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl p-5 shadow-[0_8px_32px_rgba(0,0,0,0.35)]">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-lg font-semibold">Recent Activity</div>
                        <div className="text-sm text-slate-400 mt-1">Last saved items</div>
                      </div>
                    </div>

                    <div className="mt-4 space-y-3">
                      {recent.map((item) => (
                        <div
                          key={item.title}
                          className={`rounded-2xl border px-4 py-3 ${item.tone}`}
                        >
                          <div className="text-sm font-medium text-slate-100">{item.title}</div>
                          <div className="text-xs text-slate-400 mt-1">{item.meta}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </motion.div>

              <Footer onNavigate={safeNavigate} />
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
            >
              Cancel
            </button>
            <button
              type="button"
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 border border-white/10 hover:border-white/20 font-semibold"
              onClick={handleLogout}
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

export default Dashboard;
