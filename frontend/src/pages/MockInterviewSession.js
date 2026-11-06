import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate, useParams } from 'react-router-dom';
import { useClerk, useUser } from '@clerk/clerk-react';
import { useReadyAuth } from '../hooks/useReadyAuth';
import { toast } from 'sonner';
import {
  LayoutDashboard,
  FileText,
  Code2,
  PlayCircle,
  Brain,
  User as UserIcon,
  Send,
  Square,
  Clock,
  MessageSquare,
  ArrowLeft,
  Trophy,
  TrendingUp,
  TrendingDown,
  Lightbulb,
  Target,
  Bot,
  ChevronRight
} from 'lucide-react';
import { EnhancedAnimatedBackground } from '../components/EnhancedAnimatedBackground';
import Navbar from '../components/layout/Navbar';
import Sidebar from '../components/layout/Sidebar';
import Modal from '../components/ui/Modal';
import AssessmentGate from '../components/assessment/AssessmentGate';
import ViolationOverlay from '../components/assessment/ViolationOverlay';
import ProctorBadge from '../components/assessment/ProctorBadge';
import { useSecureAssessment, securityFromDoc } from '../hooks/useSecureAssessment';
import { useSpeechSynthesis } from '../hooks/useSpeechSynthesis';
import { useSpeechToText } from '../hooks/useSpeechToText';
import { useMediaDevices } from '../hooks/useMediaDevices';
import DeviceCheck from '../components/assessment/DeviceCheck';
import SelfView from '../components/assessment/SelfView';
import {
  VoiceModeToggle,
  MicButton,
  SpeechPlaybackControls,
  MessageSpeakButton,
  RecordingStatus
} from '../components/interview/VoiceControls';
import { clerkAPI, mockInterviewAPI } from '../services/api';
import { SIDEBAR_ITEMS, NAVBAR_LINKS } from '../config/navigation';

const VOICE_MODE_KEY = 'devprep.voice.mode';

// Interviewer messages always come from the server and carry an _id
const messageKey = (m, i) => m._id || `${i}-${m.timestamp || ''}`;

function readVoiceMode() {
  try { return localStorage.getItem(VOICE_MODE_KEY) === 'true'; } catch (_) { return false; }
}

const MockInterviewSession = () => {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const { user } = useUser();
  const { ready, getToken } = useReadyAuth();
  const { signOut } = useClerk();

  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => localStorage.getItem("sidebarCollapsed") === "true");
  const [dbProfile, setDbProfile] = useState(null);
  const [confirmLogoutOpen, setConfirmLogoutOpen] = useState(false);
  const [logoutLoading, setLogoutLoading] = useState(false);

  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [messageInput, setMessageInput] = useState('');
  const [sending, setSending] = useState(false);
  const [endModalOpen, setEndModalOpen] = useState(false);
  const [ending, setEnding] = useState(false);
  const [timeLeft, setTimeLeft] = useState(null);

  const chatEndRef = useRef(null);
  const inputRef = useRef(null);

  const safeNavigate = (path) => {
    if (path === '/logout') { setConfirmLogoutOpen(true); return; }
    navigate(path);
  };

  const handleLogout = async () => {
    if (logoutLoading) return;
    setLogoutLoading(true);
    try { await signOut({ redirectUrl: '/login' }); }
    catch (_) { toast.error('Failed to logout'); setLogoutLoading(false); }
  };

  const displayName =
    user?.fullName ||
    [user?.firstName, user?.lastName].filter(Boolean).join(' ') ||
    user?.username ||
    (dbProfile && dbProfile.name) || 'User';

  const sidebarItems = SIDEBAR_ITEMS;

  const navbarLinks = NAVBAR_LINKS;

  const avatarUrl = (dbProfile && dbProfile.avatar) || user?.imageUrl || '';
  const isActive = session?.status === 'active';
  // Created but not begun: the device check runs, no question exists yet and the clock is stopped
  const isReady = session?.status === 'ready';
  const isCompleted = session?.status === 'completed';

  // Fetch profile
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

  // Fetch session
  const fetchSession = useCallback(async () => {
    if (!ready || !sessionId) return;
    try {
      const token = await getToken();
      if (!token) { setError('Not authenticated'); setLoading(false); return; }
      const res = await mockInterviewAPI.getSession(token, sessionId);
      setSession(res.data?.session || null);
      setError('');
    } catch (err) {
      const msg = err?.response?.data?.message || err?.message || 'Failed to load session';
      setError(msg);
    }
    setLoading(false);
  }, [ready, sessionId, getToken]);

  useEffect(() => { fetchSession(); }, [fetchSession]);

  /* ── secure assessment ── */
  const sessionSecurity = useMemo(
    () => securityFromDoc(session),
    // Only the security fields matter; the session object changes on every message
    [session?.securityPolicy, session?.violationCount, session?.flagged, session?.terminationReason]
  );
  const isTerminated = session?.terminationReason === 'violations';

  const reportViolation = useCallback(async (type, details) => {
    const token = await getToken();
    const res = await mockInterviewAPI.logViolation(token, sessionId, { type, details });
    return res.data;
  }, [getToken, sessionId]);

  const secure = useSecureAssessment({
    enabled: isActive || isReady,
    security: sessionSecurity,
    report: reportViolation,
    onTerminated: fetchSession
  });

  const endInterviewRef = useRef(null);

  /* ── begin: the first question is generated only after Start is pressed ── */
  const [beginning, setBeginning] = useState(false);
  const [beginError, setBeginError] = useState('');
  const beginInterview = useCallback(async () => {
    setBeginning(true);
    setBeginError('');
    try {
      const token = await getToken();
      if (!token) throw new Error('Not authenticated');
      const res = await mockInterviewAPI.begin(token, sessionId);
      setSession(res.data?.session || null);
    } catch (err) {
      const msg = err?.response?.data?.message || err?.message || 'Failed to start the interview';
      if (err?.response?.data?.session) setSession(err.response.data.session);
      setBeginError(msg);
      toast.error(msg);
    } finally {
      setBeginning(false);
    }
  }, [getToken, sessionId]);

  /* ── voice mode ── */
  const speechLang = useMemo(() => {
    const l = (typeof navigator !== 'undefined' && navigator.language) || 'en-US';
    return /^en\b/i.test(l) ? l : 'en-US';
  }, []);
  const [voiceMode, setVoiceModeState] = useState(readVoiceMode);
  const tts = useSpeechSynthesis({ lang: speechLang });
  const { speak, stop: stopSpeaking, muted: ttsMuted } = tts;

  const appendTranscript = useCallback((text) => {
    setMessageInput((prev) => {
      const head = prev.replace(/\s+$/, '');
      return head ? `${head} ${text}` : text;
    });
  }, []);

  const transcribeRecording = useCallback(async (blob) => {
    const token = await getToken();
    if (!token) throw new Error('Not authenticated');
    const ext = blob.type.includes('mp4') ? 'mp4' : blob.type.includes('ogg') ? 'ogg' : 'webm';
    const form = new FormData();
    form.append('audio', blob, `answer.${ext}`);
    form.append('language', speechLang.slice(0, 2));
    const res = await mockInterviewAPI.transcribe(token, sessionId, form);
    return res.data?.text || '';
  }, [getToken, sessionId, speechLang]);

  /* ── devices: opened in the pre-interview check, kept for the whole interview ── */
  const devices = useMediaDevices();
  const [devicesReady, setDevicesReady] = useState(false);
  const devicesStreamRef = useRef(null);
  devicesStreamRef.current = devices.stream;
  const getDeviceStream = useCallback(() => devicesStreamRef.current, []);
  const { release: releaseDevices } = devices;

  const stt = useSpeechToText({
    lang: speechLang,
    onFinal: appendTranscript,
    transcribe: transcribeRecording,
    getStream: getDeviceStream,
    // Once proctoring runs, never open a new permission prompt from the mic button
    allowPrompt: !secure.running
  });
  const { start: startRecognition, stop: stopListening, listening, processing: transcribing } = stt;

  const latestQuestion = useMemo(() => {
    const msgs = session?.messages || [];
    for (let i = msgs.length - 1; i >= 0; i -= 1) {
      if (msgs[i].role === 'interviewer') {
        return { key: messageKey(msgs[i], i), content: msgs[i].content, isLast: i === msgs.length - 1 };
      }
    }
    return null;
  }, [session?.messages]);

  const setVoiceMode = (on) => {
    setVoiceModeState(on);
    try { localStorage.setItem(VOICE_MODE_KEY, String(on)); } catch (_) { /* ignore */ }
    if (!on) {
      stopListening();
      stopSpeaking();
      return;
    }
    // Read out the question that is waiting for an answer
    if (isActive && latestQuestion?.isLast && !ttsMuted) {
      speak(latestQuestion.content, latestQuestion.key);
    }
  };

  const startListening = () => {
    stopSpeaking(); // never record the interviewer's own voice
    startRecognition();
  };

  const playLatestQuestion = () => {
    if (!latestQuestion) return;
    if (ttsMuted) tts.setMuted(false);
    speak(latestQuestion.content, latestQuestion.key);
  };

  // Speak each new interviewer message once, in voice mode. Messages that were
  // already on screen when the page loaded are not replayed, except the
  // question still waiting for an answer.
  const spokenRef = useRef(null);
  useEffect(() => {
    const msgs = session?.messages;
    if (!msgs) return;
    const keys = [];
    msgs.forEach((m, i) => { if (m.role === 'interviewer') keys.push(messageKey(m, i)); });

    if (spokenRef.current === null) {
      const last = msgs[msgs.length - 1];
      const pending = last && last.role === 'interviewer' ? messageKey(last, msgs.length - 1) : null;
      spokenRef.current = new Set(keys.filter((k) => k !== pending));
    }

    const unspoken = keys.filter((k) => !spokenRef.current.has(k));
    if (unspoken.length === 0) return;
    // Wait until the proctoring gate is passed: its click also lets the browser play audio
    if (voiceMode && isActive && secure.needsGate) return;

    unspoken.forEach((k) => spokenRef.current.add(k));
    if (!voiceMode || ttsMuted || !isActive || listening) return;
    const newestKey = unspoken[unspoken.length - 1];
    const idx = msgs.findIndex((m, i) => messageKey(m, i) === newestKey);
    if (idx >= 0) speak(msgs[idx].content, newestKey);
  }, [session?.messages, voiceMode, ttsMuted, isActive, secure.needsGate, listening, speak]);

  // Stop the microphone and turn the camera off when the interview ends
  // (a session that hasn't begun yet keeps them: the device check is using them)
  const hasEnded = Boolean(session) && !isActive && !isReady;
  useEffect(() => {
    if (hasEnded) {
      stopListening();
      releaseDevices();
    }
  }, [hasEnded, stopListening, releaseDevices]);

  const deviceProblem = secure.running && [devices.camera, devices.microphone]
    .find((d) => ['disconnected', 'denied', 'unavailable', 'in_use', 'error'].includes(d.status));

  // Keep the answer box sized to its text (also after a transcript is added)
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 120) + 'px';
  }, [messageInput]);

  // Timer
  useEffect(() => {
    if (!session || session.status !== 'active') return;

    const startedAt = new Date(session.startedAt).getTime();
    const durationMs = (session.duration || 30) * 60 * 1000;
    const endTime = startedAt + durationMs;

    const update = () => {
      const remaining = Math.max(0, Math.floor((endTime - Date.now()) / 1000));
      setTimeLeft(remaining);
      return remaining;
    };

    const remaining = update();
    if (remaining <= 0) {
      if (endInterviewRef.current) endInterviewRef.current('completed');
      return;
    }

    const interval = setInterval(() => {
      const r = update();
      if (r <= 0) {
        clearInterval(interval);
        if (endInterviewRef.current) endInterviewRef.current('completed');
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [session?.startedAt, session?.duration, session?.status]);

  // Auto-scroll
  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [session?.messages?.length, sending]);

  const formatTime = (s) => {
    if (s == null || !Number.isFinite(s)) return '--:--';
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  };

  const handleSendMessage = async () => {
    if (sending || !messageInput.trim() || !isActive) return;
    // Wait for the transcript to finish so no late words are lost
    if (listening || transcribing) return;
    stopSpeaking();
    setSending(true);
    const content = messageInput.trim();
    setMessageInput('');

    // Optimistic update: add user message immediately
    setSession((prev) => ({
      ...prev,
      messages: [...(prev?.messages || []), { role: 'user', content, timestamp: new Date().toISOString(), _id: 'temp-' + Date.now() }]
    }));

    try {
      const token = await getToken();
      if (!token) throw new Error('Not authenticated');
      const res = await mockInterviewAPI.sendMessage(token, sessionId, content);
      setSession(res.data?.session || null);
    } catch (err) {
      const msg = err?.response?.data?.message || err?.message || 'Failed to send message';
      toast.error(msg);
      // Revert optimistic update
      await fetchSession();
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleEndInterview = async (status = 'completed') => {
    if (ending) return;
    setEnding(true);
    setEndModalOpen(false);
    secure.release();
    try {
      const token = await getToken();
      if (!token) throw new Error('Not authenticated');
      const res = await mockInterviewAPI.endSession(token, sessionId, status);
      const ended = res.data?.session || null;
      setSession(ended);
      if (ended?.evaluationStatus === 'failed') {
        toast.error('Interview ended, but the evaluation could not be generated. You can retry it below.');
      } else if (status === 'completed') {
        toast.success('Interview ended — evaluation ready!');
      } else {
        toast.success('Interview ended');
      }
    } catch (err) {
      const msg = err?.response?.data?.message || err?.message || 'Failed to end interview';
      toast.error(msg);
    } finally {
      setEnding(false);
    }
  };
  endInterviewRef.current = handleEndInterview;

  const [retryingEvaluation, setRetryingEvaluation] = useState(false);
  const handleRetryEvaluation = async () => {
    if (retryingEvaluation) return;
    setRetryingEvaluation(true);
    try {
      const token = await getToken();
      if (!token) throw new Error('Not authenticated');
      const res = await mockInterviewAPI.retryEvaluation(token, sessionId);
      setSession(res.data?.session || null);
      toast.success('Evaluation ready!');
    } catch (err) {
      const msg = err?.response?.data?.message || err?.message || 'Evaluation failed';
      toast.error(msg);
    } finally {
      setRetryingEvaluation(false);
    }
  };

  // Auto-complete interview when final message is received
  useEffect(() => {
    if (!session || session.status !== 'active') return;

    const msgs = session.messages || [];
    if (msgs.length === 0) return;

    const lastMsg = msgs[msgs.length - 1];
    if (lastMsg.role === 'interviewer' && lastMsg.content.toLowerCase().includes('concludes our interview')) {
      const timer = setTimeout(() => {
        if (endInterviewRef.current) {
          endInterviewRef.current('completed');
        }
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [session?.messages, session?.status]);

  const messages = session?.messages || [];
  const evaluation = session?.evaluation;
  const interviewerMsgCount = messages.filter((m) => m.role === 'interviewer').length;

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-[#0f172a] via-[#030712] to-[#020617] text-white overflow-x-hidden relative">
      <EnhancedAnimatedBackground />

      <div className="relative z-10 min-h-screen p-4 lg:p-8">
        <div className="mx-auto w-full max-w-[1600px]">
          <div className="flex gap-5">
            {/* Navigation is hidden while a proctored interview is running */}
            {!secure.running && (
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
            )}

            <div className="flex-1 min-w-0 flex flex-col">
              {!secure.running && (
                <div className="flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <Navbar
                      brand=""
                      activeLabel="Mock Interview"
                      links={navbarLinks}
                      onNavigate={safeNavigate}
                      onOpenMobileSidebar={() => setMobileSidebarOpen(true)}
                      avatarUrl={avatarUrl}
                      onLogout={() => setConfirmLogoutOpen(true)}
                    />
                  </div>
                </div>
              )}

              {/* Loading state */}
              {loading && (
                <div className="mt-6 flex-1 flex items-center justify-center">
                  <div className="text-center">
                    <div className="w-10 h-10 rounded-full border-2 border-violet-400 border-t-transparent animate-spin mx-auto" />
                    <p className="text-sm text-slate-400 mt-3">Loading interview session…</p>
                  </div>
                </div>
              )}

              {/* Error state */}
              {!loading && error && (
                <div className="mt-6 rounded-3xl border border-rose-500/20 bg-rose-600/10 backdrop-blur-xl p-8 text-center">
                  <p className="text-sm text-rose-300">{error}</p>
                  <button
                    type="button"
                    onClick={() => navigate('/interview/mock')}
                    className="mt-4 h-10 px-5 rounded-xl bg-white/5 border border-white/10 hover:border-white/20 text-slate-200 inline-flex items-center gap-2"
                  >
                    <ArrowLeft className="w-4 h-4" /> Back to Setup
                  </button>
                </div>
              )}

              {/* Main session UI */}
              {!loading && !error && session && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5 }}
                  className="mt-6 flex-1 flex flex-col"
                >
                  {/* Session header */}
                  <div className="rounded-2xl border border-white/10 bg-[#1e1e2d]/60 backdrop-blur-xl p-4 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      {!secure.running && (
                        <button
                          type="button"
                          onClick={() => navigate('/interview/mock')}
                          className="w-9 h-9 rounded-xl bg-white/5 border border-white/10 hover:border-white/20 flex items-center justify-center"
                        >
                          <ArrowLeft className="w-4 h-4 text-slate-300" />
                        </button>
                      )}
                      <div>
                        <div className="text-sm font-semibold text-slate-100 capitalize">
                          {session.interviewType} Interview • {session.role}
                        </div>
                        <div className="text-xs text-slate-400 capitalize mt-0.5">
                          {session.difficulty} • {session.duration} min
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {isActive && (
                        <>
                          <VoiceModeToggle voiceMode={voiceMode} onChange={setVoiceMode} disabled={ending} />

                          <ProctorBadge security={secure.security} />

                          {/* Timer */}
                          <div className={`px-3 h-9 rounded-xl border inline-flex items-center gap-2 text-sm font-medium ${
                            timeLeft != null && timeLeft < 60
                              ? 'bg-rose-600/15 border-rose-400/30 text-rose-300 animate-pulse'
                              : timeLeft != null && timeLeft < 300
                                ? 'bg-amber-600/15 border-amber-400/30 text-amber-300'
                                : 'bg-black/20 border-white/10 text-slate-200'
                          }`}>
                            <Clock className="w-4 h-4" />
                            {formatTime(timeLeft)}
                          </div>

                          {/* Question counter */}
                          <div className="px-3 h-9 rounded-xl bg-black/20 border border-white/10 inline-flex items-center gap-2 text-sm text-slate-200">
                            <MessageSquare className="w-4 h-4" />
                            Q{interviewerMsgCount}
                          </div>

                          {/* End button */}
                          <button
                            type="button"
                            onClick={() => setEndModalOpen(true)}
                            disabled={ending}
                            className="h-9 px-4 rounded-xl bg-rose-600/80 hover:bg-rose-600 border border-rose-500/30 text-white text-sm font-semibold inline-flex items-center gap-2 transition-colors disabled:opacity-50"
                          >
                            <Square className="w-3.5 h-3.5" />
                            End
                          </button>
                        </>
                      )}

                      {hasEnded && (
                        <div className={`px-3 h-9 rounded-xl border inline-flex items-center text-sm font-semibold capitalize ${
                          isCompleted
                            ? 'bg-emerald-600/15 border-emerald-400/30 text-emerald-300'
                            : isTerminated
                              ? 'bg-rose-600/15 border-rose-400/30 text-rose-300'
                              : 'bg-slate-600/15 border-slate-400/30 text-slate-300'
                        }`}>
                          {isTerminated ? 'Terminated' : session.status}
                        </div>
                      )}
                    </div>
                  </div>

                  {deviceProblem && (
                    <div className="mt-3 rounded-2xl border border-rose-400/30 bg-rose-600/10 p-3 flex flex-wrap items-center gap-3">
                      <span className="flex-1 text-sm text-rose-100">{deviceProblem.message || 'A device stopped working.'}</span>
                      <button
                        type="button"
                        onClick={devices.request}
                        disabled={devices.requesting}
                        className="h-9 px-4 rounded-xl bg-white/10 border border-white/15 hover:bg-white/15 text-sm text-slate-100 disabled:opacity-50"
                      >
                        {devices.requesting ? 'Reconnecting…' : 'Reconnect devices'}
                      </button>
                    </div>
                  )}

                  {/* Chat area */}
                  <div className="mt-3 flex-1 rounded-2xl border border-white/10 bg-[#1e1e2d]/40 backdrop-blur-xl flex flex-col" style={{ minHeight: '400px', maxHeight: 'calc(100vh - 320px)' }}>
                    {/* Messages */}
                    <div className="flex-1 overflow-y-auto p-4 space-y-4">
                      {messages.map((msg, i) => (
                        <motion.div
                          key={msg._id || i}
                          initial={{ opacity: 0, y: 6 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.3, delay: i < 3 ? i * 0.1 : 0 }}
                          className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                        >
                          <div className={`max-w-[80%] sm:max-w-[70%] rounded-2xl px-4 py-3 ${
                            msg.role === 'user'
                              ? 'bg-gradient-to-br from-violet-600/30 to-indigo-600/20 border border-violet-400/20 text-slate-100'
                              : 'bg-white/5 border border-white/10 text-slate-200'
                          }`}>
                            {msg.role === 'interviewer' && (
                              <div className="flex items-center gap-1.5 mb-1.5">
                                <Bot className="w-3.5 h-3.5 text-cyan-400" />
                                <span className="text-xs font-semibold text-cyan-400">Interviewer</span>
                                {tts.supported && (
                                  <MessageSpeakButton
                                    active={tts.currentId === messageKey(msg, i) && tts.status !== 'idle'}
                                    onPlay={() => speak(msg.content, messageKey(msg, i))}
                                    onStop={stopSpeaking}
                                  />
                                )}
                              </div>
                            )}
                            <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                            <div className="text-xs text-slate-500 mt-1.5 text-right">
                              {msg.timestamp ? new Date(msg.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : ''}
                            </div>
                          </div>
                        </motion.div>
                      ))}

                      {/* Typing indicator */}
                      {isReady && (
                        <div className="min-h-[320px] h-full flex items-center justify-center text-center p-6">
                          {beginning ? (
                            <div>
                              <div className="w-10 h-10 rounded-full border-2 border-violet-400 border-t-transparent animate-spin mx-auto" />
                              <p className="text-sm text-slate-200 mt-3">Starting your interview…</p>
                              <p className="text-xs text-slate-400 mt-1">The interviewer is preparing the first question. The timer starts when it appears.</p>
                            </div>
                          ) : (
                            <div className="max-w-md">
                              <PlayCircle className="w-10 h-10 text-violet-400 mx-auto" />
                              <p className="text-base font-semibold text-slate-100 mt-3">Your interview is ready</p>
                              <p className={`text-sm mt-1 ${beginError ? 'text-rose-300' : 'text-slate-400'}`}>
                                {beginError || (secure.needsGate
                                  ? 'Finish the device check to begin.'
                                  : 'The first question appears and the timer starts when you press Start interview.')}
                              </p>
                              {!secure.needsGate && (
                                <div className="mt-4 flex flex-wrap justify-center gap-2">
                                  <button
                                    type="button"
                                    onClick={beginInterview}
                                    className="h-10 px-5 rounded-xl bg-violet-600 hover:bg-violet-700 border border-violet-500 text-white text-sm font-semibold"
                                  >
                                    {beginError ? 'Try again' : 'Start interview'}
                                  </button>
                                  {secure.running && (
                                    <button
                                      type="button"
                                      onClick={() => handleEndInterview('abandoned')}
                                      disabled={ending}
                                      className="h-10 px-5 rounded-xl bg-white/5 border border-white/10 hover:border-white/20 text-sm text-slate-200 disabled:opacity-50"
                                    >
                                      Cancel interview
                                    </button>
                                  )}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )}

                      {sending && (
                        <motion.div
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          className="flex justify-start"
                        >
                          <div className="bg-white/5 border border-white/10 rounded-2xl px-4 py-3">
                            <div className="flex items-center gap-1.5 mb-2">
                              <Bot className="w-3.5 h-3.5 text-cyan-400" />
                              <span className="text-xs font-semibold text-cyan-400">Interviewer</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                              <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                              <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                            </div>
                          </div>
                        </motion.div>
                      )}

                      <div ref={chatEndRef} />
                    </div>

                    {/* Input area */}
                    {isActive && (
                      <div className="border-t border-white/10 p-3">
                        {voiceMode && (
                          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                            {tts.supported ? (
                              <SpeechPlaybackControls
                                tts={tts}
                                onPlayLatest={playLatestQuestion}
                                hasQuestion={Boolean(latestQuestion)}
                              />
                            ) : (
                              <span className="text-xs text-slate-500">This browser can't read questions aloud.</span>
                            )}
                            {stt.supported && (
                              <span className="text-xs text-slate-500">
                                {stt.livePreview ? 'Live preview while you speak' : 'Transcribed when you stop recording'}
                              </span>
                            )}
                          </div>
                        )}
                        <div className="flex items-end gap-2">
                          {voiceMode && (
                            <MicButton
                              listening={listening}
                              processing={transcribing}
                              level={stt.level}
                              disabled={sending || !stt.supported}
                              onStart={startListening}
                              onStop={stopListening}
                            />
                          )}
                          <textarea
                            ref={inputRef}
                            rows={1}
                            value={messageInput}
                            onChange={(e) => {
                              setMessageInput(e.target.value);
                              // Auto-resize
                              e.target.style.height = 'auto';
                              e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
                            }}
                            onKeyDown={handleKeyDown}
                            placeholder={voiceMode
                              ? 'Tap the mic and speak. Your answer appears here to review and edit before sending…'
                              : 'Type your answer…'}
                            disabled={sending}
                            className="flex-1 bg-black/20 border border-white/10 focus:border-violet-400/30 rounded-xl px-4 py-3 text-sm text-slate-100 placeholder-slate-500 resize-none focus:outline-none focus:ring-2 focus:ring-violet-500/20 disabled:opacity-50 transition-colors"
                            style={{ minHeight: '44px', maxHeight: '120px' }}
                          />
                          <button
                            type="button"
                            onClick={handleSendMessage}
                            disabled={sending || !messageInput.trim() || listening || transcribing}
                            title={listening ? 'Stop recording first, then review and send' : 'Send answer'}
                            className="h-11 w-11 rounded-xl bg-violet-600 hover:bg-violet-700 border border-violet-500 flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 shadow-[0_0_20px_rgba(139,92,246,0.2)] hover:shadow-[0_0_30px_rgba(139,92,246,0.35)] flex-shrink-0"
                          >
                            <Send className="w-4 h-4 text-white" />
                          </button>
                        </div>
                        {voiceMode && (
                          <div className="mt-2 min-h-[1.25rem] text-xs" aria-live="polite">
                            {stt.error ? (
                              <div className="flex items-start gap-2 text-rose-300">
                                <span className="flex-1">{stt.error}</span>
                                <button type="button" onClick={stt.clearError} className="text-slate-400 hover:text-slate-200 underline">
                                  Dismiss
                                </button>
                              </div>
                            ) : listening ? (
                              <RecordingStatus stt={stt} />
                            ) : transcribing ? (
                              <span className="text-violet-300 inline-flex items-center gap-2">
                                <span className="w-3 h-3 rounded-full border-2 border-violet-300 border-t-transparent animate-spin" />
                                Transcribing your answer… it will appear in the box above for you to review.
                              </span>
                            ) : stt.notice ? (
                              <span className="text-amber-300">{stt.notice}</span>
                            ) : tts.error === 'blocked' ? (
                              <span className="text-amber-300">Your browser blocked automatic audio. Press play to hear the question.</span>
                            ) : !stt.supported ? (
                              <span className="text-slate-500">Voice input isn't available in this browser. You can still listen to the questions and type your answers.</span>
                            ) : (
                              <span className="text-slate-500">Tap the mic, speak your answer, then review the text and press Send.</span>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Read-only notice for completed sessions */}
                    {hasEnded && !evaluation && (
                      <div className="border-t border-white/10 p-3">
                        <div className={`text-center text-xs py-2 ${isTerminated ? 'text-rose-300' : 'text-slate-500'}`}>
                          {isTerminated
                            ? `This interview was terminated after ${session.violationCount} assessment violations. No evaluation was generated. The transcript is read-only.`
                            : session.evaluationStatus === 'failed'
                              ? 'The AI evaluation could not be generated for this interview.'
                              : 'This interview session has ended. The transcript is read-only.'}
                        </div>
                        {!isTerminated && session.status === 'completed' && session.evaluationStatus === 'failed' && (
                          <div className="flex justify-center pb-2">
                            <button
                              type="button"
                              onClick={handleRetryEvaluation}
                              disabled={retryingEvaluation}
                              className="h-9 px-5 rounded-xl bg-violet-600 hover:bg-violet-700 border border-violet-500 text-white text-sm font-semibold disabled:opacity-50"
                            >
                              {retryingEvaluation ? 'Generating evaluation…' : 'Retry evaluation'}
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Evaluation section (shown after interview ends) */}
                  {evaluation && (
                    <motion.div
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.6 }}
                      className="mt-4 rounded-2xl border border-white/10 bg-[#1e1e2d]/60 backdrop-blur-xl p-6"
                    >
                      <div className="flex items-center gap-2 mb-5">
                        <Trophy className="w-5 h-5 text-amber-400" />
                        <h2 className="text-lg font-bold text-slate-100">Interview Evaluation</h2>
                      </div>

                      {/* Score */}
                      <div className="flex items-center justify-center mb-6">
                        <div className="relative w-32 h-32">
                          <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                            <circle cx="50" cy="50" r="42" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="8" />
                            <circle
                              cx="50" cy="50" r="42" fill="none"
                              stroke={evaluation.overallScore >= 70 ? '#34d399' : evaluation.overallScore >= 40 ? '#fbbf24' : '#f87171'}
                              strokeWidth="8"
                              strokeLinecap="round"
                              strokeDasharray={`${(evaluation.overallScore / 100) * 264} 264`}
                            />
                          </svg>
                          <div className="absolute inset-0 flex flex-col items-center justify-center">
                            <span className="text-3xl font-bold text-slate-100">{evaluation.overallScore}</span>
                            <span className="text-xs text-slate-400">/ 100</span>
                          </div>
                        </div>
                      </div>

                      {/* Summary */}
                      {evaluation.summary && (
                        <div className="rounded-xl bg-black/20 border border-white/10 p-4 mb-4">
                          <p className="text-sm text-slate-300 leading-relaxed">{evaluation.summary}</p>
                        </div>
                      )}

                      {/* Strengths & Weaknesses */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                        {evaluation.strengths?.length > 0 && (
                          <div className="rounded-xl bg-emerald-600/5 border border-emerald-400/15 p-4">
                            <div className="flex items-center gap-2 mb-3">
                              <TrendingUp className="w-4 h-4 text-emerald-400" />
                              <span className="text-sm font-semibold text-emerald-300">Strengths</span>
                            </div>
                            <ul className="space-y-2">
                              {evaluation.strengths.map((s, i) => (
                                <li key={i} className="text-sm text-slate-300 flex items-start gap-2">
                                  <ChevronRight className="w-3.5 h-3.5 mt-0.5 text-emerald-400 flex-shrink-0" />
                                  {s}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {evaluation.weaknesses?.length > 0 && (
                          <div className="rounded-xl bg-rose-600/5 border border-rose-400/15 p-4">
                            <div className="flex items-center gap-2 mb-3">
                              <TrendingDown className="w-4 h-4 text-rose-400" />
                              <span className="text-sm font-semibold text-rose-300">Areas to Improve</span>
                            </div>
                            <ul className="space-y-2">
                              {evaluation.weaknesses.map((w, i) => (
                                <li key={i} className="text-sm text-slate-300 flex items-start gap-2">
                                  <ChevronRight className="w-3.5 h-3.5 mt-0.5 text-rose-400 flex-shrink-0" />
                                  {w}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>

                      {/* Topic Feedback */}
                      {evaluation.topicFeedback?.length > 0 && (
                        <div className="rounded-xl bg-black/10 border border-white/10 p-4 mb-4">
                          <div className="flex items-center gap-2 mb-3">
                            <Target className="w-4 h-4 text-cyan-400" />
                            <span className="text-sm font-semibold text-slate-200">Topic-wise Feedback</span>
                          </div>
                          <div className="space-y-3">
                            {evaluation.topicFeedback.map((tf, i) => (
                              <div key={i} className="flex items-start gap-3">
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center justify-between gap-2 mb-1">
                                    <span className="text-sm font-medium text-slate-200">{tf.topic}</span>
                                    <span className={`text-xs font-semibold ${
                                      tf.score >= 70 ? 'text-emerald-400' : tf.score >= 40 ? 'text-amber-400' : 'text-rose-400'
                                    }`}>{tf.score}/100</span>
                                  </div>
                                  <div className="w-full h-1.5 rounded-full bg-white/5 overflow-hidden">
                                    <div
                                      className={`h-full rounded-full ${
                                        tf.score >= 70 ? 'bg-emerald-400' : tf.score >= 40 ? 'bg-amber-400' : 'bg-rose-400'
                                      }`}
                                      style={{ width: `${tf.score}%` }}
                                    />
                                  </div>
                                  {tf.comments && <p className="text-xs text-slate-400 mt-1">{tf.comments}</p>}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Communication & Technical */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                        {evaluation.communicationFeedback && (
                          <div className="rounded-xl bg-black/10 border border-white/10 p-4">
                            <span className="text-xs font-semibold text-violet-400 uppercase tracking-wide">Communication</span>
                            <p className="text-sm text-slate-300 mt-2 leading-relaxed">{evaluation.communicationFeedback}</p>
                          </div>
                        )}
                        {evaluation.technicalDepthFeedback && (
                          <div className="rounded-xl bg-black/10 border border-white/10 p-4">
                            <span className="text-xs font-semibold text-cyan-400 uppercase tracking-wide">Technical Depth</span>
                            <p className="text-sm text-slate-300 mt-2 leading-relaxed">{evaluation.technicalDepthFeedback}</p>
                          </div>
                        )}
                      </div>

                      {/* Improvement Tips */}
                      {evaluation.improvementTips?.length > 0 && (
                        <div className="rounded-xl bg-amber-600/5 border border-amber-400/15 p-4 mb-4">
                          <div className="flex items-center gap-2 mb-3">
                            <Lightbulb className="w-4 h-4 text-amber-400" />
                            <span className="text-sm font-semibold text-amber-300">Improvement Tips</span>
                          </div>
                          <ul className="space-y-2">
                            {evaluation.improvementTips.map((tip, i) => (
                              <li key={i} className="text-sm text-slate-300 flex items-start gap-2">
                                <ChevronRight className="w-3.5 h-3.5 mt-0.5 text-amber-400 flex-shrink-0" />
                                {tip}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Recommended Next Steps */}
                      {evaluation.recommendedNextSteps?.length > 0 && (
                        <div className="rounded-xl bg-violet-600/5 border border-violet-400/15 p-4">
                          <div className="flex items-center gap-2 mb-3">
                            <Target className="w-4 h-4 text-violet-400" />
                            <span className="text-sm font-semibold text-violet-300">Recommended Next Steps</span>
                          </div>
                          <ul className="space-y-2">
                            {evaluation.recommendedNextSteps.map((step, i) => (
                              <li key={i} className="text-sm text-slate-300 flex items-start gap-2">
                                <ChevronRight className="w-3.5 h-3.5 mt-0.5 text-violet-400 flex-shrink-0" />
                                {step}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Back button */}
                      <div className="mt-6 pt-4 border-t border-white/10">
                        <button
                          type="button"
                          onClick={() => navigate('/interview/mock')}
                          className="h-11 px-8 rounded-xl bg-violet-600 hover:bg-violet-700 border border-violet-500 text-white font-semibold inline-flex items-center gap-2 transition-all duration-300 shadow-[0_0_20px_rgba(139,92,246,0.2)] hover:shadow-[0_0_30px_rgba(139,92,246,0.35)]"
                        >
                          <PlayCircle className="w-4 h-4" />
                          Start New Interview
                        </button>
                      </div>
                    </motion.div>
                  )}
                </motion.div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Camera self-view while the proctored interview runs */}
      {secure.running && devices.stream && devices.camera.status === 'granted' && (
        <SelfView stream={devices.stream} />
      )}

      <AssessmentGate
        open={!loading && !error && secure.needsGate}
        startDisabled={!devicesReady}
        startHint="Finish the device check to start."
        title="Proctored Interview"
        subtitle={session ? `${session.interviewType} interview • ${session.role} • ${session.duration} min` : ''}
        security={secure.security}
        startLabel="Start Interview"
        starting={beginning}
        onStart={async () => {
          // Fullscreen must be requested inside the click, so arm first; the
          // interview itself (first question, timer, voice) begins only now.
          await secure.arm();
          await beginInterview();
        }}
        onCancel={() => navigate('/interview/mock')}
        cancelLabel="Back to Setup"
      >
        <DeviceCheck devices={devices} onReadyChange={setDevicesReady} />
      </AssessmentGate>

      <ViolationOverlay
        secure={secure}
        terminatedTitle="Interview terminated"
        terminatedMessage="This interview was ended because the violation limit was reached. No evaluation will be generated; the transcript and violation log are kept."
        terminatedActionLabel="View transcript"
      />

      {/* End interview confirmation modal */}
      <Modal open={endModalOpen} onClose={() => setEndModalOpen(false)}>
        <div className="p-6">
          <div className="text-lg font-semibold text-slate-100">End Interview?</div>
          <p className="text-sm text-slate-300 mt-2">
            This will end the interview and generate your evaluation. You won't be able to continue this session.
          </p>
          <div className="mt-5 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => setEndModalOpen(false)}
              className="h-10 px-4 rounded-xl bg-white/5 border border-white/10 hover:border-white/20 text-slate-200"
            >
              Continue Interview
            </button>
            <button
              type="button"
              onClick={() => handleEndInterview('completed')}
              disabled={ending}
              className="h-10 px-4 rounded-xl bg-rose-600/80 border border-rose-500/30 hover:bg-rose-600 text-white font-semibold disabled:opacity-60"
            >
              {ending ? 'Ending…' : 'End & Get Evaluation'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Logout modal */}
      <Modal open={confirmLogoutOpen} onClose={() => setConfirmLogoutOpen(false)}>
        <div className="p-6">
          <div className="text-lg font-semibold text-slate-100">Confirm Logout</div>
          <p className="text-sm text-slate-300 mt-2">Are you sure you want to logout?</p>
          <div className="mt-5 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => setConfirmLogoutOpen(false)}
              className="h-10 px-4 rounded-xl bg-white/5 border border-white/10 hover:border-white/20 text-slate-200"
            >
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

export default MockInterviewSession;
