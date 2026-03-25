const mongoose = require('mongoose');

const codingExampleSchema = new mongoose.Schema(
  {
    input: {
      type: String,
      trim: true,
      default: ''
    },
    output: {
      type: String,
      trim: true,
      default: ''
    },
    explanation: {
      type: String,
      trim: true,
      default: ''
    }
  },
  { _id: false }
);

const codingTestCaseSchema = new mongoose.Schema(
  {
    input: {
      type: String,
      required: true,
      trim: true
    },
    expectedOutput: {
      type: String,
      required: true,
      trim: true
    },
    isHidden: {
      type: Boolean,
      default: false
    }
  },
  { _id: false }
);

const codingProblemSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200
    },
    slug: {
      type: String,
      unique: true,
      sparse: true,
      trim: true,
      maxlength: 300
    },
    description: {
      type: String,
      required: true,
      trim: true,
      maxlength: 50000
    },
    difficulty: {
      type: String,
      required: true,
      enum: ['easy', 'medium', 'hard'],
      index: true
    },
    category: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
      index: true
    },
    tags: {
      type: [String],
      default: [],
      index: true
    },
    examples: {
      type: [codingExampleSchema],
      default: []
    },
    testCases: {
      type: [codingTestCaseSchema],
      default: []
    },
    constraints: {
      type: String,
      trim: true,
      maxlength: 20000,
      default: ''
    },
    inputFormat: {
      type: String,
      trim: true,
      maxlength: 10000,
      default: ''
    },
    outputFormat: {
      type: String,
      trim: true,
      maxlength: 10000,
      default: ''
    },
    hints: {
      type: [String],
      default: []
    },
    starterCode: {
      type: Map,
      of: String,
      default: {}
    },
    solution: {
      type: String,
      trim: true,
      maxlength: 50000,
      default: ''
    },
    acceptanceRate: {
      type: Number,
      default: 0,
      min: 0,
      max: 100
    },
    totalSubmissions: {
      type: Number,
      default: 0
    },
    totalAccepted: {
      type: Number,
      default: 0
    },
    source: {
      type: String,
      trim: true,
      default: ''
    },
    sourceId: {
      type: String,
      trim: true,
      default: ''
    }
  },
  { timestamps: true }
);

codingProblemSchema.index({ difficulty: 1, category: 1, createdAt: -1 });
codingProblemSchema.index({ source: 1, sourceId: 1 }, { unique: true, sparse: true });
codingProblemSchema.index({ title: 'text', tags: 'text' });

const CodingProblem =
  mongoose.models.CodingProblem ||
  mongoose.model('CodingProblem', codingProblemSchema);

module.exports = CodingProblem;
