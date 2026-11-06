import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ShieldCheck,
  Maximize,
  MonitorX,
  ClipboardX,
  KeyboardOff,
  AlertTriangle,
  Server
} from 'lucide-react';

/**
 * Rules screen shown before a proctored assessment starts (and again after a
 * reload, since fullscreen can only be entered from a click).
 */
const AssessmentGate = ({
  open,
  title = 'Secure Assessment',
  subtitle,
  security,
  starting = false,
  startLabel = 'I Understand — Start',
  onStart,
  onCancel,
  cancelLabel = 'Go Back',
  // Optional pre-check (e.g. device setup) shown above the rules
  children,
  // Keeps Start disabled until the pre-check passes
  startDisabled = false,
  startHint
}) => {
  const [agreed, setAgreed] = useState(false);
  useEffect(() => {
    if (open) setAgreed(false);
  }, [open]);

  const policy = security?.policy || {};
  const count = security?.violationCount || 0;
  const resuming = count > 0;

  const rules = [
    policy.fullscreenRequired && {
      Icon: Maximize,
      text: 'The assessment runs in fullscreen. Leaving fullscreen pauses it and is recorded.'
    },
    {
      Icon: MonitorX,
      text: 'Stay on this tab and window. Switching tabs or apps is recorded.'
    },
    {
      Icon: ClipboardX,
      text: 'Copy, cut, paste, right-click and drag-and-drop are disabled.'
    },
    {
      Icon: KeyboardOff,
      text: 'Developer tools, view source, save, print and reload shortcuts are blocked.'
    },
    {
      Icon: Server,
      text: 'Each violation is logged with a timestamp on the server for review.'
    }
  ].filter(Boolean);

  const outcome = policy.onExceed === 'flag'
    ? 'the assessment will be flagged for review'
    : 'the assessment will be terminated';

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[100] flex overflow-y-auto p-4 bg-black/70 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="assessment-gate-title"
        >
          <motion.div
            className={`m-auto w-full ${children ? 'max-w-3xl' : 'max-w-lg'} rounded-2xl border border-white/10 bg-[#0b1220]/95 shadow-[0_10px_40px_rgba(0,0,0,0.55)] overflow-hidden`}
            initial={{ opacity: 0, y: 12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 180, damping: 20 }}
          >
            <div className="px-6 pt-6 pb-4 border-b border-white/10 flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-violet-600/20 border border-violet-400/20 flex items-center justify-center shrink-0">
                <ShieldCheck className="w-5 h-5 text-violet-300" />
              </div>
              <div className="min-w-0">
                <div id="assessment-gate-title" className="text-lg font-semibold text-slate-100">
                  {resuming ? `Resume ${title}` : title}
                </div>
                {subtitle && <div className="text-xs text-slate-400 mt-0.5">{subtitle}</div>}
              </div>
            </div>

            <div className="px-6 py-5 space-y-4">
              {children && (
                <div className="pb-4 border-b border-white/10">
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-3">Step 1 · Device check</div>
                  {children}
                </div>
              )}
              {children && (
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Step 2 · Rules</div>
              )}
              <ul className="space-y-3">
                {rules.map(({ Icon, text }) => (
                  <li key={text} className="flex items-start gap-3 text-sm text-slate-300">
                    <Icon className="w-4 h-4 mt-0.5 text-cyan-400 shrink-0" />
                    <span>{text}</span>
                  </li>
                ))}
              </ul>

              <div className="rounded-xl border border-amber-400/20 bg-amber-500/10 p-3 flex items-start gap-3">
                <AlertTriangle className="w-4 h-4 mt-0.5 text-amber-400 shrink-0" />
                <div className="text-sm text-amber-100/90">
                  After <span className="font-semibold">{policy.maxViolations}</span> violation
                  {policy.maxViolations === 1 ? '' : 's'}, {outcome}.
                  {resuming && (
                    <span className="block mt-1 text-amber-200">
                      {count} violation{count === 1 ? '' : 's'} already recorded in this session.
                    </span>
                  )}
                </div>
              </div>

              <p className="text-xs text-slate-500">
                Monitoring covers this browser window only. It records activity; it cannot see other devices or apps.
              </p>

              <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={agreed}
                  onChange={(e) => setAgreed(e.target.checked)}
                  className="w-4 h-4 rounded accent-violet-500"
                />
                I have read the rules above
              </label>
            </div>

            <div className="px-6 py-4 border-t border-white/10 flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-2">
              {startDisabled && startHint && (
                <span className="text-xs text-slate-400 sm:mr-auto">{startHint}</span>
              )}
              {onCancel && (
                <button
                  type="button"
                  onClick={onCancel}
                  disabled={starting}
                  className="h-10 px-4 rounded-xl bg-white/5 border border-white/10 hover:border-white/20 text-slate-200 text-sm disabled:opacity-50"
                >
                  {cancelLabel}
                </button>
              )}
              <button
                type="button"
                onClick={onStart}
                disabled={!agreed || starting || startDisabled}
                className="h-10 px-5 rounded-xl bg-violet-600 hover:bg-violet-700 border border-violet-500 text-white text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {starting ? 'Starting…' : resuming ? 'Resume' : startLabel}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default AssessmentGate;
