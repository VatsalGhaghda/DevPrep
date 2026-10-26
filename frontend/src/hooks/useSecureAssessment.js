import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Client half of the secure assessment environment.
 *
 * Detects suspicious events while an assessment is running and reports each
 * one to the server, which owns the violation count and decides whether the
 * assessment is flagged or terminated. Browsers cannot stop a user switching
 * apps or using another device; this records what the page can observe.
 *
 * @param {object}   opts
 * @param {boolean}  opts.enabled       the assessment is in progress (server status active)
 * @param {object}   opts.security      server security summary ({ policy, violationCount, terminated, ... })
 * @param {Function} opts.report        async (type, details) => server response ({ security, status })
 * @param {Function} [opts.onTerminated] called with the server response when the server terminates the assessment
 */

const DUPLICATE_WINDOW_MS = 1500;

const FULLSCREEN_UNAVAILABLE = 'fullscreen unavailable';

const MESSAGES = {
  tab_switch: 'You switched away from the assessment tab.',
  window_blur: 'The assessment window lost focus.',
  fullscreen_exit: 'You left fullscreen mode.',
  [FULLSCREEN_UNAVAILABLE]: 'Continuing without fullscreen. This is recorded once for this assessment.',
  copy_attempt: 'Copying is disabled during the assessment.',
  paste_attempt: 'Pasting is disabled during the assessment.',
  devtools_open: 'Developer tools are not allowed during the assessment.',
  shortcut_blocked: 'That keyboard shortcut is disabled during the assessment.'
};

// Returns [violationType, label] for a blocked key combination, or null.
function classifyShortcut(e) {
  const key = String(e.key || '').toLowerCase();
  const mod = e.ctrlKey || e.metaKey;

  if (key === 'f12') return ['devtools_open', 'F12'];
  if (mod && e.shiftKey && ['i', 'j', 'c', 'k'].includes(key)) return ['devtools_open', `Ctrl+Shift+${key.toUpperCase()}`];
  if (e.metaKey && e.altKey && ['i', 'j', 'c'].includes(key)) return ['devtools_open', `Cmd+Alt+${key.toUpperCase()}`];
  if (mod && ['u', 's', 'p'].includes(key)) return ['shortcut_blocked', `Ctrl+${key.toUpperCase()}`];
  if (key === 'f5' || (mod && key === 'r')) return ['shortcut_blocked', 'Reload'];
  return null;
}

/**
 * Build the security summary from a raw assessment document (as returned for
 * mock interview sessions). Mirrors securitySummary() on the server.
 */
export function securityFromDoc(doc) {
  if (!doc) return null;
  const policy = doc.securityPolicy || {};
  const count = doc.violationCount || 0;
  return {
    policy: {
      enabled: Boolean(policy.enabled),
      maxViolations: policy.maxViolations,
      warningThreshold: policy.warningThreshold,
      onExceed: policy.onExceed,
      fullscreenRequired: Boolean(policy.fullscreenRequired)
    },
    violationCount: count,
    remaining: Math.max(0, (policy.maxViolations || 0) - count),
    flagged: Boolean(doc.flagged),
    fullscreenWaived: Boolean(doc.fullscreenWaived),
    terminated: doc.terminationReason === 'violations'
  };
}

function fullscreenSupported() {
  return Boolean(document.fullscreenEnabled && document.documentElement.requestFullscreen);
}

function exitFullscreenIfActive() {
  if (document.fullscreenElement && document.exitFullscreen) {
    document.exitFullscreen().catch(() => {});
  }
}

export function useSecureAssessment({ enabled, security: serverSecurity, report, onTerminated }) {
  const [security, setSecurity] = useState(serverSecurity || null);
  const [armed, setArmed] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(() => Boolean(document.fullscreenElement));
  const [warning, setWarning] = useState(null);
  // True when the server terminated the assessment during this visit
  const [terminatedNow, setTerminatedNow] = useState(false);
  // The browser refused fullscreen; the user may continue without it at the
  // cost of one recorded violation (waived), instead of being stuck paused.
  const [fullscreenFailed, setFullscreenFailed] = useState(false);
  const [fullscreenWaived, setFullscreenWaived] = useState(false);

  useEffect(() => {
    setSecurity(serverSecurity || null);
  }, [serverSecurity]);

  const policy = security?.policy || null;
  const terminated = Boolean(security?.terminated);
  const proctored = Boolean(enabled && policy?.enabled && !terminated);
  const running = proctored && armed;
  // A waiver already recorded on the server carries over to reloads
  const waived = fullscreenWaived || Boolean(security?.fullscreenWaived);
  const needsFullscreen = Boolean(policy?.fullscreenRequired && fullscreenSupported() && !waived);
  const paused = running && needsFullscreen && !isFullscreen;

  // Event handlers read these refs so listeners are attached only once per run.
  const runningRef = useRef(running);
  runningRef.current = running;
  const needsFullscreenRef = useRef(needsFullscreen);
  needsFullscreenRef.current = needsFullscreen;
  const reportRef = useRef(report);
  reportRef.current = report;
  const onTerminatedRef = useRef(onTerminated);
  onTerminatedRef.current = onTerminated;
  const lastReportedRef = useRef({});

  const flag = useCallback(async (type, details = '') => {
    if (!runningRef.current) return;

    const now = Date.now();
    if (now - (lastReportedRef.current[type] || 0) < DUPLICATE_WINDOW_MS) return;
    lastReportedRef.current[type] = now;

    setWarning({ type, message: MESSAGES[details] || MESSAGES[type] || 'Suspicious activity detected.', at: now });

    // Optimistic count; replaced by the server's count when it answers.
    setSecurity((prev) => (prev ? { ...prev, violationCount: (prev.violationCount || 0) + 1 } : prev));

    try {
      const data = await reportRef.current(type, details);
      if (data?.security) setSecurity(data.security);
      if (data?.security?.terminated) {
        runningRef.current = false;
        setWarning(null);
        setTerminatedNow(true);
        onTerminatedRef.current?.(data);
      }
    } catch (err) {
      // 409: the assessment already ended or was terminated server-side
      const data = err?.response?.data;
      if (data?.security) {
        setSecurity(data.security);
        if (data.security.terminated) {
          setWarning(null);
          setTerminatedNow(true);
          onTerminatedRef.current?.(data);
        }
      }
    }
  }, []);

  const acknowledgeTermination = useCallback(() => setTerminatedNow(false), []);

  // Ask for fullscreen and report whether we got it. Some embedded browsers
  // never settle the promise, so wait at most a second.
  const enterFullscreen = useCallback(async () => {
    if (document.fullscreenElement) return true;
    const request = document.documentElement.requestFullscreen().catch(() => {});
    await Promise.race([request, new Promise((resolve) => setTimeout(resolve, 1000))]);
    const ok = Boolean(document.fullscreenElement);
    setFullscreenFailed(!ok);
    return ok;
  }, []);

  const arm = useCallback(async () => {
    setFullscreenWaived(false);
    if (needsFullscreenRef.current) {
      // If it isn't granted, the pause screen asks again
      await enterFullscreen();
    }
    lastReportedRef.current = {};
    setArmed(true);
  }, [enterFullscreen]);

  const requestFullscreen = useCallback(() => {
    enterFullscreen();
  }, [enterFullscreen]);

  // Continue without fullscreen when the browser won't allow it; recorded.
  const waiveFullscreen = useCallback(() => {
    setFullscreenWaived(true);
    setFullscreenFailed(false);
    flag('fullscreen_exit', FULLSCREEN_UNAVAILABLE);
  }, [flag]);

  // Stop monitoring and leave fullscreen without counting it as a violation.
  const release = useCallback(() => {
    runningRef.current = false;
    setArmed(false);
    setWarning(null);
    exitFullscreenIfActive();
  }, []);

  const dismissWarning = useCallback(() => setWarning(null), []);

  // Assessment ended (submitted, terminated, timed out): stop monitoring.
  useEffect(() => {
    if (!proctored && armed) release();
  }, [proctored, armed, release]);

  // Track fullscreen state at all times; count exits only while running.
  useEffect(() => {
    const onChange = () => {
      const fs = Boolean(document.fullscreenElement);
      setIsFullscreen(fs);
      if (!fs && needsFullscreenRef.current) flag('fullscreen_exit');
    };
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, [flag]);

  useEffect(() => {
    if (!running) return undefined;

    const onVisibility = () => {
      if (document.visibilityState === 'hidden') flag('tab_switch');
    };

    let blurTimer = null;
    const onBlur = () => {
      // A tab switch fires blur first; let visibilitychange report it instead.
      // Focus moving into an iframe on the page also blurs the window.
      clearTimeout(blurTimer);
      blurTimer = setTimeout(() => {
        if (document.hidden || document.hasFocus()) return;
        flag('window_blur');
      }, 250);
    };

    const onKeyDown = (e) => {
      const hit = classifyShortcut(e);
      if (!hit) return;
      e.preventDefault();
      e.stopPropagation();
      flag(hit[0], hit[1]);
    };

    const onCopy = (e) => {
      e.preventDefault();
      e.stopPropagation();
      flag('copy_attempt', e.type);
    };

    const onPaste = (e) => {
      e.preventDefault();
      e.stopPropagation();
      flag('paste_attempt', e.type);
    };

    const onContextMenu = (e) => e.preventDefault();
    const onDragOver = (e) => e.preventDefault();

    const onBeforeUnload = (e) => {
      e.preventDefault();
      e.returnValue = '';
    };

    // Capture phase so the editor (Monaco) never sees blocked clipboard events.
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('blur', onBlur);
    window.addEventListener('keydown', onKeyDown, true);
    window.addEventListener('copy', onCopy, true);
    window.addEventListener('cut', onCopy, true);
    window.addEventListener('paste', onPaste, true);
    window.addEventListener('drop', onPaste, true);
    window.addEventListener('dragover', onDragOver, true);
    window.addEventListener('contextmenu', onContextMenu, true);
    window.addEventListener('beforeunload', onBeforeUnload);

    return () => {
      clearTimeout(blurTimer);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('blur', onBlur);
      window.removeEventListener('keydown', onKeyDown, true);
      window.removeEventListener('copy', onCopy, true);
      window.removeEventListener('cut', onCopy, true);
      window.removeEventListener('paste', onPaste, true);
      window.removeEventListener('drop', onPaste, true);
      window.removeEventListener('dragover', onDragOver, true);
      window.removeEventListener('contextmenu', onContextMenu, true);
      window.removeEventListener('beforeunload', onBeforeUnload);
    };
  }, [running, flag]);

  // Leave fullscreen when the page unmounts (e.g. browser back button).
  useEffect(() => () => {
    runningRef.current = false;
    exitFullscreenIfActive();
  }, []);

  return {
    proctored,
    needsGate: proctored && !armed,
    running,
    paused,
    terminated,
    terminatedNow,
    acknowledgeTermination,
    security,
    warning,
    dismissWarning,
    arm,
    release,
    requestFullscreen,
    fullscreenFailed,
    waiveFullscreen
  };
}
