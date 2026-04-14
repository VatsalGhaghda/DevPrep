const mongoose = require('mongoose');
require('dotenv').config();

// Import models
const MockInterviewSession = require('./backend/src/models/MockInterviewSession');
const Submission = require('./backend/src/models/Submission');
const SavedQuestion = require('./backend/src/models/SavedQuestion');
const Resume = require('./backend/src/models/Resume');

async function testProfileInsights() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/devprep');
    console.log('Connected to MongoDB');

    // Test user ID (you might need to change this)
    const userId = new mongoose.Types.ObjectId('YOUR_USER_ID_HERE');
    
    // Check mock interviews
    const totalMockSessions = await MockInterviewSession.countDocuments({ userId });
    const resumeInterviews = await MockInterviewSession.countDocuments({ 
      userId, 
      interviewType: 'resume-based' 
    });
    
    // Check solved coding problems
    const solvedProblems = await Submission.distinct('problemId', { 
      userId, 
      status: 'accepted', 
      isDraft: false 
    });
    
    // Check saved questions
    const savedQuestions = await SavedQuestion.countDocuments({ userId });
    
    // Check resumes
    const resumeCount = await Resume.countDocuments({ userId });
    
    console.log('Test Results:');
    console.log('Total Mock Sessions:', totalMockSessions);
    console.log('Resume Interviews:', resumeInterviews);
    console.log('Solved Coding Problems:', solvedProblems.length);
    console.log('Saved Questions:', savedQuestions);
    console.log('Resume Count:', resumeCount);
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.disconnect();
  }
}

testProfileInsights();
