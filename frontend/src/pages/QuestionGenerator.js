import { useEffect, useMemo, useRef, useState } from 'react';
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
  Copy,
  Download,
  RefreshCw,
  Bookmark
} from 'lucide-react';
import { EnhancedAnimatedBackground } from '../components/EnhancedAnimatedBackground';
import Navbar from '../components/layout/Navbar';
import Sidebar from '../components/layout/Sidebar';
import Footer from '../components/layout/Footer';
import Modal from '../components/ui/Modal';
import { clerkAPI } from '../services/api';

const ROLE_PRESETS = [
  'Frontend Developer',
  'Backend Developer',
  'Full Stack Developer',
  'Data Engineer',
  'Machine Learning Engineer',
  'DevOps Engineer',
  'QA Engineer'
];

const TOPICS = [
  'Data Structures',
  'Algorithms',
  'System Design',
  'Database',
  'Frontend',
  'Backend',
  'Networking',
  'Operating Systems',
  'Behavioral'
];

function makeMockQuestions({ role, difficulty, topics, count }) {
  const focus = topics.length ? topics.join(', ') : 'General';
  const base = `${difficulty} • ${role || 'Role'} • ${focus}`;

  const items = [];
  for (let i = 0; i < count; i += 1) {
    const n = i + 1;
    items.push({
      id: `${Date.now()}-${i}`,
      title: `Question ${n}`,
      body: `(${base}) Explain the core concepts and trade-offs. Add an example scenario and how you would approach it.`
    });
  }
  return items;
}

const QuestionGenerator = () => {
  const navigate = useNavigate();
  const { user } = useUser();
  const { getToken, isLoaded: authLoaded } = useAuth();
  const { signOut } = useClerk();

  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [dbProfile, setDbProfile] = useState(null);
  const [confirmLogoutOpen, setConfirmLogoutOpen] = useState(false);
  const [logoutLoading, setLogoutLoading] = useState(false);

  const [role, setRole] = useState('');
  const [difficulty, setDifficulty] = useState('Easy');
  const [topics, setTopics] = useState([]);
  const [count, setCount] = useState(10);

  const [loading, setLoading] = useState(false);
  const [questions, setQuestions] = useState([]);
  const [saveEnabled, setSaveEnabled] = useState(false);

  const lastPayloadRef = useRef(null);

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
    (dbProfile && dbProfile.name) ||
    'User';

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

  const toggleTopic = (t) => {
    setTopics((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]));
  };

  const runGenerate = async (payload) => {
    setLoading(true);
    try {
      await new Promise((r) => setTimeout(r, 900));
      const next = makeMockQuestions(payload);
      setQuestions(next);
      toast.success('Questions generated');
    } catch (_) {
      toast.error('Failed to generate questions');
    } finally {
      setLoading(false);
    }
  };

  const onGenerate = async () => {
    const normalizedCount = Number.isFinite(Number(count)) ? Math.max(1, Math.min(50, Number(count))) : 10;
    const payload = { role: role.trim(), difficulty, topics, count: normalizedCount };
    lastPayloadRef.current = payload;
    await runGenerate(payload);
  };

  const onRegenerate = async () => {
    if (!lastPayloadRef.current) {
      toast.info('Generate once first');
      return;
    }
    await runGenerate(lastPayloadRef.current);
  };

  const onCopyAll = async () => {
    if (!questions.length) {
      toast.info('Nothing to copy');
      return;
    }

    const text = questions
      .map((q, idx) => `${idx + 1}. ${q.body}`)
      .join('\n\n');

    try {
      await navigator.clipboard.writeText(text);
      toast.success('Copied to clipboard');
    } catch (_) {
      toast.error('Copy failed');
    }
  };

  const onExportJson = () => {
    if (!questions.length) {
      toast.info('Nothing to export');
      return;
    }

    try {
      const blob = new Blob(
        [JSON.stringify({ generatedAt: new Date().toISOString(), role, difficulty, topics, questions }, null, 2)],
        { type: 'application/json' }
      );
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'devprep-questions.json';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (_) {
      toast.error('Export failed');
    }
  };

  const onExportPdf = () => {
    if (!questions.length) {
      toast.info('Nothing to export');
      return;
    }

    try {
      const win = window.open('', '_blank', 'noopener,noreferrer');
      if (!win) {
        toast.error('Popup blocked');
        return;
      }
      const html = `
        <html>
          <head>
            <title>DevPrep Questions</title>
            <style>
              body { font-family: Arial, sans-serif; padding: 24px; }
              h1 { font-size: 18px; margin: 0 0 8px; }
              .meta { color: #555; margin-bottom: 16px; font-size: 12px; }
              .q { margin: 0 0 14px; }
              .q b { display: inline-block; width: 24px; }
            </style>
          </head>
          <body>
            <h1>DevPrep — Generated Questions</h1>
            <div class="meta">${new Date().toLocaleString()} • ${difficulty} • ${role || 'Role'} • ${(topics.length ? topics.join(', ') : 'General')}</div>
            ${questions
              .map((q, idx) => `<div class="q"><b>${idx + 1}.</b> ${q.body}</div>`)
              .join('')}
            <script>window.onload = () => window.print();</script>
          </body>
        </html>
      `;
      win.document.open();
      win.document.write(html);
      win.document.close();
    } catch (_) {
      toast.error('Export failed');
    }
  };

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

  const avatarUrl = (dbProfile && dbProfile.avatar) || user?.imageUrl || '';

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
              profile={{ name: displayName, avatar: avatarUrl }}
              profilePath="/profile"
            />

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <Navbar
                    brand="DevPrep"
                    activeLabel="Questions"
                    links={navbarLinks}
                    onNavigate={safeNavigate}
                    onOpenMobileSidebar={() => setMobileSidebarOpen(true)}
                    avatarUrl={avatarUrl}
                  />
                </div>
              </div>

              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6 }}
                className="mt-6 relative overflow-hidden rounded-3xl border border-white/10 bg-white/5 backdrop-blur-xl shadow-[0_10px_40px_rgba(0,0,0,0.35)]"
              >
                <div className="p-6 sm:p-7 border-b border-white/10">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="text-2xl font-semibold">Question Generator</div>
                      <div className="text-sm text-slate-400 mt-1">
                        Build practice sets by role, difficulty, and topic.
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={onCopyAll}
                        className="h-10 px-4 rounded-xl bg-white/5 border border-white/10 hover:border-white/20 text-slate-200 inline-flex items-center gap-2"
                      >
                        <Copy className="w-4 h-4" />
                        Copy
                      </button>
                      <button
                        type="button"
                        onClick={onExportJson}
                        className="h-10 px-4 rounded-xl bg-white/5 border border-white/10 hover:border-white/20 text-slate-200 inline-flex items-center gap-2"
                      >
                        <Download className="w-4 h-4" />
                        JSON
                      </button>
                      <button
                        type="button"
                        onClick={onExportPdf}
                        className="h-10 px-4 rounded-xl bg-white/5 border border-white/10 hover:border-white/20 text-slate-200 inline-flex items-center gap-2"
                      >
                        <Download className="w-4 h-4" />
                        PDF
                      </button>
                    </div>
                  </div>
                </div>

                <div className="p-6 sm:p-7 grid grid-cols-1 lg:grid-cols-12 gap-6">
                  <div className="lg:col-span-7">
                    <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
                      <div className="text-sm font-semibold text-slate-200">Settings</div>

                      <div className="mt-4">
                        <label className="block text-xs text-slate-400">Target role</label>
                        <input
                          value={role}
                          onChange={(e) => setRole(e.target.value)}
                          list="role-presets"
                          placeholder="e.g., Frontend Developer"
                          className="mt-2 w-full h-11 px-4 rounded-xl bg-black/20 border border-white/10 text-slate-100 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-violet-500/35"
                        />
                        <datalist id="role-presets">
                          {ROLE_PRESETS.map((r) => (
                            <option key={r} value={r} />
                          ))}
                        </datalist>
                      </div>

                      <div className="mt-4">
                        <label className="block text-xs text-slate-400">Difficulty</label>
                        <div className="mt-2 grid grid-cols-3 gap-2">
                          {['Easy', 'Medium', 'Hard'].map((d) => {
                            const active = difficulty === d;
                            return (
                              <button
                                key={d}
                                type="button"
                                onClick={() => setDifficulty(d)}
                                className={`h-11 rounded-xl border text-sm font-semibold transition-colors ${
                                  active
                                    ? 'bg-violet-600/25 border-violet-400/30 text-slate-100'
                                    : 'bg-white/5 border-white/10 hover:border-white/20 text-slate-300'
                                }`}
                              >
                                {d}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      <div className="mt-4">
                        <label className="block text-xs text-slate-400">Topics</label>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {TOPICS.map((t) => {
                            const active = topics.includes(t);
                            return (
                              <button
                                key={t}
                                type="button"
                                onClick={() => toggleTopic(t)}
                                className={`px-3 h-9 rounded-xl border text-xs transition-colors ${
                                  active
                                    ? 'bg-cyan-600/15 border-cyan-400/30 text-slate-100'
                                    : 'bg-white/5 border-white/10 hover:border-white/20 text-slate-300'
                                }`}
                              >
                                {t}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      <div className="mt-4">
                        <label className="block text-xs text-slate-400">Number of questions</label>
                        <input
                          type="number"
                          min={1}
                          max={50}
                          value={count}
                          onChange={(e) => setCount(e.target.value)}
                          className="mt-2 w-full h-11 px-4 rounded-xl bg-black/20 border border-white/10 text-slate-100 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-violet-500/35"
                        />
                        <div className="text-[11px] text-slate-500 mt-2">Range: 1 to 50</div>
                      </div>

                      <div className="mt-5 pt-4 border-t border-white/10 flex flex-col sm:flex-row sm:items-center  gap-3">
                        <button
                          type="button"
                          onClick={() => setSaveEnabled((v) => !v)}
                          className={`h-11 px-4 rounded-xl border inline-flex items-center justify-center gap-2 text-sm sm:w-auto w-full ${
                            saveEnabled
                              ? 'bg-emerald-600/15 border-emerald-400/30 text-slate-100'
                              : 'bg-white/5 border-white/10 hover:border-white/20 text-slate-300'
                          }`}
                        >
                          <Bookmark className="w-4 h-4" />
                          Save questions
                        </button>

                        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:justify-end w-full sm:w-auto">
                          <button
                            type="button"
                            onClick={onRegenerate}
                            disabled={loading}
                            className="h-11 px-4 rounded-xl bg-white/5 border border-white/10 hover:border-white/20 text-slate-200 inline-flex items-center justify-center gap-2 disabled:opacity-60 w-full sm:w-auto"
                          >
                            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                            Regenerate
                          </button>

                          <button
                            type="button"
                            onClick={onGenerate}
                            disabled={loading}
                            className="h-11 px-5 rounded-xl bg-gradient-to-r from-violet-600/80 to-indigo-600/70 border border-white/10 hover:border-white/20 text-white font-semibold inline-flex items-center justify-center gap-2 disabled:opacity-60 w-full sm:w-auto"
                          >
                            <Sparkles className={`w-4 h-4 ${loading ? 'animate-pulse' : ''}`} />
                            {loading ? 'Generating…' : 'Generate'}
                          </button>
                        </div>
                      </div>

                      
                    </div>
                  </div>

                  <div className="lg:col-span-5">
                    <div className="rounded-2xl border border-white/10 bg-white/5 p-5 min-h-[360px]">
                      <div className="flex items-center justify-between gap-3">
                        <div className="text-sm font-semibold text-slate-200">Generated questions</div>
                        <div className="text-xs text-slate-500">
                          {questions.length ? `${questions.length} items` : 'No questions yet'}
                        </div>
                      </div>

                      <div className="mt-4 grid grid-cols-1 gap-3">
                        {!questions.length && (
                          <div className="rounded-2xl border border-dashed border-white/10 bg-black/10 p-8 text-center text-sm text-slate-400">
                            Choose settings and click Generate.
                          </div>
                        )}

                        {questions.map((q, idx) => (
                          <div
                            key={q.id}
                            className="rounded-2xl border border-white/10 bg-black/10 p-4 hover:border-white/20 transition-colors"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <div className="text-sm font-semibold text-slate-100">
                                  {idx + 1}. {q.title}
                                </div>
                                <div className="text-sm text-slate-300 mt-2 leading-relaxed">{q.body}</div>
                              </div>
                              <button
                                type="button"
                                onClick={async () => {
                                  try {
                                    await navigator.clipboard.writeText(q.body);
                                    toast.success('Copied');
                                  } catch (_) {
                                    toast.error('Copy failed');
                                  }
                                }}
                                className="shrink-0 h-9 px-3 rounded-xl bg-white/5 border border-white/10 hover:border-white/20 text-slate-200 inline-flex items-center gap-2"
                              >
                                <Copy className="w-4 h-4" />
                                Copy
                              </button>
                            </div>

                            {saveEnabled && (
                              <div className="mt-3 text-[11px] text-emerald-300/80">
                                Marked to save (UI only)
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>

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

export default QuestionGenerator;
