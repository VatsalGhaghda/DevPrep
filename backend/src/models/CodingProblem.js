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
    hints: {
      type: [String],
      default: []
    },
    solution: {
      type: String,
      trim: true,
      maxlength: 50000,
      default: ''
    }
  },
  { timestamps: true }
);

codingProblemSchema.index({ difficulty: 1, category: 1, createdAt: -1 });

const CodingProblem =
  mongoose.models.CodingProblem ||
  mongoose.model('CodingProblem', codingProblemSchema);

module.exports = CodingProblem;
