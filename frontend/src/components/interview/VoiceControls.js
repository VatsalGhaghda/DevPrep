import { Keyboard, Loader2, Mic, MicOff, Pause, Play, RotateCcw, Volume2, VolumeX, AudioLines } from 'lucide-react';

/**
 * Small presentational pieces for voice interviews. All state lives in
 * useSpeechSynthesis / useSpeechToText; these only render it.
 */

export function VoiceModeToggle({ voiceMode, onChange, disabled = false }) {
  const base = 'h-9 px-3 inline-flex items-center gap-1.5 text-sm font-medium transition-colors disabled:opacity-50';
  return (
    <div
      role="group"
      aria-label="Answer mode"
      className="h-9 rounded-xl bg-black/20 border border-white/10 inline-flex overflow-hidden"
    >
      <button
        type="button"
        disabled={disabled}
        onClick={() => onChange(false)}
        aria-pressed={!voiceMode}
        title="Text mode: type your answers"
        className={`${base} ${!voiceMode ? 'bg-violet-600/30 text-violet-100' : 'text-slate-400 hover:text-slate-200'}`}
      >
        <Keyboard className="w-4 h-4" />
        <span className="hidden sm:inline">Text</span>
      </button>
      <button
        type="button"
        disabled={disabled}
        onClick={() => onChange(true)}
        aria-pressed={voiceMode}
        title="Voice mode: hear questions and answer by speaking"
        className={`${base} ${voiceMode ? 'bg-violet-600/30 text-violet-100' : 'text-slate-400 hover:text-slate-200'}`}
      >
        <AudioLines className="w-4 h-4" />
        <span className="hidden sm:inline">Voice</span>
      </button>
    </div>
  );
}

export function MicButton({ listening, processing, level = 0, disabled, onStart, onStop }) {
  if (processing) {
    return (
      <button
        type="button"
        disabled
        title="Transcribing your answer…"
        className="h-11 w-11 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center flex-shrink-0"
      >
        <Loader2 className="w-4 h-4 text-violet-300 animate-spin" />
      </button>
    );
  }
  return (
    <button
      type="button"
      onClick={listening ? onStop : onStart}
      disabled={disabled && !listening}
      aria-pressed={listening}
      aria-label={listening ? 'Stop recording' : 'Start recording your answer'}
      title={listening ? 'Stop recording' : 'Speak your answer'}
      className={`relative h-11 w-11 rounded-xl border flex items-center justify-center flex-shrink-0 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed ${
        listening
          ? 'bg-rose-600 border-rose-500 shadow-[0_0_24px_rgba(244,63,94,0.45)]'
          : 'bg-white/5 border-white/10 hover:border-violet-400/40 hover:bg-violet-600/20'
      }`}
    >
      {/* Ring grows with the real input level, so you can see the mic picking you up */}
      {listening && (
        <span
          className="absolute -inset-1 rounded-2xl border-2 border-rose-400/70 transition-transform duration-75"
          style={{ transform: `scale(${1 + Math.min(level, 1) * 0.35})` }}
        />
      )}
      {listening
        ? <MicOff className="relative w-4 h-4 text-white" />
        : <Mic className="w-4 h-4 text-slate-200" />}
    </button>
  );
}

const iconBtn = 'h-8 w-8 rounded-lg bg-white/5 border border-white/10 hover:border-white/20 flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed transition-colors';

/** Play / pause / replay / mute for the interviewer's voice. */
export function SpeechPlaybackControls({ tts, onPlayLatest, hasQuestion }) {
  const { status, muted } = tts;
  const speaking = status === 'speaking';
  const paused = status === 'paused';

  let label = 'Interviewer voice';
  if (muted) label = 'Interviewer voice muted';
  else if (speaking) label = 'Interviewer speaking…';
  else if (paused) label = 'Paused';

  return (
    <div className="flex items-center gap-2">
      <span className={`text-xs ${speaking ? 'text-cyan-300' : 'text-slate-400'} inline-flex items-center gap-1.5`}>
        {speaking && <AudioLines className="w-3.5 h-3.5 animate-pulse" />}
        {label}
      </span>
      {speaking ? (
        <button type="button" className={iconBtn} onClick={tts.pause} title="Pause" aria-label="Pause">
          <Pause className="w-3.5 h-3.5 text-slate-200" />
        </button>
      ) : paused ? (
        <button type="button" className={iconBtn} onClick={tts.resume} title="Resume" aria-label="Resume">
          <Play className="w-3.5 h-3.5 text-slate-200" />
        </button>
      ) : (
        <button
          type="button"
          className={iconBtn}
          onClick={onPlayLatest}
          disabled={!hasQuestion}
          title="Play the current question"
          aria-label="Play the current question"
        >
          <Play className="w-3.5 h-3.5 text-slate-200" />
        </button>
      )}
      <button
        type="button"
        className={iconBtn}
        onClick={onPlayLatest}
        disabled={!hasQuestion}
        title="Replay from the start"
        aria-label="Replay from the start"
      >
        <RotateCcw className="w-3.5 h-3.5 text-slate-200" />
      </button>
      <button
        type="button"
        className={`${iconBtn} ${muted ? 'border-amber-400/30 bg-amber-600/10' : ''}`}
        onClick={() => tts.setMuted(!muted)}
        title={muted ? 'Unmute (questions play automatically)' : 'Mute'}
        aria-pressed={muted}
        aria-label={muted ? 'Unmute' : 'Mute'}
      >
        {muted ? <VolumeX className="w-3.5 h-3.5 text-amber-300" /> : <Volume2 className="w-3.5 h-3.5 text-slate-200" />}
      </button>
    </div>
  );
}

/** Speaker icon on one interviewer message: play it, or stop it while it plays. */
export function MessageSpeakButton({ active, onPlay, onStop }) {
  return (
    <button
      type="button"
      onClick={active ? onStop : onPlay}
      title={active ? 'Stop' : 'Listen'}
      aria-label={active ? 'Stop reading this message' : 'Read this message aloud'}
      className={`ml-auto h-6 w-6 rounded-md flex items-center justify-center transition-colors ${
        active ? 'text-cyan-300 bg-cyan-500/10' : 'text-slate-500 hover:text-slate-200 hover:bg-white/5'
      }`}
    >
      {active ? <AudioLines className="w-3.5 h-3.5 animate-pulse" /> : <Volume2 className="w-3.5 h-3.5" />}
    </button>
  );
}

function formatElapsed(sec) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

/** Status line while recording: live level bar, timer and preview words. */
export function RecordingStatus({ stt }) {
  if (stt.phase === 'starting') {
    return <span className="text-slate-300">Starting the microphone…</span>;
  }
  const bars = 12;
  const active = Math.round(Math.min(stt.level, 1) * bars);
  const words = `${stt.preview} ${stt.interim}`.trim();
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2 text-slate-200">
        <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse flex-shrink-0" />
        <span className="font-semibold text-rose-300">Recording</span>
        <span className="font-mono text-slate-400">{formatElapsed(stt.elapsed)}</span>
        <span className="flex items-end gap-0.5 h-3" aria-label="Microphone input level">
          {Array.from({ length: bars }).map((_, i) => (
            <span
              key={i}
              className={`w-1 rounded-sm ${i < active ? 'bg-emerald-400' : 'bg-white/15'}`}
              style={{ height: `${30 + (i / bars) * 70}%` }}
            />
          ))}
        </span>
        <span className="text-slate-400">Tap the mic again when you finish.</span>
      </div>
      {words && <div className="italic text-slate-400">{words}</div>}
    </div>
  );
}
