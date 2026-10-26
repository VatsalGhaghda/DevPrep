const mongoose = require('mongoose');

const { securityFields } = require('./schemas/assessmentSecurity');

/**
 * One proctored sitting of a coding problem. Runs and submissions must belong
 * to an active attempt; submissions reference it via Submission.attemptId.
 */
const codingAttemptSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    problemId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'CodingProblem',
      required: true,
      index: true
    },
    status: {
      type: String,
      enum: ['active', 'terminated'],
      default: 'active',
      index: true
    },
    startedAt: { type: Date, default: Date.now },
    endedAt: { type: Date, default: null },
    lastActivityAt: { type: Date, default: Date.now },
    submissionCount: { type: Number, min: 0, default: 0 },
    accepted: { type: Boolean, default: false },
    ...securityFields()
  },
  { timestamps: true }
);

codingAttemptSchema.index({ userId: 1, problemId: 1, status: 1, createdAt: -1 });

const CodingAttempt =
  mongoose.models.CodingAttempt || mongoose.model('CodingAttempt', codingAttemptSchema);

module.exports = CodingAttempt;
