const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    clerkUserId: {
      type: String,
      unique: true,
      sparse: true,
      index: true
    },
    username: {
      type: String,
      trim: true,
      lowercase: true,
      maxlength: 50,
      unique: true,
      sparse: true,
      index: true,
      set: (v) => (v === '' ? undefined : v)
    },
    name: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 100
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      maxlength: 254,
      match: [/^\S+@\S+\.\S+$/, 'Invalid email address']
    },
    isEmailVerified: {
      type: Boolean,
      default: false
    },
    role: {
      type: String,
      enum: ['user', 'admin'],
      default: 'user'
    },
    skills: {
      type: [String],
      default: []
    },
    targetRole: {
      type: String,
      trim: true,
      maxlength: 100,
      default: ''
    },
    experienceLevel: {
      type: String,
      enum: ['Beginner', 'Intermediate', 'Advanced', 'Expert'],
      default: 'Beginner'
    },
    bio: {
      type: String,
      trim: true,
      maxlength: 1000,
      default: ''
    },
    avatar: {
      type: String,
      trim: true,
      // data: URLs from the avatar upload (1 MB image ≈ 1.4 MB base64)
      maxlength: 1500000,
      default: ''
    },
    // Show this user in search and on /profile/:username
    isProfilePublic: {
      type: Boolean,
      default: true
    }
  },
  { timestamps: true }
);

const User = mongoose.models.User || mongoose.model('User', userSchema);

module.exports = User;
