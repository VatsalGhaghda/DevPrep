const mongoose = require('mongoose');

const VIOLATION_TYPES = [
  'tab_switch',
  'window_blur',
  'fullscreen_exit',
  'copy_attempt',
  'paste_attempt',
  'devtools_open',
  'shortcut_blocked'
];

const violationSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: VIOLATION_TYPES,
      required: true
    },
    details: {
      type: String,
      trim: true,
      maxlength: 200,
      default: ''
    },
    timestamp: {
      type: Date,
      default: Date.now
    }
  },
  { _id: true }
);

// Policy is copied onto each assessment when it is created so that later
// config changes never alter how an in-flight assessment is judged.
const securityPolicySchema = new mongoose.Schema(
  {
    enabled: { type: Boolean, default: false },
    maxViolations: { type: Number, min: 1, default: 3 },
    warningThreshold: { type: Number, min: 1, default: 2 },
    onExceed: { type: String, enum: ['terminate', 'flag'], default: 'terminate' },
    fullscreenRequired: { type: Boolean, default: true }
  },
  { _id: false }
);

// Fields shared by every proctored assessment document. Spread into a schema
// definition: new mongoose.Schema({ ...ownFields, ...securityFields() }).
function securityFields() {
  return {
    securityPolicy: {
      type: securityPolicySchema,
      default: () => ({})
    },
    violations: {
      type: [violationSchema],
      default: []
    },
    // Kept separately because the violations array is capped in size.
    violationCount: {
      type: Number,
      min: 0,
      default: 0
    },
    flagged: {
      type: Boolean,
      default: false
    },
    // The browser couldn't enter fullscreen and the candidate continued
    // without it (recorded once as a violation; not charged again on resume)
    fullscreenWaived: {
      type: Boolean,
      default: false
    },
    terminationReason: {
      type: String,
      enum: ['', 'violations'],
      default: ''
    }
  };
}

module.exports = { VIOLATION_TYPES, violationSchema, securityPolicySchema, securityFields };
