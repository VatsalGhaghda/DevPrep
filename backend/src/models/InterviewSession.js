const mongoose = require('mongoose');

const interviewQuestionSchema = new mongoose.Schema(
  {
    text: {
      type: String,
      required: true,
      trim: true,
      maxlength: 5000
    },
    topic: {
      type: String,
      trim: true,
      maxlength: 100,
      default: ''
    }
  },
  { _id: false }
);

const interviewAnswerSchema = new mongoose.Schema(
  {
    questionIndex: {
      type: Number,
      required: true,
      min: 0
    },
    text: {
      type: String,
      required: true,
      trim: true,
      maxlength: 20000
    }
  },
  { _id: false }
);

const interviewSessionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    type: {
      type: String,
      required: true,
      enum: ['mock', 'hr', 'coding', 'resume-based'],
      index: true
    },
    role: {
      type: String,
      trim: true,
      maxlength: 100,
      default: ''
    },
    difficulty: {
      type: String,
      trim: true,
      maxlength: 50,
      default: ''
    },
    topics: {
      type: [String],
      default: []
    },
    questions: {
      type: [interviewQuestionSchema],
      default: []
    },
    answers: {
      type: [interviewAnswerSchema],
      default: []
    },
    scores: {
      type: [Number],
      default: []
    },
    overallScore: {
      type: Number,
      min: 0,
      max: 100,
      default: null
    },
    duration: {
      type: Number,
      min: 0,
      default: 0
    },
    status: {
      type: String,
      enum: ['in-progress', 'completed', 'abandoned'],
      default: 'in-progress',
      index: true
    },
    feedback: {
      type: String,
      trim: true,
      maxlength: 20000,
      default: ''
    }
  },
  { timestamps: true }
);

interviewSessionSchema.index({ userId: 1, createdAt: -1 });
interviewSessionSchema.index({ type: 1, status: 1, createdAt: -1 });

const InterviewSession =
  mongoose.models.InterviewSession ||
  mongoose.model('InterviewSession', interviewSessionSchema);

module.exports = InterviewSession;
