const mongoose = require('mongoose');

const { securityFields } = require('./schemas/assessmentSecurity');

const quizQuestionSchema = new mongoose.Schema(
  {
    text: { type: String, required: true, trim: true, maxlength: 5000 },
    options: { type: [String], default: [] },
    correctIndex: { type: Number, min: 0, max: 3, required: true },
    topic: { type: String, trim: true, maxlength: 100, default: '' },
    explanation: { type: String, trim: true, maxlength: 2000, default: '' }
  },
  { _id: false }
);

const quizAttemptSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    role: { type: String, trim: true, maxlength: 100, default: '' },
    difficulty: { type: String, trim: true, maxlength: 50, default: '' },
    topics: { type: [String], default: [] },
    questions: { type: [quizQuestionSchema], default: [] },
    // One entry per question: chosen option index, or null when unanswered.
    answers: { type: [Number], default: [] },
    status: {
      type: String,
      // ready: generated, timer not started · active: in progress
      enum: ['ready', 'active', 'submitted', 'abandoned', 'terminated'],
      default: 'ready',
      index: true
    },
    timeLimitSec: { type: Number, min: 0, default: 0 },
    startedAt: { type: Date, default: null },
    expiresAt: { type: Date, default: null },
    submittedAt: { type: Date, default: null },
    // Submitted after expiresAt + grace period
    late: { type: Boolean, default: false },
    score: {
      correct: { type: Number, default: 0 },
      total: { type: Number, default: 0 },
      pct: { type: Number, default: 0 }
    },
    retakeOf: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'QuizAttempt',
      default: null
    },
    ...securityFields()
  },
  { timestamps: true }
);

quizAttemptSchema.index({ userId: 1, createdAt: -1 });

const QuizAttempt = mongoose.models.QuizAttempt || mongoose.model('QuizAttempt', quizAttemptSchema);

module.exports = QuizAttempt;
