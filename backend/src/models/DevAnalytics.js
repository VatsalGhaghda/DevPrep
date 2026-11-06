const mongoose = require('mongoose');

/**
 * One document per user: their connected GitHub / LeetCode / Codeforces
 * profiles, the latest synced data for each, and the daily activity history.
 *
 * activity.<platform> is { 'YYYY-MM-DD': count }. Each sync replaces only the
 * days its source covers (for example the last 12 months on LeetCode), so
 * older days are kept and the history grows past what the platforms expose.
 */
const connectionSchema = new mongoose.Schema(
  {
    username: { type: String, required: true, trim: true, maxlength: 60 },
    profileUrl: { type: String, trim: true, maxlength: 200 },
    // connected: verified and synced; unverified: saved while the platform was unreachable
    status: { type: String, enum: ['connected', 'unverified', 'not_found', 'error'], default: 'connected' },
    connectedAt: { type: Date, default: Date.now },
    lastSyncedAt: { type: Date, default: null },
    lastAttemptAt: { type: Date, default: null },
    lastError: { type: String, default: null, maxlength: 500 }
  },
  { _id: false }
);

const devAnalyticsSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true, index: true },
    connections: {
      github: { type: connectionSchema, default: null },
      leetcode: { type: connectionSchema, default: null },
      codeforces: { type: connectionSchema, default: null }
    },
    data: {
      github: { type: mongoose.Schema.Types.Mixed, default: null },
      leetcode: { type: mongoose.Schema.Types.Mixed, default: null },
      codeforces: { type: mongoose.Schema.Types.Mixed, default: null }
    },
    activity: {
      github: { type: mongoose.Schema.Types.Mixed, default: () => ({}) },
      leetcode: { type: mongoose.Schema.Types.Mixed, default: () => ({}) },
      codeforces: { type: mongoose.Schema.Types.Mixed, default: () => ({}) }
    }
  },
  { timestamps: true, minimize: false }
);

module.exports = mongoose.model('DevAnalytics', devAnalyticsSchema);
