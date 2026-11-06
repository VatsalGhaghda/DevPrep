const mongoose = require('mongoose');

const { securityFields } = require('./schemas/assessmentSecurity');

const messageSchema = new mongoose.Schema(
  {
    role: {
      type: String,
      required: true,
      enum: ['interviewer', 'user']
    },
    content: {
      type: String,
      required: true,
      trim: true,
      maxlength: 20000
    },
    timestamp: {
      type: Date,
      default: Date.now
    }
  },
  { _id: true }
);

const topicFeedbackSchema = new mongoose.Schema(
  {
    topic: { type: String, default: '' },
    score: { type: Number, min: 0, max: 100, default: 0 },
    comments: { type: String, default: '' }
  },
  { _id: false }
);

const evaluationSchema = new mongoose.Schema(
  {
    overallScore: { type: Number, min: 0, max: 100, default: 0 },
    strengths: { type: [String], default: [] },
    weaknesses: { type: [String], default: [] },
    topicFeedback: { type: [topicFeedbackSchema], default: [] },
    communicationFeedback: { type: String, default: '' },
    technicalDepthFeedback: { type: String, default: '' },
    improvementTips: { type: [String], default: [] },
    recommendedNextSteps: { type: [String], default: [] },
    summary: { type: String, default: '' }
  },
  { _id: false }
);

const mockInterviewSessionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    interviewType: {
      type: String,
      required: true,
      enum: ['technical', 'hr', 'mixed', 'resume-based']
    },
    role: {
      type: String,
      trim: true,
      maxlength: 100,
      default: 'Software Developer'
    },
    difficulty: {
      type: String,
      enum: ['easy', 'medium', 'hard'],
      default: 'medium'
    },
    duration: {
      type: Number,
      enum: [15, 30, 45, 60],
      default: 30
    },
    selectedTopics: {
      type: [String],
      default: []
    },
    resumeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Resume',
      default: null
    },
    resumeContext: {
      type: String,
      trim: true,
      maxlength: 10000,
      default: ''
    },
    status: {
      type: String,
      // ready = created, waiting for the candidate to finish the device check and press Start.
      // terminated = ended by the proctoring violation limit
      enum: ['ready', 'active', 'completed', 'abandoned', 'terminated'],
      default: 'active',
      index: true
    },
    startedAt: {
      type: Date,
      default: Date.now
    },
    endedAt: {
      type: Date,
      default: null
    },
    currentQuestionNumber: {
      type: Number,
      default: 1
    },
    messages: {
      type: [messageSchema],
      default: []
    },
    evaluation: {
      type: evaluationSchema,
      default: null
    },
    // none: not requested (abandoned/terminated) · success · failed (AI error, can be retried)
    evaluationStatus: {
      type: String,
      enum: ['none', 'success', 'failed'],
      default: 'none'
    },
    // Set while the AI is writing a reply, so a second message can't be sent
    // concurrently and interleave with the first.
    awaitingReplySince: {
      type: Date,
      default: null
    },
    // Sessions created before proctoring existed keep securityPolicy.enabled = false
    ...securityFields()
  },
  { timestamps: true }
);

mockInterviewSessionSchema.index({ userId: 1, createdAt: -1 });
mockInterviewSessionSchema.index({ status: 1, createdAt: -1 });

const MockInterviewSession =
  mongoose.models.MockInterviewSession ||
  mongoose.model('MockInterviewSession', mockInterviewSessionSchema);

module.exports = MockInterviewSession;
