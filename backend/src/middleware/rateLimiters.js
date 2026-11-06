/**
 * rateLimiters.js — Route-level rate limiters for expensive AI endpoints.
 *
 * Uses express-rate-limit with a Clerk-user-aware key function so that
 * each authenticated user gets their own independent counter.
 * Unauthenticated requests (should not reach AI routes) are keyed by IP.
 *
 * Why per-user instead of per-IP?
 *   - Multiple users can share an IP (NAT, office, VPN).
 *   - A single abusive account behind a shared IP shouldn't throttle others.
 *   - Per-user limits directly protect Groq API quotas and billing.
 *
 * Limits (tuned for Groq free tier):
 *   AI Question Generation : 20 requests / 10 minutes per user
 *   Mock Interview Messages: 60 messages / 10 minutes per user
 *   Code Execution         : 30 runs/submits / 5 minutes per user, plus
 *                            executionLimiter for concurrency
 */

const rateLimit = require('express-rate-limit');

// Derive a stable key from the Clerk userId (populated by clerkAuthMiddleware)
// or fall back to IP address for safety.
function clerkUserKeyGenerator(req) {
  // After clerkAuthMiddleware(), req.auth.userId is the Clerk user ID
  const userId = req.auth && req.auth.userId;
  return userId || req.ip;
}

function buildLimiter({ windowMs, max, name }) {
  return rateLimit({
    windowMs,
    max,
    standardHeaders: 'draft-8', // Send RateLimit-* headers (RFC 6585)
    legacyHeaders: false,
    keyGenerator: clerkUserKeyGenerator,
    handler: (req, res) => {
      res.status(429).json({
        error: 'Too Many Requests',
        message: `You are sending ${name} requests too quickly. Please slow down.`,
        retryAfter: Math.ceil(windowMs / 1000)
      });
    },
    // Skip successful responses from the count (only count actual requests)
    skipSuccessfulRequests: false,
  });
}

// ── AI Question Generation ────────────────────────────────────────────────────
// Each call makes 1-2 Groq API calls. Limit to 20 per 10 minutes.
const questionGenerationLimiter = buildLimiter({
  windowMs: 10 * 60 * 1000,  // 10 minutes
  max: 20,
  name: 'question generation'
});

// ── Mock Interview Messages ────────────────────────────────────────────────────
// Each message makes 1 Groq API call. Limit to 60 per 10 minutes (~6/min).
const mockInterviewMessageLimiter = buildLimiter({
  windowMs: 10 * 60 * 1000,  // 10 minutes
  max: 60,
  name: 'mock interview'
});

// ── Mock Interview Session Start ──────────────────────────────────────────────
// Starting a session makes 1 Groq call. Limit to 10 per 10 minutes.
const mockInterviewStartLimiter = buildLimiter({
  windowMs: 10 * 60 * 1000,  // 10 minutes
  max: 10,
  name: 'mock interview session'
});

// ── Voice answer transcription ─────────────────────────────────────────────────
// Each request sends one recording to Groq Whisper. 40 per 10 minutes.
const voiceTranscriptionLimiter = buildLimiter({
  windowMs: 10 * 60 * 1000,
  max: 40,
  name: 'voice transcription'
});

// ── Developer analytics sync ──────────────────────────────────────────────────
// Each sync calls GitHub / LeetCode / Codeforces. 30 per 10 minutes per user.
const devAnalyticsSyncLimiter = buildLimiter({
  windowMs: 10 * 60 * 1000,
  max: 30,
  name: 'analytics sync'
});

// ── Code execution (run / submit) ─────────────────────────────────────────────
// Each request starts a sandbox container. 30 per 5 minutes per user.
const codeExecutionLimiter = buildLimiter({
  windowMs: 5 * 60 * 1000,
  max: parseInt(process.env.CODE_EXECUTION_RATE_LIMIT || '30', 10),
  name: 'code execution'
});

// ── Public endpoints (search, public profiles) ───────────────────────────────
// Keyed by IP. 60 per minute.
const publicLimiter = buildLimiter({
  windowMs: 60 * 1000,
  max: 60,
  name: 'public profile'
});

// ── Legacy email/password auth ───────────────────────────────────────────────
const authLimiter = buildLimiter({
  windowMs: 15 * 60 * 1000,
  max: 20,
  name: 'authentication'
});

module.exports = {
  codeExecutionLimiter,
  publicLimiter,
  authLimiter,
  questionGenerationLimiter,
  mockInterviewMessageLimiter,
  mockInterviewStartLimiter,
  voiceTranscriptionLimiter,
  devAnalyticsSyncLimiter
};
