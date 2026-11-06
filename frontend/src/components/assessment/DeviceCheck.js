import { useEffect, useRef, useState } from 'react';
import {
  Camera, Mic, Volume2, CheckCircle2, XCircle, Loader2, RefreshCw, AlertTriangle, Info, Play
} from 'lucide-react';
import { createLevelMeter, SOUND_THRESHOLD } from '../../utils/audioLevel';

/**
 * Pre-interview device check, shown inside the assessment gate, before any
 * proctoring starts. Requests camera + microphone, shows a live preview,
 * a mic level test and a speaker test, and reports when everything passed.
 *
 * `devices` comes from useMediaDevices() in the page, so the same stream
 * stays open for the interview (no second permission prompt later).
 */

// A plain test phrase, so it isn't mistaken for the interview starting
const SPEAKER_TEXT = 'Speaker test. If you can hear this clearly, click "I heard it".';
const MIC_DETECT_MS = 400;

function StatusIcon({ state }) {
  if (state === 'ok') return <CheckCircle2 className="w-4 h-4 text-emerald-400" />;
  if (state === 'fail') return <XCircle className="w-4 h-4 text-rose-400" />;
  if (state === 'busy') return <Loader2 className="w-4 h-4 text-violet-300 animate-spin" />;
  return <span className="w-4 h-4 rounded-full border border-white/20 inline-block" />;
}

function Row({ icon: Icon, title, why, state, statusText, children }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
      <div className="flex items-start gap-3">
        <Icon className="w-4 h-4 mt-0.5 text-cyan-400 shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-semibold text-slate-100">{title}</span>
            <span className="inline-flex items-center gap-1.5 text-xs text-slate-300">
              <StatusIcon state={state} /> {statusText}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">{why}</p>
          {children}
        </div>
      </div>
    </div>
  );
}

function playTone() {
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return Promise.resolve(false);
  const ctx = new Ctx();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.frequency.value = 523;
  gain.gain.setValueAtTime(0.0001, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.2, ctx.currentTime + 0.05);
  gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 1.2);
  osc.connect(gain).connect(ctx.destination);
  osc.start();
  osc.stop(ctx.currentTime + 1.25);
  return new Promise((resolve) => { osc.onended = () => { ctx.close().catch(() => {}); resolve(true); }; });
}

const deviceState = (d, verified) => {
  if (d.status === 'requesting') return 'busy';
  if (d.status === 'granted') return verified ? 'ok' : 'busy';
  if (d.status === 'idle') return 'idle';
  return 'fail';
};

export default function DeviceCheck({ devices, onReadyChange }) {
  const { stream, audioStream, camera, microphone, requesting, request } = devices;
  const videoRef = useRef(null);
  const [cameraVerified, setCameraVerified] = useState(false);
  const [micLevel, setMicLevel] = useState(0);
  const [micVerified, setMicVerified] = useState(false);
  const [speaker, setSpeaker] = useState('untested'); // untested | playing | played | confirmed | not_heard
  const soundMsRef = useRef(0);

  // Ask straight away if the browser already remembers both permissions
  useEffect(() => {
    if (stream || requesting || camera.status !== 'idle') return;
    if (!navigator.permissions?.query) return;
    Promise.all([
      navigator.permissions.query({ name: 'camera' }),
      navigator.permissions.query({ name: 'microphone' })
    ]).then(([c, m]) => {
      if (c.state === 'granted' && m.state === 'granted') request();
    }).catch(() => {});
  }, []); // eslint-disable-line

  // Camera preview, verified once real frames arrive
  useEffect(() => {
    setCameraVerified(false);
    const video = videoRef.current;
    if (!video) return undefined;
    const hasVideo = stream && stream.getVideoTracks().some((t) => t.readyState === 'live');
    video.srcObject = hasVideo ? new MediaStream(stream.getVideoTracks()) : null;
    if (!hasVideo) return undefined;
    const check = () => { if (video.videoWidth > 0 && video.videoHeight > 0) setCameraVerified(true); };
    video.addEventListener('loadeddata', check);
    video.addEventListener('resize', check);
    video.play().catch(() => {});
    const timer = setInterval(check, 500);
    return () => {
      clearInterval(timer);
      video.removeEventListener('loadeddata', check);
      video.removeEventListener('resize', check);
    };
  }, [stream]);

  // Microphone level test
  useEffect(() => {
    setMicVerified(false);
    setMicLevel(0);
    soundMsRef.current = 0;
    if (!audioStream) return undefined;
    return createLevelMeter(audioStream, (v) => {
      setMicLevel(v);
      if (v >= SOUND_THRESHOLD) {
        soundMsRef.current += 50;
        if (soundMsRef.current >= MIC_DETECT_MS) setMicVerified(true);
      }
    });
  }, [audioStream]);

  // A device that disconnects loses its pass
  useEffect(() => { if (camera.status !== 'granted') setCameraVerified(false); }, [camera.status]);
  useEffect(() => { if (microphone.status !== 'granted') setMicVerified(false); }, [microphone.status]);

  const speakerOk = speaker === 'confirmed';
  const ready = camera.status === 'granted' && cameraVerified && microphone.status === 'granted' && micVerified && speakerOk;
  useEffect(() => { onReadyChange?.(ready); }, [ready, onReadyChange]);

  const testSpeaker = async () => {
    setSpeaker('playing');
    // Don't overwrite an answer the user already gave while it was playing
    const finished = () => setSpeaker((prev) => (prev === 'playing' ? 'played' : prev));
    const synth = window.speechSynthesis;
    if (synth && typeof window.SpeechSynthesisUtterance !== 'undefined') {
      synth.cancel();
      const u = new SpeechSynthesisUtterance(SPEAKER_TEXT);
      u.lang = 'en-US';
      let settled = false;
      const done = () => { if (!settled) { settled = true; finished(); } };
      u.onend = done;
      u.onerror = async () => { if (!settled) { settled = true; await playTone(); finished(); } };
      synth.speak(u);
      // Some browsers never fire onend; let the user answer anyway
      setTimeout(done, 8000);
    } else {
      await playTone();
      finished();
    }
  };

  const fullscreenSupported = Boolean(document.fullscreenEnabled);
  const ttsSupported = typeof window.speechSynthesis !== 'undefined';
  const recorderSupported = typeof window.MediaRecorder !== 'undefined';

  const permissionProblem = [camera, microphone].find((d) => !['idle', 'requesting', 'granted'].includes(d.status));

  return (
    <div className="space-y-3">
      <div className="text-sm text-slate-300">
        Set up your devices before the proctored interview starts. Permission prompts appear only here, so they can never count as a violation.
      </div>

      {(camera.status === 'idle' || microphone.status === 'idle') && !requesting && !stream && (
        <button
          type="button"
          onClick={request}
          className="w-full h-11 rounded-xl bg-violet-600 hover:bg-violet-700 border border-violet-500 text-white text-sm font-semibold inline-flex items-center justify-center gap-2"
        >
          <Camera className="w-4 h-4" /> Allow camera and microphone
        </button>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Row
          icon={Camera}
          title="Camera"
          why="Required for proctored interviews. Your camera shows a self-view during the interview; video is not recorded or uploaded."
          state={deviceState(camera, cameraVerified)}
          statusText={camera.status === 'granted' ? (cameraVerified ? 'Working' : 'Starting…') : camera.status === 'requesting' ? 'Waiting for permission' : camera.status === 'idle' ? 'Not checked' : 'Problem'}
        >
          <div className="mt-2 aspect-video w-full rounded-lg overflow-hidden bg-black/40 border border-white/10 flex items-center justify-center">
            <video ref={videoRef} muted playsInline autoPlay className={`w-full h-full object-cover -scale-x-100 ${cameraVerified ? '' : 'hidden'}`} />
            {!cameraVerified && <span className="text-xs text-slate-500">Camera preview</span>}
          </div>
          {camera.message && <p className="mt-2 text-xs text-rose-300">{camera.message}</p>}
        </Row>

        <div className="space-y-3">
          <Row
            icon={Mic}
            title="Microphone"
            why="Used to record your spoken answers."
            state={deviceState(microphone, micVerified)}
            statusText={microphone.status === 'granted' ? (micVerified ? 'Sound detected' : 'Say something') : microphone.status === 'requesting' ? 'Waiting for permission' : microphone.status === 'idle' ? 'Not checked' : 'Problem'}
          >
            {microphone.status === 'granted' && (
              <>
                <div className="mt-2 h-2 rounded-full bg-white/10 overflow-hidden" aria-label="Microphone input level">
                  <div
                    className={`h-full rounded-full transition-[width] duration-75 ${micLevel >= SOUND_THRESHOLD ? 'bg-emerald-400' : 'bg-slate-500'}`}
                    style={{ width: `${Math.round(micLevel * 100)}%` }}
                  />
                </div>
                {!micVerified && <p className="mt-1.5 text-xs text-slate-400">Say a sentence, for example your name, and watch the bar move.</p>}
              </>
            )}
            {microphone.message && <p className="mt-2 text-xs text-rose-300">{microphone.message}</p>}
          </Row>

          <Row
            icon={Volume2}
            title="Speakers / headphones"
            why="The AI interviewer reads each question aloud."
            state={speakerOk ? 'ok' : speaker === 'not_heard' ? 'fail' : speaker === 'playing' ? 'busy' : 'idle'}
            statusText={speakerOk ? 'Confirmed' : speaker === 'playing' ? 'Playing…' : speaker === 'played' ? 'Did you hear it?' : speaker === 'not_heard' ? 'Not heard' : 'Not tested'}
          >
            <div className="mt-2 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={testSpeaker}
                disabled={speaker === 'playing'}
                className="h-8 px-3 rounded-lg bg-white/5 border border-white/10 hover:border-white/20 text-xs text-slate-200 inline-flex items-center gap-1.5 disabled:opacity-50"
              >
                <Play className="w-3.5 h-3.5" /> {speaker === 'untested' ? 'Play test sound' : 'Play again'}
              </button>
              {(speaker === 'played' || speaker === 'not_heard' || speaker === 'playing') && !speakerOk && (
                <>
                  <button type="button" onClick={() => setSpeaker('confirmed')} className="h-8 px-3 rounded-lg bg-emerald-600/80 hover:bg-emerald-600 border border-emerald-500/50 text-xs font-semibold text-white">
                    I heard it
                  </button>
                  <button type="button" onClick={() => setSpeaker('not_heard')} className="h-8 px-3 rounded-lg bg-white/5 border border-white/10 hover:border-white/20 text-xs text-slate-200">
                    I didn't hear it
                  </button>
                </>
              )}
            </div>
            {speaker === 'not_heard' && (
              <p className="mt-2 text-xs text-amber-200">
                Turn up the volume, check this tab isn't muted (right-click the tab), and pick the right output device in your system sound settings. Then play the sound again.
              </p>
            )}
          </Row>
        </div>
      </div>

      <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3 text-xs text-slate-400 space-y-1">
        <div className="flex items-center gap-2"><Info className="w-3.5 h-3.5 text-cyan-400" /> Browser features</div>
        <div className="flex flex-wrap gap-x-4 gap-y-1 pl-5">
          <span className={fullscreenSupported ? 'text-emerald-300' : 'text-amber-300'}>Fullscreen {fullscreenSupported ? 'available' : 'not available (it will be recorded once)'}</span>
          <span className={recorderSupported ? 'text-emerald-300' : 'text-amber-300'}>Voice recording {recorderSupported ? 'available' : 'not available, type answers instead'}</span>
          <span className={ttsSupported ? 'text-emerald-300' : 'text-amber-300'}>Spoken questions {ttsSupported ? 'available' : 'not available, read them on screen'}</span>
        </div>
      </div>

      {permissionProblem && (
        <div className="rounded-xl border border-rose-400/20 bg-rose-600/10 p-3 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 mt-0.5 text-rose-300 shrink-0" />
          <div className="flex-1 text-xs text-rose-100">
            Fix the problem above, then retry. The interview can't start until the camera, microphone and speakers all pass.
          </div>
        </div>
      )}

      {(stream || permissionProblem) && (
        <button
          type="button"
          onClick={request}
          disabled={requesting}
          className="h-8 px-3 rounded-lg bg-white/5 border border-white/10 hover:border-white/20 text-xs text-slate-200 inline-flex items-center gap-1.5 disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${requesting ? 'animate-spin' : ''}`} /> Retry device check
        </button>
      )}
    </div>
  );
}
