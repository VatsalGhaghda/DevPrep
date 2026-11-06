import { useCallback, useEffect, useRef, useState } from 'react';
import { createLevelMeter, SOUND_THRESHOLD } from '../utils/audioLevel';

/**
 * useSpeechToText: records a spoken answer and turns it into text.
 *
 * Pipeline (the same in every browser):
 *   1. Capture: MediaRecorder on a real microphone track. The track comes
 *      from getStream() (the stream opened by the pre-interview device
 *      check, so no permission prompt appears mid-interview), or from
 *      getUserMedia when there is no such stream.
 *   2. Feedback: a live input-level meter and an elapsed timer, read from
 *      the same track, so the user can see the mic is really picking them up.
 *   3. Live preview (optional): where the browser has the Web Speech API,
 *      it shows words while you speak. Its failures never block recording.
 *   4. Transcript: when you stop, the recording is sent to the server
 *      (Groq Whisper). If that fails, the live preview text is used instead.
 *
 * The text goes to onFinal(text). It is never sent automatically.
 */

const MAX_RECORDING_MS = 3 * 60 * 1000;
const MIN_RECORDING_MS = 600;

function getRecognitionClass() {
  if (typeof window === 'undefined') return null;
  return window.SpeechRecognition || window.webkitSpeechRecognition || null;
}

function pickMimeType() {
  const types = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/mp4'];
  for (const t of types) {
    try { if (window.MediaRecorder.isTypeSupported(t)) return t; } catch (_) { /* ignore */ }
  }
  return '';
}

function micErrorMessage(err) {
  switch (err && err.name) {
    case 'NotAllowedError':
    case 'SecurityError':
      return 'Microphone access is blocked. Click the icon at the left of the address bar, allow the microphone, then try again.';
    case 'NotFoundError':
    case 'OverconstrainedError':
      return 'No microphone was found. Connect one and try again.';
    case 'NotReadableError':
      return 'The microphone is being used by another app. Close it and try again.';
    default:
      return `Could not start the microphone${err?.message ? `: ${err.message}` : '.'}`;
  }
}

export function useSpeechToText({ lang = 'en-US', onFinal, transcribe, getStream, allowPrompt = true } = {}) {
  const Recognition = getRecognitionClass();
  const secure = typeof window === 'undefined' || window.isSecureContext !== false;
  const canRecord = typeof window !== 'undefined' && typeof window.MediaRecorder !== 'undefined' &&
    Boolean(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
  const supported = secure && canRecord && Boolean(transcribe);

  // idle | starting | recording | transcribing
  const [phase, setPhase] = useState('idle');
  const [level, setLevel] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [interim, setInterim] = useState('');
  const [preview, setPreview] = useState('');
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);

  const onFinalRef = useRef(onFinal);
  onFinalRef.current = onFinal;
  const transcribeRef = useRef(transcribe);
  transcribeRef.current = transcribe;
  const getStreamRef = useRef(getStream);
  getStreamRef.current = getStream;
  const allowPromptRef = useRef(allowPrompt);
  allowPromptRef.current = allowPrompt;

  const mountedRef = useRef(true);
  const sessionRef = useRef(null); // everything belonging to the current recording

  const cleanupSession = (s) => {
    if (!s) return;
    clearInterval(s.tick);
    clearTimeout(s.maxTimer);
    s.stopMeter?.();
    if (s.recognition) {
      s.recognition.onend = null;
      try { s.recognition.abort(); } catch (_) { /* ignore */ }
    }
    // Only stop tracks we opened ourselves; the shared device stream stays on
    if (s.ownStream) s.stream.getTracks().forEach((t) => t.stop());
  };

  const startPreview = (s) => {
    if (!Recognition) return;
    let rec;
    try { rec = new Recognition(); } catch (_) { return; }
    rec.lang = lang;
    rec.continuous = true;
    rec.interimResults = true;
    rec.onresult = (event) => {
      let interimText = '';
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const r = event.results[i];
        const text = r[0] ? r[0].transcript : '';
        if (r.isFinal) s.previewFinal = `${s.previewFinal} ${text}`.trim();
        else interimText += text;
      }
      s.lastInterim = interimText.trim();
      if (mountedRef.current && sessionRef.current === s) {
        setPreview(s.previewFinal);
        setInterim(interimText.trim());
      }
    };
    rec.onerror = (event) => {
      // Preview only: recording continues whatever happens here
      if (event.error !== 'no-speech' && event.error !== 'aborted') s.previewFailed = true;
    };
    rec.onend = () => {
      // Chrome stops after a pause; keep previewing while still recording
      if (sessionRef.current === s && s.recorder?.state === 'recording' && !s.previewFailed && s.restarts < 20) {
        s.restarts += 1;
        try { rec.start(); } catch (_) { /* give up on preview */ }
      }
    };
    try {
      rec.start();
      s.recognition = rec;
    } catch (_) { /* no preview */ }
  };

  const finish = async (s) => {
    const chunks = s.chunks;
    const duration = Date.now() - s.startedAt;
    const heardSound = s.peak >= SOUND_THRESHOLD;
    const previewText = `${s.previewFinal} ${s.lastInterim || ''}`.trim();
    cleanupSession(s);
    if (sessionRef.current === s) sessionRef.current = null;
    if (!mountedRef.current) return;
    setLevel(0);
    setInterim('');

    const blob = new Blob(chunks, { type: s.recorder.mimeType || s.mimeType || 'audio/webm' });
    if (duration < MIN_RECORDING_MS || blob.size < 500) {
      setPhase('idle');
      setError('The recording was too short. Press the mic, speak your answer, then press it again to stop.');
      return;
    }
    if (!heardSound && !previewText) {
      setPhase('idle');
      setError('No sound reached the microphone. Check that the right mic is selected and not muted (address bar icon or system sound settings), then try again.');
      return;
    }

    setPhase('transcribing');
    try {
      const text = (await transcribeRef.current(blob)) || '';
      if (!mountedRef.current) return;
      if (text.trim()) {
        onFinalRef.current?.(text.trim());
      } else if (previewText) {
        onFinalRef.current?.(previewText);
      } else {
        setError('No words were recognised in the recording. Try speaking a little louder or closer to the mic.');
      }
    } catch (err) {
      if (!mountedRef.current) return;
      const msg = err?.response?.data?.message || err?.message || 'Transcription failed';
      if (previewText) {
        onFinalRef.current?.(previewText);
        setNotice(`Server transcription failed (${msg}), so the browser's live transcript was used. Please check it before sending.`);
      } else {
        setError(`Could not transcribe your answer: ${msg}`);
      }
    } finally {
      if (mountedRef.current) setPhase('idle');
      setPreview('');
    }
  };

  const start = useCallback(async () => {
    if (sessionRef.current || phase !== 'idle') return;
    setError(null);
    setNotice(null);
    setInterim('');
    setPreview('');
    if (!secure) { setError('Voice input needs a secure (https or localhost) connection.'); return; }
    if (!canRecord) { setError('This browser cannot record audio. Please type your answer, or use a current Chrome, Edge, Firefox or Safari.'); return; }

    const s = {
      chunks: [], peak: 0, previewFinal: '', lastInterim: '', restarts: 0,
      startedAt: 0, ownStream: false, stream: null, recorder: null
    };
    sessionRef.current = s;
    setPhase('starting');

    // 1. A live microphone track
    try {
      let stream = getStreamRef.current ? getStreamRef.current() : null;
      const live = stream && stream.getAudioTracks().some((t) => t.readyState === 'live' && t.enabled);
      if (!live && !allowPromptRef.current) {
        // In a running proctored interview we never trigger a permission prompt
        sessionRef.current = null;
        setPhase('idle');
        setError('The microphone is not available. Use "Reconnect devices" above, or type your answer.');
        return;
      }
      if (!live) {
        stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
        s.ownStream = true;
      }
      s.stream = stream;
    } catch (err) {
      sessionRef.current = null;
      setPhase('idle');
      setError(micErrorMessage(err));
      return;
    }
    if (sessionRef.current !== s || !mountedRef.current) { cleanupSession(s); return; }

    // 2. Recorder
    s.mimeType = pickMimeType();
    try {
      const audioOnly = new MediaStream(s.stream.getAudioTracks());
      s.recorder = s.mimeType ? new MediaRecorder(audioOnly, { mimeType: s.mimeType }) : new MediaRecorder(audioOnly);
    } catch (err) {
      cleanupSession(s);
      sessionRef.current = null;
      setPhase('idle');
      setError(`This browser could not start recording: ${err.message}`);
      return;
    }
    s.recorder.ondataavailable = (e) => { if (e.data && e.data.size > 0) s.chunks.push(e.data); };
    s.recorder.onstop = () => finish(s);
    s.recorder.onerror = (e) => {
      setError(`Recording failed: ${e.error?.message || 'unknown error'}`);
    };
    s.stream.getAudioTracks().forEach((t) => {
      t.addEventListener('ended', () => {
        if (sessionRef.current === s && s.recorder.state === 'recording') {
          setNotice('The microphone was disconnected, so recording stopped.');
          s.recorder.stop();
        }
      }, { once: true });
    });

    // 3. Level meter and timer
    s.stopMeter = createLevelMeter(s.stream, (v) => {
      if (v > s.peak) s.peak = v;
      if (mountedRef.current) setLevel(v);
    });
    s.startedAt = Date.now();
    setElapsed(0);
    s.tick = setInterval(() => { if (mountedRef.current) setElapsed(Math.floor((Date.now() - s.startedAt) / 1000)); }, 250);
    s.maxTimer = setTimeout(() => {
      if (s.recorder.state === 'recording') {
        setNotice('Recording stopped after 3 minutes. Record again to add more.');
        s.recorder.stop();
      }
    }, MAX_RECORDING_MS);

    try {
      s.recorder.start(250);
    } catch (err) {
      cleanupSession(s);
      sessionRef.current = null;
      setPhase('idle');
      setError(`Could not start recording: ${err.message}`);
      return;
    }
    setPhase('recording');

    // 4. Optional live words
    startPreview(s);
  }, [phase, secure, canRecord, lang]);

  const stop = useCallback(() => {
    const s = sessionRef.current;
    if (!s) return;
    if (s.recognition) {
      try { s.recognition.stop(); } catch (_) { /* ignore */ }
    }
    if (s.recorder && s.recorder.state !== 'inactive') {
      try { s.recorder.requestData(); } catch (_) { /* ignore */ }
      s.recorder.stop(); // finish() runs from onstop
    } else {
      cleanupSession(s);
      sessionRef.current = null;
      setPhase('idle');
    }
  }, []);

  const clearError = useCallback(() => { setError(null); setNotice(null); }, []);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      const s = sessionRef.current;
      sessionRef.current = null;
      if (s) {
        if (s.recorder) s.recorder.onstop = null;
        try { if (s.recorder && s.recorder.state !== 'inactive') s.recorder.stop(); } catch (_) { /* ignore */ }
        cleanupSession(s);
      }
    };
  }, []);

  return {
    supported,
    livePreview: Boolean(Recognition),
    phase,
    listening: phase === 'starting' || phase === 'recording',
    recording: phase === 'recording',
    processing: phase === 'transcribing',
    level,
    elapsed,
    interim,
    preview,
    error,
    notice,
    start,
    stop,
    clearError
  };
}
