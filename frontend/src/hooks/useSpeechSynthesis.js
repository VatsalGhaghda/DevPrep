import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * useSpeechSynthesis — speaks interviewer messages with the browser's
 * built-in text-to-speech (window.speechSynthesis).
 *
 * Only one message plays at a time: every new speak() cancels what is
 * playing. Long text is split into sentence-sized chunks because Chrome
 * silently stops utterances that run longer than about 15 seconds.
 */

const MUTE_KEY = 'devprep.voice.muted';
const MAX_CHUNK = 220;

function isSupported() {
  return typeof window !== 'undefined' && 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window;
}

function readMuted() {
  try { return localStorage.getItem(MUTE_KEY) === 'true'; } catch (_) { return false; }
}

// Strip markdown-ish symbols so they aren't read out ("asterisk asterisk").
function cleanForSpeech(text) {
  return String(text || '')
    .replace(/```[\s\S]*?```/g, ' (code snippet shown on screen) ')
    .replace(/`([^`]*)`/g, '$1')
    .replace(/[*_#>]+/g, ' ')
    .replace(/\[(.*?)\]\((.*?)\)/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}

function splitIntoChunks(text) {
  const sentences = text.match(/[^.!?]+[.!?]+["')\]]*|[^.!?]+$/g) || [text];
  const chunks = [];
  let current = '';
  for (const raw of sentences) {
    const sentence = raw.trim();
    if (!sentence) continue;
    if ((current + ' ' + sentence).trim().length <= MAX_CHUNK) {
      current = (current + ' ' + sentence).trim();
      continue;
    }
    if (current) chunks.push(current);
    if (sentence.length <= MAX_CHUNK) {
      current = sentence;
    } else {
      // Very long sentence: break on commas, then on words
      let part = '';
      for (const word of sentence.split(/\s+/)) {
        if ((part + ' ' + word).trim().length > MAX_CHUNK) {
          if (part) chunks.push(part);
          part = word;
        } else {
          part = (part + ' ' + word).trim();
        }
      }
      current = part;
    }
  }
  if (current) chunks.push(current);
  return chunks;
}

function pickVoice(voices, lang) {
  if (!voices || voices.length === 0) return null;
  const base = (lang || 'en').slice(0, 2).toLowerCase();
  const matching = voices.filter((v) => (v.lang || '').toLowerCase().startsWith(base));
  const pool = matching.length ? matching : voices;
  const exact = pool.filter((v) => (v.lang || '').toLowerCase() === (lang || '').toLowerCase());
  const preferred = /natural|neural|google|aria|jenny|guy|samantha|daniel|serena/i;
  return (
    exact.find((v) => preferred.test(v.name)) ||
    pool.find((v) => preferred.test(v.name)) ||
    exact.find((v) => v.default) ||
    exact[0] ||
    pool.find((v) => v.default) ||
    pool[0]
  );
}

export function useSpeechSynthesis({ lang = 'en-US', rate = 1 } = {}) {
  const supported = isSupported();
  // idle | speaking | paused
  const [status, setStatus] = useState('idle');
  const [currentId, setCurrentId] = useState(null);
  const [muted, setMutedState] = useState(readMuted);
  // 'blocked' when the browser refused to play before the user interacted
  const [error, setError] = useState(null);

  const runRef = useRef(0);
  const voiceRef = useRef(null);
  const lastRef = useRef(null); // { id, text } of the last thing spoken

  useEffect(() => {
    if (!supported) return undefined;
    const synth = window.speechSynthesis;
    const load = () => { voiceRef.current = pickVoice(synth.getVoices(), lang); };
    load();
    synth.addEventListener?.('voiceschanged', load);
    return () => synth.removeEventListener?.('voiceschanged', load);
  }, [supported, lang]);

  const stop = useCallback(() => {
    runRef.current += 1;
    if (supported) window.speechSynthesis.cancel();
    setStatus('idle');
    setCurrentId(null);
  }, [supported]);

  const speak = useCallback((text, id = null) => {
    if (!supported) return false;
    const clean = cleanForSpeech(text);
    if (!clean) return false;

    const synth = window.speechSynthesis;
    // Never overlap: cancel whatever is playing or queued first
    runRef.current += 1;
    const run = runRef.current;
    synth.cancel();
    // Chrome can be left paused after cancel(); make sure it plays
    if (synth.paused) synth.resume();

    lastRef.current = { id, text };
    setError(null);
    setCurrentId(id);
    setStatus('speaking');

    const chunks = splitIntoChunks(clean);
    chunks.forEach((chunk, index) => {
      const u = new SpeechSynthesisUtterance(chunk);
      u.lang = lang;
      u.rate = rate;
      if (voiceRef.current) u.voice = voiceRef.current;
      if (index === chunks.length - 1) {
        u.onend = () => {
          if (runRef.current !== run) return;
          setStatus('idle');
          setCurrentId(null);
        };
      }
      u.onerror = (e) => {
        if (runRef.current !== run) return;
        if (e.error === 'interrupted' || e.error === 'canceled') return;
        runRef.current += 1;
        synth.cancel();
        setError(e.error === 'not-allowed' ? 'blocked' : 'failed');
        setStatus('idle');
        setCurrentId(null);
      };
      synth.speak(u);
    });
    return true;
  }, [supported, lang, rate]);

  const pause = useCallback(() => {
    if (!supported || status !== 'speaking') return;
    window.speechSynthesis.pause();
    setStatus('paused');
  }, [supported, status]);

  const resume = useCallback(() => {
    if (!supported || status !== 'paused') return;
    window.speechSynthesis.resume();
    setStatus('speaking');
  }, [supported, status]);

  const replay = useCallback(() => {
    if (!lastRef.current) return false;
    return speak(lastRef.current.text, lastRef.current.id);
  }, [speak]);

  const setMuted = useCallback((value) => {
    setMutedState(value);
    try { localStorage.setItem(MUTE_KEY, String(value)); } catch (_) { /* ignore */ }
    if (value) stop();
  }, [stop]);

  // Stop talking when the page goes away
  useEffect(() => () => {
    runRef.current += 1;
    if (isSupported()) window.speechSynthesis.cancel();
  }, []);

  return { supported, status, currentId, muted, setMuted, error, speak, pause, resume, stop, replay };
}
