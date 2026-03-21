import { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useAuth, useClerk, useUser } from '@clerk/clerk-react';
import { toast } from 'sonner';
import jsPDF from 'jspdf';
import {
  LayoutDashboard,
  FileUp,
  FileText,
  Code2,
  PlayCircle,
  Sparkles,
  ClipboardCheck,
  User,
  Bookmark,
  ChevronDown
} from 'lucide-react';
import { EnhancedAnimatedBackground } from '../components/EnhancedAnimatedBackground';
import Navbar from '../components/layout/Navbar';
import Sidebar from '../components/layout/Sidebar';
import Footer from '../components/layout/Footer';
import Modal from '../components/ui/Modal';
import { clerkAPI, questionsAPI } from '../services/api';

const ROLE_PRESETS = [
  'Frontend Developer',
  'Backend Developer',
  'Full Stack Developer',
  'Data Engineer',
  'Machine Learning Engineer',
  'DevOps Engineer',
  'QA Engineer'
];

function downloadQuestionsPdf({ role, difficulty, topics, questions }) {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const marginX = 40;
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const maxWidth = pageWidth - marginX * 2;

  let y = 48;
  const lineGap = 14;

  const addLine = (text, { fontSize = 11, bold = false, gap = lineGap } = {}) => {
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
    doc.setFontSize(fontSize);
    const lines = doc.splitTextToSize(String(text || ''), maxWidth);
    for (const ln of lines) {
      if (y > pageHeight - 48) {
        doc.addPage();
        y = 48;
      }
      doc.text(ln, marginX, y);
      y += gap;
    }
  };

  addLine('DevPrep — Saved Questions', { fontSize: 16, bold: true, gap: 20 });
  addLine(`Role: ${role || '-'}`, { bold: true });
  addLine(`Difficulty: ${difficulty || '-'}`);
  addLine(`Topic: ${(Array.isArray(topics) && topics[0]) || '-'}`);
  addLine(`Total: ${Array.isArray(questions) ? questions.length : 0}`, { gap: 20 });

  const items = Array.isArray(questions) ? questions : [];
  items.forEach((q, idx) => {
    addLine(`${idx + 1}. ${q.text || ''}`, { bold: true, gap: 16 });
    const opts = Array.isArray(q.options) ? q.options : [];
    opts.slice(0, 4).forEach((opt, i) => {
      addLine(`${String.fromCharCode(65 + i)}. ${opt}`, { gap: 14 });
    });
    const correctIdx = Number.isInteger(q.correctIndex) ? q.correctIndex : 0;
    const correctLetter = String.fromCharCode(65 + Math.max(0, Math.min(3, correctIdx)));
    addLine(`Correct: ${correctLetter}`, { gap: 14 });
    if (q.explanation) {
      addLine(`Explanation: ${q.explanation}`, { gap: 16 });
    } else {
      y += 10;
    }
    y += 8;
  });

  const safeRole = String(role || 'role').trim().replace(/[^a-z0-9-_]+/gi, '_');
  const safeTopic = String((Array.isArray(topics) && topics[0]) || 'topic').trim().replace(/[^a-z0-9-_]+/gi, '_');
  const safeDiff = String(difficulty || 'difficulty').trim().replace(/[^a-z0-9-_]+/gi, '_');
  const filename = `devprep_${safeRole}_${safeTopic}_${safeDiff}.pdf`;
  doc.save(filename);
}

const TOPICS_BY_ROLE = {
  'Frontend Developer': ['Frontend', 'JavaScript', 'React', 'HTML/CSS', 'Networking', 'Behavioral'],
  'Backend Developer': ['Backend', 'System Design', 'Database', 'Networking', 'Operating Systems', 'Behavioral'],
  'Full Stack Developer': ['Frontend', 'Backend', 'System Design', 'Database', 'Networking', 'Behavioral'],
  'Data Engineer': ['Database', 'System Design', 'Data Structures', 'Algorithms', 'Networking', 'Behavioral'],
  'Machine Learning Engineer': ['Algorithms', 'Data Structures', 'System Design', 'Database', 'Behavioral'],
  'DevOps Engineer': ['Networking', 'Operating Systems', 'System Design', 'Backend', 'Behavioral'],
  'QA Engineer': ['Frontend', 'Backend', 'System Design', 'Behavioral']
};

const FALLBACK_TOPICS = [
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

function normalizeGeneratedQuestions(items) {
  if (!Array.isArray(items)) return [];
  return items
    .map((q, i) => {
      const text = q && typeof q.text === 'string' ? q.text.trim() : '';
      const options = q && Array.isArray(q.options) ? q.options.filter((o) => typeof o === 'string' && o.trim()) : [];
      const correctIndex = q && Number.isInteger(q.correctIndex) ? q.correctIndex : 0;
      const topic = q && typeof q.topic === 'string' ? q.topic.trim() : '';
      const explanation = q && typeof q.explanation === 'string' ? q.explanation.trim() : '';

      const normalizedOptions = options.map((o) => o.trim()).slice(0, 4);
      if (!text || normalizedOptions.length !== 4) return null;

      return {
        id: `${Date.now()}-${i}`,
        text,
        options: normalizedOptions,
        correctIndex: correctIndex >= 0 && correctIndex <= 3 ? correctIndex : 0,
        topic,
        explanation
      };
    })
    .filter(Boolean);
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
  const [difficulty, setDifficulty] = useState('');
  const [topics, setTopics] = useState([]);
  const [count, setCount] = useState(null);

  const [roleDropdownOpen, setRoleDropdownOpen] = useState(false);
  const roleDropdownRef = useRef(null);

  const [loading, setLoading] = useState(false);
  const [questions, setQuestions] = useState([]);
  const [saveEnabled, setSaveEnabled] = useState(false);
  const [saving, setSaving] = useState(false);

  const [quizIndex, setQuizIndex] = useState(0);
  const [quizAnswers, setQuizAnswers] = useState([]);
  const [quizDone, setQuizDone] = useState(false);
  const [mode, setMode] = useState('settings');
  const [secondsLeft, setSecondsLeft] = useState(null);

  const knownRoutes = useMemo(
    () => new Set(['/dashboard', '/profile', '/profile/edit', '/questions/generate', '/interview/mock']),
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
    setTopics((prev) => (prev[0] === t ? [] : [t]));
  };

  const availableTopics = useMemo(() => {
    const key = String(role || '').trim();
    const exact = TOPICS_BY_ROLE[key];
    if (Array.isArray(exact) && exact.length) return exact;
    return FALLBACK_TOPICS;
  }, [role]);

  useEffect(() => {
    setTopics((prev) => prev.filter((t) => availableTopics.includes(t)));
  }, [availableTopics]);

  const totalSeconds = useMemo(() => {
    const c = Number(count);
    if (![10, 15, 20].includes(c)) return null;
    const perQuestion =
      difficulty === 'Easy' ? 30 :
      difficulty === 'Medium' ? 45 :
      difficulty === 'Hard' ? 60 :
      null;
    if (!perQuestion) return null;
    return c * perQuestion;
  }, [count, difficulty]);

  useEffect(() => {
    if (mode !== 'quiz') return;
    if (!Number.isFinite(secondsLeft)) return;
    if (secondsLeft <= 0) return;

    const t = setInterval(() => {
      setSecondsLeft((prev) => {
        const next = Number(prev) - 1;
        if (next <= 0) return 0;
        return next;
      });
    }, 1000);

    return () => clearInterval(t);
  }, [mode, secondsLeft]);

  useEffect(() => {
    if (mode !== 'quiz') return;
    if (secondsLeft === 0 && questions.length && !quizDone) {
      setQuizDone(true);
      setMode('submitted');
      toast.info("Time's up — quiz submitted");
    }
  }, [mode, secondsLeft, questions.length, quizDone]);

  const formatTime = (s) => {
    if (!Number.isFinite(s)) return '--:--';
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  };

  const runGenerate = async (payload) => {
    setLoading(true);
    try {
      if (!authLoaded) {
        toast.info('Loading session… try again');
        return;
      }
      const token = await getToken();
      if (!token) {
        toast.error('Not authenticated');
        return;
      }

      const res = await questionsAPI.generate(token, payload);
      const normalized = normalizeGeneratedQuestions(res.data?.questions || []);

      if (!normalized.length) {
        throw new Error('No questions returned');
      }

      setQuestions(normalized);
      setQuizIndex(0);
      setQuizAnswers(Array.from({ length: normalized.length }).fill(null));
      setQuizDone(false);
      setMode('quiz');
      setSecondsLeft(totalSeconds || normalized.length * 45);
      toast.success('Questions generated');
    } catch (err) {
      const status = err?.response?.status;
      const msg =
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        err?.message ||
        'Failed to generate quiz';
      toast.error(status ? `${msg} (${status})` : msg);
    } finally {
      setLoading(false);
    }
  };

  const onSaveQuestions = async () => {
    if (saving) return;
    if (!questions.length) {
      toast.info('Generate questions first');
      return;
    }

    setSaving(true);
    try {
      if (!authLoaded) {
        toast.info('Loading session… try again');
        return;
      }
      const token = await getToken();
      if (!token) {
        toast.error('Not authenticated');
        return;
      }

      const payload = {
        role: String(role || '').trim(),
        difficulty: String(difficulty || '').trim(),
        topics,
        questions
      };

      const res = await questionsAPI.save(token, payload);
      const saved = Number(res.data?.saved) || 0;
      const skipped = Number(res.data?.skipped) || 0;
      toast.success(`Saved ${saved} question(s)${skipped ? ` • Skipped ${skipped}` : ''}`);
      setSaveEnabled(true);

      try {
        downloadQuestionsPdf({ role: payload.role, difficulty: payload.difficulty, topics: payload.topics, questions: payload.questions });
      } catch (_) {
        toast.error('Saved, but failed to generate PDF');
      }
    } catch (err) {
      const status = err?.response?.status;
      const msg =
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        err?.message ||
        'Failed to save questions';
      toast.error(status ? `${msg} (${status})` : msg);
    } finally {
      setSaving(false);
    }
  };

  const onGenerate = async () => {
    const allowedCounts = new Set([10, 15, 20]);
    const requested = Number(count);
    const normalizedCount = allowedCounts.has(requested) ? requested : 10;
    const payload = { role: role.trim(), difficulty, topics, count: normalizedCount };
    await runGenerate(payload);
  };

  const canGenerate =
    Boolean(String(role || '').trim()) &&
    Boolean(String(difficulty || '').trim()) &&
    Array.isArray(topics) &&
    topics.length === 1 &&
    [10, 15, 20].includes(Number(count));

  const onExitQuiz = () => {
    setMode('settings');
    setQuizDone(false);
    setQuizIndex(0);
    setQuizAnswers([]);
    setQuestions([]);
    setSecondsLeft(null);
  };

  useEffect(() => {
    if (!roleDropdownOpen) return;
    const onDocMouseDown = (e) => {
      if (!roleDropdownRef.current) return;
      if (roleDropdownRef.current.contains(e.target)) return;
      setRoleDropdownOpen(false);
    };
    document.addEventListener('mousedown', onDocMouseDown);
    return () => document.removeEventListener('mousedown', onDocMouseDown);
  }, [roleDropdownOpen]);

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
                {mode === 'settings' ? (
                  <div className="p-6 sm:p-7">
                    <div className="mx-auto w-full max-w-4xl">
                      <div className="rounded-2xl border border-white/10 bg-white/5 p-6 sm:p-7">
                        <div className="text-sm font-semibold text-slate-200">Settings</div>

                        <div className="mt-4">
                          <label className="block text-xs text-slate-400">Target role</label>
                          <div className="mt-2 relative" ref={roleDropdownRef}>
                            <button
                              type="button"
                              onClick={() => setRoleDropdownOpen((v) => !v)}
                              className="w-full h-11 px-4 rounded-xl bg-black/20 border border-white/10 hover:border-white/20 text-slate-100 inline-flex items-center justify-between gap-3 focus:outline-none focus:ring-2 focus:ring-violet-500/35"
                            >
                              <span className={role ? 'text-slate-100' : 'text-slate-400'}>
                                {role || 'Select a role'}
                              </span>
                              <ChevronDown className={`w-4 h-4 text-slate-300 transition-transform ${roleDropdownOpen ? 'rotate-180' : ''}`} />
                            </button>
                            {roleDropdownOpen && (
                              <div className="absolute z-20 mt-2 w-full rounded-2xl border border-white/10 bg-[#0b1220]/95 backdrop-blur-xl shadow-[0_10px_40px_rgba(0,0,0,0.55)] overflow-hidden">
                                <div className="max-h-64 overflow-auto py-2">
                                  {ROLE_PRESETS.map((r) => {
                                    const active = r === role;
                                    return (
                                      <button
                                        key={r}
                                        type="button"
                                        onClick={() => {
                                          setRole(r);
                                          setRoleDropdownOpen(false);
                                        }}
                                        className={`w-full text-left px-4 py-2 text-sm transition-colors ${
                                          active
                                            ? 'bg-violet-600/20 text-slate-100'
                                            : 'text-slate-200 hover:bg-white/5'
                                        }`}
                                      >
                                        {r}
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>
                            )}
                          </div>
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
                          <label className="block text-xs text-slate-400">Topics (select one)</label>
                          <div className="mt-2 flex flex-wrap gap-2">
                            {availableTopics.map((t) => {
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
                          <div className="mt-2 grid grid-cols-3 gap-2">
                            {[10, 15, 20].map((n) => {
                              const active = Number(count) === n;
                              return (
                                <button
                                  key={n}
                                  type="button"
                                  onClick={() => setCount(n)}
                                  className={`h-11 rounded-xl border text-sm font-semibold transition-colors ${
                                    active
                                      ? 'bg-violet-600/25 border-violet-400/30 text-slate-100'
                                      : 'bg-white/5 border-white/10 hover:border-white/20 text-slate-300'
                                  }`}
                                >
                                  {n}
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        <div className="mt-6 pt-5 border-t border-white/10 flex flex-col sm:flex-row sm:items-center gap-3">
                          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:justify-end w-full sm:w-auto">
                            <button
                              type="button"
                              onClick={onGenerate}
                              disabled={loading || !canGenerate}
                              className="h-11 px-5 rounded-xl bg-gradient-to-r from-violet-600/80 to-indigo-600/70 border border-white/10 hover:border-white/20 text-white font-semibold inline-flex items-center justify-center gap-2 disabled:opacity-60 w-full sm:w-auto"
                            >
                              <Sparkles className={`w-4 h-4 ${loading ? 'animate-pulse' : ''}`} />
                              {loading ? 'Generating…' : 'Generate'}
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="p-6 sm:p-7">
                    <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                        <div>
                          <div className="text-lg font-semibold text-slate-100">Quiz</div>
                          <div className="text-xs text-slate-400 mt-1">
                            {role || 'Role'} • {difficulty} • {topics.length ? topics[0] : 'Topic'} • {questions.length} questions
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="px-3 h-10 rounded-xl bg-black/20 border border-white/10 inline-flex items-center text-sm text-slate-200">
                            Time: <span className="ml-2 font-semibold">{formatTime(secondsLeft)}</span>
                          </div>
                          <button
                            type="button"
                            onClick={onExitQuiz}
                            className="h-10 px-4 rounded-xl bg-white/5 border border-white/10 hover:border-white/20 text-slate-200"
                          >
                            Exit
                          </button>
                        </div>
                      </div>

                      <div className="mt-5">
                        {!questions.length && (
                          <div className="rounded-2xl border border-dashed border-white/10 bg-black/10 p-8 text-center text-sm text-slate-400">
                            No quiz yet.
                          </div>
                        )}

                        {!!questions.length && !quizDone && (() => {
                          const q = questions[quizIndex];
                          const selected = quizAnswers[quizIndex];
                          return (
                            <div className="rounded-2xl border border-white/10 bg-black/10 p-5">
                              <div className="flex items-center justify-between gap-3">
                                <div className="text-xs text-slate-500">{q.topic || 'General'}</div>
                                <div className="text-xs text-slate-500">
                                  {quizIndex + 1} / {questions.length}
                                </div>
                              </div>
                              <div className="text-base font-semibold text-slate-100 mt-3 leading-relaxed">{q.text}</div>

                              <div className="mt-5 grid grid-cols-1 gap-2">
                                {q.options.map((opt, i) => {
                                  const active = selected === i;
                                  return (
                                    <button
                                      key={`${q.id}-${i}`}
                                      type="button"
                                      onClick={() => {
                                        setQuizAnswers((prev) => {
                                          const next = [...prev];
                                          next[quizIndex] = i;
                                          return next;
                                        });
                                      }}
                                      className={`px-4 py-3 rounded-xl border text-left text-sm transition-colors ${
                                        active
                                          ? 'bg-cyan-600/15 border-cyan-400/30 text-slate-100'
                                          : 'bg-white/5 border-white/10 hover:border-white/20 text-slate-300'
                                      }`}
                                    >
                                      <span className="font-semibold mr-2">{String.fromCharCode(65 + i)}.</span>
                                      {opt}
                                    </button>
                                  );
                                })}
                              </div>

                              <div className="mt-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                <button
                                  type="button"
                                  onClick={() => setQuizIndex((v) => Math.max(0, v - 1))}
                                  disabled={quizIndex === 0}
                                  className="h-11 px-5 rounded-xl bg-white/5 border border-white/10 hover:border-white/20 text-slate-200 disabled:opacity-60"
                                >
                                  Previous
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (quizIndex + 1 >= questions.length) {
                                      setQuizDone(true);
                                      setMode('submitted');
                                      return;
                                    }
                                    setQuizIndex((v) => Math.min(questions.length - 1, v + 1));
                                  }}
                                  disabled={selected === null || selected === undefined}
                                  className="h-11 px-6 rounded-xl bg-gradient-to-r from-violet-600/80 to-indigo-600/70 border border-white/10 hover:border-white/20 text-white font-semibold disabled:opacity-60"
                                >
                                  {quizIndex + 1 >= questions.length ? 'Submit' : 'Next'}
                                </button>
                              </div>
                            </div>
                          );
                        })()}

                        {!!questions.length && quizDone && (() => {
                          const total = questions.length;
                          const answered = quizAnswers.filter((a) => a !== null && a !== undefined).length;
                          const correct = questions.reduce(
                            (acc, q, i) => acc + (quizAnswers[i] === q.correctIndex ? 1 : 0),
                            0
                          );
                          return (
                            <div className="rounded-2xl border border-white/10 bg-black/10 p-6">
                              <div className="text-lg font-semibold text-slate-100">Quiz submitted</div>
                              <div className="text-sm text-slate-300 mt-2">
                                Score: <span className="font-semibold">{correct}</span> / {total} • Answered: {answered} / {total}
                              </div>

                              <div className="mt-5 flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setQuizIndex(0);
                                    setMode('review');
                                  }}
                                  className="h-11 px-5 rounded-xl bg-white/5 border border-white/10 hover:border-white/20 text-slate-200"
                                >
                                  Get review
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setQuizAnswers(Array.from({ length: questions.length }).fill(null));
                                    setQuizIndex(0);
                                    setQuizDone(false);
                                    setMode('quiz');
                                    setSecondsLeft(totalSeconds || questions.length * 45);
                                  }}
                                  className="h-11 px-5 rounded-xl bg-gradient-to-r from-violet-600/80 to-indigo-600/70 border border-white/10 hover:border-white/20 text-white font-semibold"
                                >
                                  Retake
                                </button>
                                <button
                                  type="button"
                                  onClick={onSaveQuestions}
                                  disabled={saving || !questions.length}
                                  className={`h-11 px-5 rounded-xl border inline-flex items-center justify-center gap-2 font-semibold disabled:opacity-60 ${
                                    saveEnabled
                                      ? 'bg-emerald-600/15 border-emerald-400/30 text-slate-100'
                                      : 'bg-white/5 border-white/10 hover:border-white/20 text-slate-200'
                                  }`}
                                >
                                  <Bookmark className="w-4 h-4" />
                                  {saving ? 'Saving…' : 'Save questions'}
                                </button>
                              </div>

                              {mode === 'review' && (
                                <div className="mt-6 rounded-2xl border border-white/10 bg-black/10 p-5">
                                  {(() => {
                                    const q = questions[quizIndex];
                                    const selected = quizAnswers[quizIndex];
                                    return (
                                      <>
                                        <div className="flex items-center justify-between gap-3">
                                          <div className="text-xs text-slate-500">{q.topic || 'General'}</div>
                                          <div className="text-xs text-slate-500">
                                            {quizIndex + 1} / {questions.length}
                                          </div>
                                        </div>
                                        <div className="text-base font-semibold text-slate-100 mt-3 leading-relaxed">
                                          {q.text}
                                        </div>
                                        <div className="mt-5 grid grid-cols-1 gap-2">
                                          {q.options.map((opt, i) => {
                                            const isCorrect = i === q.correctIndex;
                                            const isSelected = selected === i;
                                            const isWrongSelected = isSelected && !isCorrect;
                                            const cls = isCorrect
                                              ? 'bg-emerald-600/15 border-emerald-400/40 text-slate-100'
                                              : isWrongSelected
                                                ? 'bg-rose-600/15 border-rose-400/40 text-slate-100'
                                                : 'bg-white/5 border-white/10 text-slate-300';
                                            return (
                                              <div
                                                key={`${q.id}-review-${i}`}
                                                className={`px-4 py-3 rounded-xl border text-left text-sm ${cls}`}
                                              >
                                                <span className="font-semibold mr-2">{String.fromCharCode(65 + i)}.</span>
                                                {opt}
                                              </div>
                                            );
                                          })}
                                        </div>
                                        {q.explanation && (
                                          <div className="mt-4 text-sm text-slate-300">{q.explanation}</div>
                                        )}
                                        <div className="mt-6 flex items-center justify-between gap-3">
                                          <button
                                            type="button"
                                            onClick={() => setQuizIndex((v) => Math.max(0, v - 1))}
                                            disabled={quizIndex === 0}
                                            className="h-10 px-4 rounded-xl bg-white/5 border border-white/10 hover:border-white/20 text-slate-200 disabled:opacity-60"
                                          >
                                            Previous
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => setQuizIndex((v) => Math.min(questions.length - 1, v + 1))}
                                            disabled={quizIndex >= questions.length - 1}
                                            className="h-10 px-4 rounded-xl bg-white/5 border border-white/10 hover:border-white/20 text-slate-200 disabled:opacity-60"
                                          >
                                            Next
                                          </button>
                                        </div>
                                      </>
                                    );
                                  })()}
                                </div>
                              )}
                            </div>
                          );
                        })()}
                      </div>
                    </div>
                  </div>
                )}
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
