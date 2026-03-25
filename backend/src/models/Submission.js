const mongoose = require('mongoose');

const submissionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    clerkUserId: {
      type: String,
      default: '',
      index: true
    },
    problemId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'CodingProblem',
      required: true,
      index: true
    },
    language: {
      type: String,
      required: true,
      default: 'javascript',
      trim: true
    },
    code: {
      type: String,
      required: true,
      maxlength: 100000
    },
    status: {
      type: String,
      enum: [
        'accepted',
        'wrong_answer',
        'runtime_error',
        'compile_error',
        'time_limit',
        'memory_limit',
        'pending',
        'draft'
      ],
      default: 'pending'
    },
    passedTests: {
      type: Number,
      default: 0
    },
    totalTests: {
      type: Number,
      default: 0
    },
    runtime: {
      type: String,
      default: ''
    },
    memory: {
      type: String,
      default: ''
    },
    errorOutput: {
      type: String,
      default: '',
      maxlength: 10000
    },
    isDraft: {
      type: Boolean,
      default: false
    }
  },
  { timestamps: true }
);

submissionSchema.index({ userId: 1, problemId: 1 });
submissionSchema.index({ clerkUserId: 1, problemId: 1 });
submissionSchema.index({ problemId: 1, status: 1 });

const Submission =
  mongoose.models.Submission ||
  mongoose.model('Submission', submissionSchema);

module.exports = Submission;
