function normalizeTopics(topics) {
  if (!Array.isArray(topics)) return [];
  return topics
    .map((t) => (typeof t === 'string' ? t.trim() : ''))
    .filter(Boolean)
    .slice(0, 10);
}

const { generateInterviewQuestions } = require('../utils/questionGeneration');
const SavedQuestion = require('../models/SavedQuestion');
const QuizAttempt = require('../models/QuizAttempt');
const { resolveUser } = require('../utils/resolveUser');
const { buildSecurityPolicy, recordViolation, securitySummary } = require('../utils/assessmentSecurity');

// Seconds allowed per question, by difficulty
const SECONDS_PER_QUESTION = { easy: 30, medium: 45, hard: 60 };

// Network latency allowance before a submission is marked late
const SUBMIT_GRACE_MS = 15 * 1000;

function normalizeQuestionKey(q) {
  return String(q || '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[^a-z0-9 ?.,-]/g, '')
    .trim();
}

const getOrCreateUserFromClerk = resolveUser;

/**
 * Upsert questions into the user's saved question bank.
 * Each question: { text, options, correctIndex, topic, explanation }
 */
async function upsertSavedQuestions(user, { role, difficulty, topics, questions }) {
  const safeTopics = normalizeTopics(topics);
  const safeRole = String(role || '').trim();
  const safeDifficulty = String(difficulty || '').trim();

  let saved = 0;
  let skipped = 0;

  for (const q of Array.isArray(questions) ? questions : []) {
    const text = q && typeof q.text === 'string' ? q.text.trim() : '';
    const questionKey = normalizeQuestionKey(text);
    if (!text || !questionKey) {
      skipped += 1;
      continue;
    }

    try {
      await SavedQuestion.updateOne(
        { userId: user._id, questionKey },
        {
          $set: { updatedAt: new Date() },
          $setOnInsert: {
            userId: user._id,
            role: safeRole,
            difficulty: safeDifficulty,
            topics: safeTopics,
            question: text,
            questionKey,
            options: Array.isArray(q.options) ? q.options : [],
            correctIndex: Number.isInteger(q.correctIndex) ? q.correctIndex : 0,
            topic: typeof q.topic === 'string' ? q.topic.trim() : '',
            explanation: typeof q.explanation === 'string' ? q.explanation.trim() : ''
          }
        },
        { upsert: true }
      );
      saved += 1;
    } catch (_) {
      skipped += 1;
    }
  }

  return { saved, skipped };
}

/**
 * Client view of a quiz attempt. Correct answers and explanations are only
 * included once the attempt can no longer be answered.
 */
function attemptView(attempt) {
  const revealAnswers = attempt.status === 'submitted' || attempt.status === 'terminated';

  return {
    id: attempt._id,
    role: attempt.role,
    difficulty: attempt.difficulty,
    topics: attempt.topics,
    status: attempt.status,
    timeLimitSec: attempt.timeLimitSec,
    startedAt: attempt.startedAt,
    expiresAt: attempt.expiresAt,
    submittedAt: attempt.submittedAt,
    late: attempt.late,
    retakeOf: attempt.retakeOf,
    questions: attempt.questions.map((q) => ({
      text: q.text,
      options: q.options,
      topic: q.topic,
      ...(revealAnswers ? { correctIndex: q.correctIndex, explanation: q.explanation } : {})
    })),
    ...(revealAnswers ? { answers: attempt.answers, score: attempt.score } : {}),
    security: securitySummary(attempt)
  };
}

function isPastDeadline(attempt, now = Date.now()) {
  return Boolean(attempt.status === 'active' && attempt.expiresAt && now > attempt.expiresAt.getTime() + SUBMIT_GRACE_MS);
}

/**
 * The server owns the quiz timer: an active attempt past its deadline (plus
 * grace) is closed with whatever was submitted (nothing), scoring 0.
 */
async function expireIfOverdue(attempt) {
  if (!isPastDeadline(attempt)) return false;
  attempt.answers = attempt.questions.map(() => null);
  attempt.score = { correct: 0, total: attempt.questions.length, pct: 0 };
  attempt.status = 'submitted';
  attempt.submittedAt = new Date();
  attempt.late = true;
  await attempt.save();
  return true;
}

async function loadOwnAttempt(req, res) {
  const user = await getOrCreateUserFromClerk(req);
  if (!user) {
    res.status(401).json({ message: 'Not authorized' });
    return null;
  }

  const attempt = await QuizAttempt.findById(req.params.id);
  if (!attempt) {
    res.status(404).json({ message: 'Quiz attempt not found' });
    return null;
  }

  if (String(attempt.userId) !== String(user._id)) {
    res.status(403).json({ message: 'Forbidden' });
    return null;
  }

  const expired = await expireIfOverdue(attempt);
  return { user, attempt, expired };
}

function createAttempt({ user, role, difficulty, topics, questions, retakeOf = null }) {
  const perQuestion = SECONDS_PER_QUESTION[String(difficulty || '').toLowerCase()] || 45;

  return QuizAttempt.create({
    userId: user._id,
    role,
    difficulty,
    topics,
    questions,
    answers: [],
    status: 'ready',
    timeLimitSec: questions.length * perQuestion,
    retakeOf,
    securityPolicy: buildSecurityPolicy()
  });
}

/* ───────── POST /generate ───────── */

async function generateQuestions(req, res, next) {
  try {
    const { role = 'Software Engineer', difficulty = 'Medium', topics = [], count = 10, excludeQuestions = [] } = req.body;

    const safeCount = Math.max(1, Math.min(Number(count) || 10, 20));
    const safeTopics = normalizeTopics(topics);
    const safeRole = String(role || '').trim();
    const safeDifficulty = String(difficulty || '').trim();

    const user = await getOrCreateUserFromClerk(req);
    if (!user) {
      return res.status(401).json({ message: 'Not authorized' });
    }

    const topicKey = safeTopics.length ? safeTopics[0] : '';
    const savedExcludes = (
      await SavedQuestion.find({
        userId: user._id,
        role: safeRole,
        difficulty: safeDifficulty,
        ...(topicKey ? { topics: topicKey } : {})
      })
        .sort({ createdAt: -1 })
        .limit(200)
    ).map((q) => q.question);

    const clientExcludes = Array.isArray(excludeQuestions)
      ? excludeQuestions
          .map((q) => (typeof q === 'string' ? q.trim() : ''))
          .filter(Boolean)
          .slice(0, 200)
      : [];

    const items = await generateInterviewQuestions({
      role: safeRole,
      difficulty: safeDifficulty,
      topics: safeTopics,
      count: safeCount,
      excludeQuestions: [...clientExcludes, ...savedExcludes]
    });

    const questions = items.map((q) => ({
      text: q.question,
      options: q.options,
      correctIndex: q.correctIndex,
      topic: q.topic,
      explanation: q.explanation
    }));

    const attempt = await createAttempt({
      user,
      role: safeRole,
      difficulty: safeDifficulty,
      topics: safeTopics,
      questions
    });

    // Keep the question bank (Recent Quizzes, duplicate avoidance) up to date.
    // Done server-side so answers never have to round-trip through the client.
    try {
      await upsertSavedQuestions(user, { role: safeRole, difficulty: safeDifficulty, topics: safeTopics, questions });
    } catch (_) {
      // Non-fatal: the attempt itself is already stored
    }

    return res.status(200).json({ attempt: attemptView(attempt) });
  } catch (err) {
    return next(err);
  }
}

/* ───────── POST /save ───────── */

async function saveQuestions(req, res, next) {
  try {
    const user = await getOrCreateUserFromClerk(req);
    if (!user) {
      return res.status(401).json({ message: 'Not authorized' });
    }

    const { role = '', difficulty = '', topics = [], questions = [] } = req.body;
    const result = await upsertSavedQuestions(user, { role, difficulty, topics, questions });

    return res.status(200).json(result);
  } catch (err) {
    return next(err);
  }
}

/* ───────── GET /saved/stats ───────── */

async function getSavedStats(req, res, next) {
  try {
    const user = await getOrCreateUserFromClerk(req);
    if (!user) {
      return res.status(401).json({ message: 'Not authorized' });
    }

    const totalSaved = await SavedQuestion.countDocuments({ userId: user._id });

    // Group saved questions into "quiz sessions" by role + difficulty + topic
    const recentQuizzes = await SavedQuestion.aggregate([
      { $match: { userId: user._id } },
      {
        $group: {
          _id: {
            role: '$role',
            difficulty: '$difficulty',
            topic: { $arrayElemAt: ['$topics', 0] }
          },
          count: { $sum: 1 },
          lastSavedAt: { $max: '$updatedAt' }
        }
      },
      { $sort: { lastSavedAt: -1 } },
      { $limit: 50 },
      {
        $project: {
          _id: 0,
          role: '$_id.role',
          difficulty: '$_id.difficulty',
          topic: '$_id.topic',
          count: 1,
          lastSavedAt: 1
        }
      }
    ]);

    return res.status(200).json({
      totalSaved,
      recentQuizzes
    });
  } catch (err) {
    return next(err);
  }
}

/* ───────── Quiz attempts ───────── */

async function getAttempt(req, res, next) {
  try {
    const loaded = await loadOwnAttempt(req, res);
    if (!loaded) return undefined;
    return res.status(200).json({ attempt: attemptView(loaded.attempt) });
  } catch (err) {
    return next(err);
  }
}

// POST /attempts/:id/start — starts the server-side timer
async function startAttempt(req, res, next) {
  try {
    const loaded = await loadOwnAttempt(req, res);
    if (!loaded) return undefined;
    const { attempt } = loaded;

    if (attempt.status === 'ready') {
      const now = new Date();
      attempt.status = 'active';
      attempt.startedAt = now;
      attempt.expiresAt = new Date(now.getTime() + attempt.timeLimitSec * 1000);
      await attempt.save();
    } else if (attempt.status !== 'active') {
      return res.status(409).json({ message: `Quiz attempt is ${attempt.status}`, attempt: attemptView(attempt) });
    }

    return res.status(200).json({ attempt: attemptView(attempt) });
  } catch (err) {
    return next(err);
  }
}

// POST /attempts/:id/submit — grades answers on the server
async function submitAttempt(req, res, next) {
  try {
    const loaded = await loadOwnAttempt(req, res);
    if (!loaded) return undefined;
    const { attempt, expired } = loaded;

    if (expired) {
      return res.status(409).json({
        message: 'Time ran out before these answers arrived, so they could not be accepted.',
        attempt: attemptView(attempt)
      });
    }

    if (attempt.status !== 'active') {
      return res.status(409).json({ message: `Quiz attempt is ${attempt.status}`, attempt: attemptView(attempt) });
    }

    const submitted = Array.isArray(req.body.answers) ? req.body.answers : [];
    const answers = attempt.questions.map((q, i) => {
      const a = submitted[i];
      return Number.isInteger(a) && a >= 0 && a < q.options.length ? a : null;
    });

    const correct = attempt.questions.reduce((acc, q, i) => acc + (answers[i] === q.correctIndex ? 1 : 0), 0);
    const total = attempt.questions.length;
    const now = new Date();

    attempt.answers = answers;
    attempt.score = { correct, total, pct: total ? Math.round((correct / total) * 100) : 0 };
    attempt.status = 'submitted';
    attempt.submittedAt = now;
    attempt.late = Boolean(attempt.expiresAt && now.getTime() > attempt.expiresAt.getTime() + SUBMIT_GRACE_MS);
    await attempt.save();

    return res.status(200).json({ attempt: attemptView(attempt) });
  } catch (err) {
    return next(err);
  }
}

// POST /attempts/:id/abandon
async function abandonAttempt(req, res, next) {
  try {
    const loaded = await loadOwnAttempt(req, res);
    if (!loaded) return undefined;
    const { attempt } = loaded;

    if (attempt.status === 'ready' || attempt.status === 'active') {
      attempt.status = 'abandoned';
      await attempt.save();
    }

    return res.status(200).json({ attempt: attemptView(attempt) });
  } catch (err) {
    return next(err);
  }
}

// POST /attempts/:id/retake — a fresh attempt with the same questions
async function retakeAttempt(req, res, next) {
  try {
    const loaded = await loadOwnAttempt(req, res);
    if (!loaded) return undefined;
    const { user, attempt } = loaded;

    if (attempt.status !== 'submitted') {
      return res.status(409).json({ message: 'Only a submitted quiz can be retaken' });
    }

    const retake = await createAttempt({
      user,
      role: attempt.role,
      difficulty: attempt.difficulty,
      topics: attempt.topics,
      questions: attempt.questions.map((q) => q.toObject()),
      retakeOf: attempt._id
    });

    return res.status(201).json({ attempt: attemptView(retake) });
  } catch (err) {
    return next(err);
  }
}

// POST /attempts/:id/violations
async function logAttemptViolation(req, res, next) {
  try {
    const loaded = await loadOwnAttempt(req, res);
    if (!loaded) return undefined;
    const { attempt } = loaded;

    if (attempt.status !== 'active') {
      return res.status(409).json({ message: `Quiz attempt is ${attempt.status}`, security: securitySummary(attempt) });
    }

    const { type, details } = req.body;
    const { shouldTerminate } = recordViolation(attempt, { type, details });
    if (shouldTerminate) {
      attempt.status = 'terminated';
      attempt.submittedAt = new Date();
    }
    await attempt.save();

    return res.status(200).json({ security: securitySummary(attempt), status: attempt.status });
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  generateQuestions,
  saveQuestions,
  getSavedStats,
  getAttempt,
  startAttempt,
  submitAttempt,
  abandonAttempt,
  retakeAttempt,
  logAttemptViolation
};
