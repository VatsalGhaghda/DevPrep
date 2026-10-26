/**
 * assessmentSecurity.js — server-side half of the secure assessment environment.
 *
 * The browser detects suspicious events (tab switch, fullscreen exit, ...) and
 * reports them here. The server is the source of truth for the violation count
 * and for whether an assessment has been flagged or terminated, so a client
 * cannot reset its own count by reloading or editing local state.
 *
 * Policy is configured with environment variables:
 *   ASSESSMENT_PROCTORING          on | off            (default on)
 *   ASSESSMENT_MAX_VIOLATIONS      integer >= 1        (default 3)
 *   ASSESSMENT_WARNING_THRESHOLD   integer >= 1        (default 2)
 *   ASSESSMENT_ON_EXCEED           terminate | flag    (default terminate)
 *   ASSESSMENT_FULLSCREEN_REQUIRED true | false        (default true)
 */

const { VIOLATION_TYPES } = require('../models/schemas/assessmentSecurity');

// Upper bound on stored violation entries per assessment (count keeps going).
const MAX_STORED_VIOLATIONS = 100;

// A repeat of the same violation type inside this window is treated as the
// same incident (e.g. blur + fullscreen exit firing for one Alt+Tab).
const DUPLICATE_WINDOW_MS = 1500;

// details value the client sends when the browser refused fullscreen and the
// candidate chose to continue without it
const FULLSCREEN_UNAVAILABLE = 'fullscreen unavailable';

function positiveInt(value, fallback) {
  const n = parseInt(value, 10);
  return Number.isFinite(n) && n >= 1 ? n : fallback;
}

function buildSecurityPolicy() {
  const env = process.env;
  const maxViolations = positiveInt(env.ASSESSMENT_MAX_VIOLATIONS, 3);
  const warningThreshold = Math.min(positiveInt(env.ASSESSMENT_WARNING_THRESHOLD, 2), maxViolations);

  return {
    enabled: String(env.ASSESSMENT_PROCTORING || 'on').toLowerCase() !== 'off',
    maxViolations,
    warningThreshold,
    onExceed: env.ASSESSMENT_ON_EXCEED === 'flag' ? 'flag' : 'terminate',
    fullscreenRequired: String(env.ASSESSMENT_FULLSCREEN_REQUIRED || 'true').toLowerCase() !== 'false'
  };
}

/**
 * Record a violation on an assessment document (mutates, does not save).
 *
 * @returns {{ recorded: boolean, shouldTerminate: boolean }}
 *   shouldTerminate is true when this violation crossed the limit and the
 *   policy says to terminate. The caller applies its own terminal status.
 */
function recordViolation(doc, { type, details = '' }) {
  const policy = doc.securityPolicy || {};
  if (!policy.enabled) return { recorded: false, shouldTerminate: false };

  const waivingFullscreen = type === 'fullscreen_exit' && details === FULLSCREEN_UNAVAILABLE;
  if (waivingFullscreen) {
    // Charged once per assessment, not on every resume
    if (doc.fullscreenWaived) return { recorded: false, shouldTerminate: false };
    doc.fullscreenWaived = true;
  }

  const now = new Date();
  const last = doc.violations.length ? doc.violations[doc.violations.length - 1] : null;
  if (last && last.type === type && now - new Date(last.timestamp) < DUPLICATE_WINDOW_MS) {
    return { recorded: false, shouldTerminate: false };
  }

  if (doc.violations.length < MAX_STORED_VIOLATIONS) {
    doc.violations.push({ type, details: String(details || '').slice(0, 200), timestamp: now });
  }
  doc.violationCount = (doc.violationCount || 0) + 1;

  const exceeded = doc.violationCount >= policy.maxViolations;
  if (exceeded) doc.flagged = true;

  const shouldTerminate = exceeded && policy.onExceed === 'terminate' && !doc.terminationReason;
  if (shouldTerminate) doc.terminationReason = 'violations';

  return { recorded: true, shouldTerminate };
}

/** Client-facing summary of an assessment's security state. */
function securitySummary(doc) {
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

module.exports = {
  VIOLATION_TYPES,
  buildSecurityPolicy,
  recordViolation,
  securitySummary
};
