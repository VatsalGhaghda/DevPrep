import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import {
  LayoutDashboard,
  FileUp,
  FileText,
  Code2,
  PlayCircle,
  BookOpen,
  Sparkles,
  ClipboardCheck,
  ChevronRight
} from 'lucide-react';
import { EnhancedAnimatedBackground } from '../components/EnhancedAnimatedBackground';
import Navbar from '../components/layout/Navbar';
import Sidebar from '../components/layout/Sidebar';
import Footer from '../components/layout/Footer';
import Modal from '../components/ui/Modal';
import LoadingSpinner, { FullPageLoader } from '../components/ui/LoadingSpinner';

const Dashboard = () => {
  const navigate = useNavigate();
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [confirmLogoutOpen, setConfirmLogoutOpen] = useState(false);
  const [buttonLoading, setButtonLoading] = useState(false);
  const [fullPageLoading, setFullPageLoading] = useState(false);

  const knownRoutes = useMemo(() => new Set(['/dashboard']), []);

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

  if (fullPageLoading) {
    return <FullPageLoader label="Loading dashboard..." />;
  }

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
              profile={{ name: 'User', subtitle: 'DevPrep' }}
            />

            <div className="flex-1 min-w-0">
              <Navbar
                brand="DevPrep"
                activeLabel="Dashboard"
                links={navbarLinks}
                onNavigate={safeNavigate}
                onOpenMobileSidebar={() => setMobileSidebarOpen(true)}
              />

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
                          whileHover={{ scale: 1.01 }}
                          whileTap={{ scale: 0.99 }}
                          className="text-left relative overflow-hidden rounded-2xl p-4 bg-white/5 border border-white/10 hover:border-white/20"
                          onClick={() => {
                            safeNavigate(path);
                          }}
                        >
                          <div className={`absolute inset-0 bg-gradient-to-br ${gradient}`} />
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
                          whileHover={{ scale: 1.01 }}
                          whileTap={{ scale: 0.99 }}
                          className="text-left relative overflow-hidden rounded-2xl p-4 bg-white/5 border border-white/10 hover:border-white/20"
                          onClick={() => {
                            safeNavigate(path);
                          }}
                        >
                          <div className={`absolute inset-0 bg-gradient-to-br ${gradient}`} />
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
                        <div
                          key={label}
                          className="flex items-center gap-3 rounded-xl bg-white/5 border border-white/10 px-3 py-2"
                        >
                          <div className="w-9 h-9 rounded-lg bg-gradient-to-r from-violet-600/25 to-indigo-600/10 border border-white/10 flex items-center justify-center">
                            <Icon className="w-4 h-4 text-violet-200" />
                          </div>
                          <div className="text-sm text-slate-200">{label}</div>
                        </div>
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

                  <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl p-5 shadow-[0_8px_32px_rgba(0,0,0,0.35)]">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-lg font-semibold">System UI</div>
                        <div className="text-sm text-slate-400 mt-1">Toasts, modal, and loading states</div>
                      </div>
                    </div>

                    <div className="mt-4 grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        className="px-3 py-2 rounded-xl bg-white/5 border border-white/10 hover:border-white/20 text-sm text-slate-200"
                        onClick={() => toast.success('Success toast')}
                      >
                        Success
                      </button>
                      <button
                        type="button"
                        className="px-3 py-2 rounded-xl bg-white/5 border border-white/10 hover:border-white/20 text-sm text-slate-200"
                        onClick={() => toast.error('Error toast')}
                      >
                        Error
                      </button>
                      <button
                        type="button"
                        className="px-3 py-2 rounded-xl bg-white/5 border border-white/10 hover:border-white/20 text-sm text-slate-200"
                        onClick={() => toast.warning('Warning toast')}
                      >
                        Warning
                      </button>
                      <button
                        type="button"
                        className="px-3 py-2 rounded-xl bg-white/5 border border-white/10 hover:border-white/20 text-sm text-slate-200"
                        onClick={() => toast.info('Info toast')}
                      >
                        Info
                      </button>
                    </div>

                    <div className="mt-3 grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        className="px-3 py-2 rounded-xl bg-gradient-to-r from-violet-600/30 to-indigo-600/20 border border-white/10 hover:border-white/20 text-sm font-semibold"
                        onClick={() => setConfirmLogoutOpen(true)}
                      >
                        Open Modal
                      </button>
                      <button
                        type="button"
                        className="px-3 py-2 rounded-xl bg-white/5 border border-white/10 hover:border-white/20 text-sm font-semibold flex items-center justify-center gap-2"
                        onClick={() => {
                          if (buttonLoading) return;
                          setButtonLoading(true);
                          window.setTimeout(() => {
                            setButtonLoading(false);
                            toast.success('Done');
                          }, 900);
                        }}
                      >
                        {buttonLoading ? (
                          <>
                            <LoadingSpinner size={16} />
                            Loading
                          </>
                        ) : (
                          'Button Loading'
                        )}
                      </button>
                    </div>

                    <button
                      type="button"
                      className="mt-3 w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 hover:border-white/20 text-sm text-slate-200"
                      onClick={() => setFullPageLoading(true)}
                    >
                      Show Full-page Loader
                    </button>
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
        title="Confirm action"
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
              onClick={() => {
                setConfirmLogoutOpen(false);
                toast.success('Confirmed');
              }}
            >
              Confirm
            </button>
          </div>
        }
      >
        This is a reusable modal component. Use it for confirmations and form dialogs.
      </Modal>
    </div>
  );
};

export default Dashboard;
