const InterviewSession = require('../models/InterviewSession');

async function createInterview(req, res, next) {
  try {
    const { type, role = '', difficulty = '', topics = [] } = req.body;

    const session = await InterviewSession.create({
      userId: req.user._id,
      type,
      role,
      difficulty,
      topics,
      status: 'in-progress'
    });

    res.status(201).json({ session });
  } catch (err) {
    next(err);
  }
}

async function getInterview(req, res, next) {
  try {
    const session = await InterviewSession.findById(req.params.id);

    if (!session) {
      res.status(404);
      throw new Error('Interview session not found');
    }

    if (String(session.userId) !== String(req.user._id)) {
      res.status(403);
      throw new Error('Forbidden');
    }

    res.status(200).json({ session });
  } catch (err) {
    next(err);
  }
}

async function addQuestion(req, res, next) {
  try {
    const session = await InterviewSession.findById(req.params.id);

    if (!session) {
      res.status(404);
      throw new Error('Interview session not found');
    }

    if (String(session.userId) !== String(req.user._id)) {
      res.status(403);
      throw new Error('Forbidden');
    }

    if (session.status !== 'in-progress') {
      res.status(400);
      throw new Error('Interview session is not in progress');
    }

    const { text, topic = '' } = req.body;

    const questionText = text && String(text).trim().length ? String(text).trim() : 'Sample question';

    session.questions.push({ text: questionText, topic });
    await session.save();

    res.status(200).json({
      questionIndex: session.questions.length - 1,
      question: session.questions[session.questions.length - 1],
      session
    });
  } catch (err) {
    next(err);
  }
}

async function submitAnswer(req, res, next) {
  try {
    const session = await InterviewSession.findById(req.params.id);

    if (!session) {
      res.status(404);
      throw new Error('Interview session not found');
    }

    if (String(session.userId) !== String(req.user._id)) {
      res.status(403);
      throw new Error('Forbidden');
    }

    if (session.status !== 'in-progress') {
      res.status(400);
      throw new Error('Interview session is not in progress');
    }

    const { questionIndex, text } = req.body;

    if (questionIndex < 0 || questionIndex >= session.questions.length) {
      res.status(400);
      throw new Error('Invalid questionIndex');
    }

    session.answers.push({ questionIndex, text });
    await session.save();

    res.status(200).json({ session });
  } catch (err) {
    next(err);
  }
}

async function evaluateAnswer(req, res, next) {
  try {
    const session = await InterviewSession.findById(req.params.id);

    if (!session) {
      res.status(404);
      throw new Error('Interview session not found');
    }

    if (String(session.userId) !== String(req.user._id)) {
      res.status(403);
      throw new Error('Forbidden');
    }

    const { score, feedback = '' } = req.body;

    session.scores.push(score);

    const validScores = session.scores.filter((s) => typeof s === 'number' && !Number.isNaN(s));
    if (validScores.length) {
      const avg = validScores.reduce((a, b) => a + b, 0) / validScores.length;
      session.overallScore = Math.round(avg * 100) / 100;
    }

    if (feedback) {
      session.feedback = feedback;
    }

    await session.save();

    res.status(200).json({ session });
  } catch (err) {
    next(err);
  }
}

async function endInterview(req, res, next) {
  try {
    const session = await InterviewSession.findById(req.params.id);

    if (!session) {
      res.status(404);
      throw new Error('Interview session not found');
    }

    if (String(session.userId) !== String(req.user._id)) {
      res.status(403);
      throw new Error('Forbidden');
    }

    const { duration = 0, status = 'completed' } = req.body;

    session.duration = duration;
    session.status = status;

    await session.save();

    res.status(200).json({ session });
  } catch (err) {
    next(err);
  }
}

async function getHistory(req, res, next) {
  try {
    const sessions = await InterviewSession.find({ userId: req.user._id })
      .sort({ createdAt: -1 })
      .limit(50);

    res.status(200).json({ sessions });
  } catch (err) {
    next(err);
  }
}

async function getReport(req, res, next) {
  try {
    const session = await InterviewSession.findById(req.params.id);

    if (!session) {
      res.status(404);
      throw new Error('Interview session not found');
    }

    if (String(session.userId) !== String(req.user._id)) {
      res.status(403);
      throw new Error('Forbidden');
    }

    res.status(200).json({
      report: {
        id: session._id,
        type: session.type,
        role: session.role,
        difficulty: session.difficulty,
        topics: session.topics,
        questionsCount: session.questions.length,
        answersCount: session.answers.length,
        overallScore: session.overallScore,
        duration: session.duration,
        status: session.status,
        feedback: session.feedback,
        createdAt: session.createdAt,
        updatedAt: session.updatedAt
      }
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  createInterview,
  getInterview,
  addQuestion,
  submitAnswer,
  evaluateAnswer,
  endInterview,
  getHistory,
  getReport
};
