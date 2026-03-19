const mongoose = require('mongoose');

const savedQuestionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
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
    question: {
      type: String,
      required: true,
      trim: true,
      maxlength: 5000
    },
    questionKey: {
      type: String,
      required: true,
      trim: true,
      index: true
    },
    options: {
      type: [String],
      default: []
    },
    correctIndex: {
      type: Number,
      min: 0,
      max: 3,
      default: 0
    },
    topic: {
      type: String,
      trim: true,
      maxlength: 100,
      default: ''
    },
    explanation: {
      type: String,
      trim: true,
      maxlength: 2000,
      default: ''
    }
  },
  { timestamps: true }
);

savedQuestionSchema.index({ userId: 1, questionKey: 1 }, { unique: true });

const SavedQuestion = mongoose.models.SavedQuestion || mongoose.model('SavedQuestion', savedQuestionSchema);

module.exports = SavedQuestion;
