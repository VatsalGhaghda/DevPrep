import { ShieldCheck, ShieldAlert } from 'lucide-react';

/** Compact header badge showing proctoring state and violation count. */
const ProctorBadge = ({ security, className = '' }) => {
  const policy = security?.policy;
  if (!policy?.enabled) return null;

  const count = security.violationCount || 0;
  const warn = count > 0;
  const Icon = warn ? ShieldAlert : ShieldCheck;

  return (
    <div
      className={`px-3 h-9 rounded-xl border inline-flex items-center gap-2 text-xs font-medium ${
        security.flagged
          ? 'bg-rose-600/15 border-rose-400/30 text-rose-300'
          : warn
            ? 'bg-amber-600/15 border-amber-400/30 text-amber-300'
            : 'bg-emerald-600/10 border-emerald-400/25 text-emerald-300'
      } ${className}`}
      title="Proctored assessment — violations are recorded"
    >
      <Icon className="w-4 h-4" />
      Proctored · {count}/{policy.maxViolations}
    </div>
  );
};

export default ProctorBadge;
