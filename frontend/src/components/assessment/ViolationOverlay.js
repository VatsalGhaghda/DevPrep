import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, Maximize, ShieldAlert, ShieldX } from 'lucide-react';

/**
 * Overlays driven by useSecureAssessment():
 *  - terminated: blocking screen shown once when the server terminates the
 *    assessment; its button acknowledges it and runs the page's action
 *  - paused: fullscreen was left; content hidden until it is re-entered
 *  - warning: dismissible notice after a violation
 */
const ViolationOverlay = ({
  secure,
  terminatedTitle = 'Assessment terminated',
  terminatedMessage = 'This assessment was ended because the violation limit was reached. The violations are recorded for review.',
  terminatedActionLabel = 'Continue',
  onTerminatedAction
}) => {
  const {
    security, warning, paused, terminatedNow, acknowledgeTermination, dismissWarning, requestFullscreen,
    fullscreenFailed, waiveFullscreen
  } = secure;
  const terminated = terminatedNow;
  const policy = security?.policy || {};
  const count = security?.violationCount || 0;
  const max = policy.maxViolations || 0;
  const remaining = Math.max(0, max - count);
  const finalWarning = count >= (policy.warningThreshold || max);

  let screen = null;

  if (terminated) {
    screen = (
      <div className="w-full max-w-md rounded-2xl border border-rose-500/30 bg-[#1a0b12]/95 p-6 text-center shadow-[0_10px_40px_rgba(0,0,0,0.55)]">
        <ShieldX className="w-10 h-10 text-rose-400 mx-auto" />
        <div className="mt-3 text-lg font-semibold text-rose-200">{terminatedTitle}</div>
        <p className="mt-2 text-sm text-slate-300">{terminatedMessage}</p>
        <div className="mt-1 text-xs text-slate-500">{count} violation{count === 1 ? '' : 's'} recorded</div>
        <button
          type="button"
          onClick={() => { acknowledgeTermination(); onTerminatedAction?.(); }}
          className="mt-5 h-10 px-5 rounded-xl bg-white/10 border border-white/15 hover:bg-white/15 text-slate-100 text-sm font-semibold"
        >
          {terminatedActionLabel}
        </button>
      </div>
    );
  } else if (paused) {
    screen = (
      <div className="w-full max-w-md rounded-2xl border border-amber-400/30 bg-[#17130a]/95 p-6 text-center shadow-[0_10px_40px_rgba(0,0,0,0.55)]">
        <Maximize className="w-10 h-10 text-amber-300 mx-auto" />
        <div className="mt-3 text-lg font-semibold text-amber-100">Assessment paused</div>
        <p className="mt-2 text-sm text-slate-300">
          Fullscreen is required. Return to fullscreen to continue. Your timer keeps running.
        </p>
        {max > 0 && (
          <div className="mt-1 text-xs text-slate-400">
            Violations: {count} / {max}
          </div>
        )}
        {fullscreenFailed && (
          <p className="mt-3 text-xs text-amber-200">
            Your browser didn't allow fullscreen. You can continue without it; this is recorded as one violation.
          </p>
        )}
        <div className="mt-5 flex flex-col sm:flex-row items-center justify-center gap-2">
          <button
            type="button"
            onClick={() => { dismissWarning(); requestFullscreen(); }}
            className="h-10 px-5 rounded-xl bg-amber-500/90 hover:bg-amber-500 text-black text-sm font-semibold"
          >
            Return to fullscreen
          </button>
          {fullscreenFailed && (
            <button
              type="button"
              onClick={waiveFullscreen}
              className="h-10 px-5 rounded-xl bg-white/5 border border-white/15 hover:bg-white/10 text-slate-200 text-sm"
            >
              Continue without fullscreen
            </button>
          )}
        </div>
      </div>
    );
  } else if (warning) {
    screen = (
      <div
        className={`w-full max-w-md rounded-2xl border p-6 text-center shadow-[0_10px_40px_rgba(0,0,0,0.55)] ${
          finalWarning ? 'border-rose-500/40 bg-[#1a0b12]/95' : 'border-amber-400/30 bg-[#17130a]/95'
        }`}
      >
        {finalWarning
          ? <ShieldAlert className="w-10 h-10 text-rose-400 mx-auto" />
          : <AlertTriangle className="w-10 h-10 text-amber-300 mx-auto" />}
        <div className={`mt-3 text-lg font-semibold ${finalWarning ? 'text-rose-200' : 'text-amber-100'}`}>
          {finalWarning ? 'Final warning' : 'Violation recorded'}
        </div>
        <p className="mt-2 text-sm text-slate-300">{warning.message}</p>
        <div className="mt-1 text-xs text-slate-400">
          Violations: {count} / {max}
          {remaining > 0 && ` — ${remaining} more and the assessment will be ${policy.onExceed === 'flag' ? 'flagged' : 'terminated'}`}
        </div>
        <button
          type="button"
          onClick={dismissWarning}
          autoFocus
          className="mt-5 h-10 px-5 rounded-xl bg-violet-600 hover:bg-violet-700 border border-violet-500 text-white text-sm font-semibold"
        >
          Return to assessment
        </button>
      </div>
    );
  }

  return (
    <AnimatePresence>
      {screen && (
        <motion.div
          key={terminated ? 'terminated' : paused ? 'paused' : 'warning'}
          className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/75 backdrop-blur-md"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          role="alertdialog"
          aria-modal="true"
        >
          {screen}
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default ViolationOverlay;
