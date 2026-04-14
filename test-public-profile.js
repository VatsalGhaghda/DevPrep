const mongoose = require('mongoose');
require('dotenv').config();

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/devprep')
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('MongoDB connection error:', err));

const Submission = require('./backend/src/models/Submission');
const User = require('./backend/src/models/User');
const CodingProblem = require('./backend/src/models/CodingProblem');

async function checkData() {
  try {
    console.log('=== Checking Public Profile Data ===');
    
    // Find a user with submissions
    const user = await User.findOne({ clerkUserId: { $exists: true } }).lean();
    if (!user) {
      console.log('No user found with clerkUserId');
      return;
    }
    
    console.log('Found user:', user._id, user.clerkUserId);
    
    // Check submissions for this user
    const matchUser = user.clerkUserId
      ? { clerkUserId: user.clerkUserId }
      : { userId: user._id };
    
    console.log('Match user query:', matchUser);
    
    const submissions = await Submission.find(matchUser).limit(5).lean();
    console.log('Sample submissions:', submissions.length);
    submissions.forEach((sub, i) => {
      console.log(`Submission ${i+1}:`, {
        clerkUserId: sub.clerkUserId,
        userId: sub.userId,
        status: sub.status,
        isDraft: sub.isDraft,
        problemId: sub.problemId
      });
    });
    
    // Test the aggregation like in the backend
    const solvedAgg = await Submission.aggregate([
      { $match: { ...matchUser, status: 'accepted', isDraft: false } },
      { $group: { _id: '$problemId' } },
      {
        $lookup: {
          from: 'codingproblems',
          localField: '_id',
          foreignField: '_id',
          as: 'problem'
        }
      },
      { $unwind: '$problem' },
      { $group: { _id: '$problem.difficulty', count: { $sum: 1 } } }
    ]);
    
    console.log('Solved aggregation result:', solvedAgg);
    
    const totalProblemsAgg = await CodingProblem.aggregate([
      { $group: { _id: '$difficulty', count: { $sum: 1 } } }
    ]);
    
    console.log('Total problems aggregation result:', totalProblemsAgg);
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    process.exit(0);
  }
}

checkData();
