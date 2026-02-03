const mongoose = require('mongoose');

const resumeItemSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      trim: true,
      default: ''
    },
    description: {
      type: String,
      trim: true,
      default: ''
    },
    startDate: {
      type: String,
      trim: true,
      default: ''
    },
    endDate: {
      type: String,
      trim: true,
      default: ''
    }
  },
  { _id: false }
);

const extractedDataSchema = new mongoose.Schema(
  {
    skills: {
      type: [String],
      default: []
    },
    projects: {
      type: [resumeItemSchema],
      default: []
    },
    experience: {
      type: [resumeItemSchema],
      default: []
    },
    education: {
      type: [resumeItemSchema],
      default: []
    }
  },
  { _id: false }
);

const resumeSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    fileName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 255
    },
    filePath: {
      type: String,
      required: true,
      trim: true,
      maxlength: 2000
    },
    extractedData: {
      type: extractedDataSchema,
      default: () => ({})
    },
    uploadDate: {
      type: Date,
      default: Date.now,
      index: true
    }
  },
  { timestamps: true }
);

resumeSchema.index({ userId: 1, uploadDate: -1 });

const Resume = mongoose.models.Resume || mongoose.model('Resume', resumeSchema);

module.exports = Resume;
