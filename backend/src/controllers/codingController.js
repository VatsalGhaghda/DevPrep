const CodingProblem = require('../models/CodingProblem');
const { escapeRegex } = require('../utils/escapeRegex');
const CodingAttempt = require('../models/CodingAttempt');
const Submission = require('../models/Submission');
const { resolveUser } = require('../utils/resolveUser');
const { runAgainstTestCases, executeCode } = require('../utils/judgeService');
const { buildSecurityPolicy, recordViolation, securitySummary } = require('../utils/assessmentSecurity');

/* ───────── helpers ───────── */


/**
 * Bump a problem's submission counters and recompute its acceptance rate in a
 * single atomic update, so concurrent submissions can't leave it wrong.
 */
async function recordProblemSubmission(problemId, accepted) {
  await CodingProblem.updateOne(
    { _id: problemId },
    [
      {
        $set: {
          totalSubmissions: { $add: [{ $ifNull: ['$totalSubmissions', 0] }, 1] },
          totalAccepted: { $add: [{ $ifNull: ['$totalAccepted', 0] }, accepted ? 1 : 0] }
        }
      },
      {
        $set: {
          acceptanceRate: {
            $round: [{ $multiply: [{ $divide: ['$totalAccepted', '$totalSubmissions'] }, 100] }, 0]
          }
        }
      }
    ],
    { updatePipeline: true }
  );
}

function attemptView(attempt) {
  return {
    id: attempt._id,
    problemId: attempt.problemId,
    status: attempt.status,
    startedAt: attempt.startedAt,
    endedAt: attempt.endedAt,
    submissionCount: attempt.submissionCount,
    accepted: attempt.accepted,
    security: securitySummary(attempt)
  };
}

/**
 * Look up the caller's attempt for a problem and make sure code may still be
 * run or submitted in it. Sends the error response itself and returns null
 * when the request must stop.
 */
async function requireActiveAttempt(req, res, { user, problemId, attemptId }) {
  if (!attemptId) {
    res.status(400).json({ message: 'attemptId is required. Reload the problem to start an attempt.' });
    return null;
  }

  const attempt = await CodingAttempt.findById(attemptId);
  if (!attempt || String(attempt.userId) !== String(user._id) || String(attempt.problemId) !== String(problemId)) {
    res.status(404).json({ message: 'Coding attempt not found' });
    return null;
  }

  if (attempt.status !== 'active') {
    res.status(409).json({ message: 'This attempt was terminated for assessment violations', attempt: attemptView(attempt) });
    return null;
  }

  return attempt;
}

/* ───────── GET /problems ───────── */

async function listProblems(req, res, next) {
  try {
    const {
      difficulty,
      category,
      tags,
      q,
      page = 1,
      limit = 20,
      sort = 'recent'
    } = req.query;

    const filter = {};
    if (difficulty) filter.difficulty = String(difficulty);
    if (category) filter.category = { $regex: `^${escapeRegex(category)}$`, $options: 'i' };
    if (tags) {
      const tagList = String(tags).split(',').map((t) => t.trim()).filter(Boolean);
      if (tagList.length) filter.tags = { $in: tagList };
    }
    if (q) {
      const escaped = escapeRegex(q);
      filter.$or = [
        { title: { $regex: escaped, $options: 'i' } },
        { tags: { $regex: escaped, $options: 'i' } },
        { category: { $regex: escaped, $options: 'i' } }
      ];
    }

    // Sort options
    let sortObj = { createdAt: -1 };
    if (sort === 'difficulty') {
      sortObj = { difficulty: 1, createdAt: -1 };
    } else if (sort === 'popularity') {
      sortObj = { acceptanceRate: -1, createdAt: -1 };
    }

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(50, Math.max(1, parseInt(limit, 10) || 20));
    const skip = (pageNum - 1) * limitNum;

    const [problems, total] = await Promise.all([
      CodingProblem.find(filter)
        .sort(sortObj)
        .select('title slug difficulty category tags acceptanceRate totalSubmissions createdAt source sourceId')
        .skip(skip)
        .limit(limitNum)
        .lean(),
      CodingProblem.countDocuments(filter)
    ]);

    // Get user completion status for these problems
    const user = await resolveUser(req);
    let statusMap = {};
    if (user) {
      const problemIds = problems.map((p) => p._id);
      const submissions = await Submission.find({
        $or: [
          { userId: user._id, problemId: { $in: problemIds }, isDraft: false },
          { clerkUserId: user.clerkUserId || '___', problemId: { $in: problemIds }, isDraft: false }
        ]
      })
        .select('problemId status')
        .lean();

      for (const sub of submissions) {
        const pid = String(sub.problemId);
        if (sub.status === 'accepted') {
          statusMap[pid] = 'accepted';
        } else if (!statusMap[pid]) {
          statusMap[pid] = 'attempted';
        }
      }
    }

    const enriched = problems.map((p) => ({
      ...p,
      userStatus: statusMap[String(p._id)] || 'not_attempted'
    }));

    res.status(200).json({
      problems: enriched,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum)
      }
    });
  } catch (err) {
    next(err);
  }
}

/* ───────── GET /problems/:id ───────── */

async function getProblem(req, res, next) {
  try {
    const problem = await CodingProblem.findById(req.params.id)
      .select('-solution')
      .lean();

    if (!problem) {
      res.status(404);
      throw new Error('Problem not found');
    }

    // Filter out hidden test cases
    if (problem.testCases) {
      problem.testCases = problem.testCases.filter((tc) => !tc.isHidden);
    }

    // Get user's latest draft if exists
    const user = await resolveUser(req);
    let draft = null;
    if (user) {
      draft = await Submission.findOne({
        $or: [
          { userId: user._id, problemId: problem._id, isDraft: true },
          { clerkUserId: user.clerkUserId || '___', problemId: problem._id, isDraft: true }
        ]
      })
        .sort({ updatedAt: -1 })
        .select('code language updatedAt')
        .lean();
    }

    // Convert starterCode Map to plain object
    let starterCode = {};
    if (problem.starterCode) {
      if (problem.starterCode instanceof Map) {
        starterCode = Object.fromEntries(problem.starterCode);
      } else if (typeof problem.starterCode === 'object') {
        starterCode = problem.starterCode;
      }
    }

    res.status(200).json({
      problem: {
        ...problem,
        starterCode
      },
      draft
    });
  } catch (err) {
    next(err);
  }
}

/* ───────── POST /problems/:id/run ───────── */

async function runCode(req, res, next) {
  try {
    const problem = await CodingProblem.findById(req.params.id).lean();

    if (!problem) {
      res.status(404);
      throw new Error('Problem not found');
    }

    const user = await resolveUser(req);
    if (!user) {
      res.status(401);
      throw new Error('Not authorized');
    }

    const { language = 'javascript', code = '', customInput, attemptId } = req.body;

    const attempt = await requireActiveAttempt(req, res, { user, problemId: problem._id, attemptId });
    if (!attempt) return undefined;
    attempt.lastActivityAt = new Date();
    await attempt.save();

    // If custom input is provided, run with that single input
    if (customInput !== undefined && customInput !== null) {
      const result = await executeCode(language, code, String(customInput));
      return res.status(200).json({
        run: {
          problemId: problem._id,
          language,
          results: [
            {
              input: String(customInput),
              actualOutput: (result.stdout || '').trim(),
              expectedOutput: null,
              passed: null,
              status: result.status,
              time: result.time,
              memory: result.memory,
              stderr: result.stderr,
              compileOutput: result.compileOutput
            }
          ],
          passedCount: null,
          totalCount: 1
        }
      });
    }

    // Run against sample test cases only (non-hidden)
    const sampleTests = (problem.testCases || []).filter((tc) => !tc.isHidden);
    if (!sampleTests.length) {
      return res.status(200).json({
        run: {
          problemId: problem._id,
          language,
          results: [],
          passedCount: 0,
          totalCount: 0,
          message: 'No sample test cases available'
        }
      });
    }

    const { results, passedCount, totalCount } = await runAgainstTestCases(
      language,
      code,
      sampleTests
    );

    res.status(200).json({
      run: {
        problemId: problem._id,
        language,
        results,
        passedCount,
        totalCount
      }
    });
  } catch (err) {
    next(err);
  }
}

/* ───────── POST /problems/:id/submit ───────── */

async function submitSolution(req, res, next) {
  try {
    const problem = await CodingProblem.findById(req.params.id).lean();

    if (!problem) {
      res.status(404);
      throw new Error('Problem not found');
    }

    const user = await resolveUser(req);
    if (!user) {
      res.status(401);
      throw new Error('Not authorized');
    }

    const { language = 'javascript', code = '', attemptId } = req.body;

    const attempt = await requireActiveAttempt(req, res, { user, problemId: problem._id, attemptId });
    if (!attempt) return undefined;

    // Run against ALL test cases (including hidden)
    const allTests = problem.testCases || [];
    if (!allTests.length) {
      return res.status(422).json({ message: 'This problem has no test cases yet, so it cannot be judged.' });
    }

    const { results, passedCount, totalCount, overallStatus } =
      await runAgainstTestCases(language, code, allTests);

    // Termination may have happened while the tests were running
    const current = await CodingAttempt.findById(attempt._id);
    if (!current || current.status !== 'active') {
      return res.status(409).json({
        message: 'This attempt was terminated for assessment violations',
        attempt: current ? attemptView(current) : null
      });
    }

    current.submissionCount += 1;
    if (overallStatus === 'accepted') current.accepted = true;
    current.lastActivityAt = new Date();
    await current.save();

    // Save submission
    const submission = await Submission.create({
      userId: user._id,
      clerkUserId: user.clerkUserId || '',
      problemId: problem._id,
      attemptId: current._id,
      language,
      code,
      status: overallStatus,
      passedTests: passedCount,
      totalTests: totalCount,
      runtime: results[0]?.time || '0',
      memory: results[0]?.memory || '0',
      errorOutput: results.find((r) => r.stderr || r.compileOutput)?.stderr ||
        results.find((r) => r.compileOutput)?.compileOutput || '',
      isDraft: false
    });

    await recordProblemSubmission(problem._id, overallStatus === 'accepted');

    // Return result — do NOT expose hidden test case inputs/expected outputs
    const safeResults = results.map((r, i) => {
      const isHidden = allTests[i]?.isHidden;
      return {
        passed: r.passed,
        status: r.status,
        time: r.time,
        memory: r.memory,
        ...(isHidden
          ? {}
          : {
              input: r.input,
              expectedOutput: r.expectedOutput,
              actualOutput: r.actualOutput
            }),
        stderr: r.stderr,
        compileOutput: r.compileOutput
      };
    });

    res.status(200).json({
      message: overallStatus === 'accepted' ? 'All test cases passed!' : 'Some test cases failed',
      result: {
        submissionId: submission._id,
        problemId: problem._id,
        language,
        status: overallStatus,
        passedTests: passedCount,
        totalTests: totalCount,
        runtime: results[0]?.time || '0',
        memory: results[0]?.memory || '0',
        results: safeResults
      }
    });
  } catch (err) {
    next(err);
  }
}

/* ───────── POST /problems/:id/save-draft ───────── */

async function saveDraft(req, res, next) {
  try {
    const problem = await CodingProblem.findById(req.params.id).select('_id').lean();

    if (!problem) {
      res.status(404);
      throw new Error('Problem not found');
    }

    const user = await resolveUser(req);
    if (!user) {
      res.status(401);
      throw new Error('Not authorized');
    }

    const { language = 'javascript', code = '' } = req.body;

    const draft = await Submission.findOneAndUpdate(
      {
        userId: user._id,
        problemId: problem._id,
        isDraft: true
      },
      {
        userId: user._id,
        clerkUserId: user.clerkUserId || '',
        problemId: problem._id,
        language,
        code,
        status: 'draft',
        isDraft: true
      },
      { upsert: true, new: true }
    );

    res.status(200).json({
      message: 'Draft saved',
      draft: {
        _id: draft._id,
        language: draft.language,
        updatedAt: draft.updatedAt
      }
    });
  } catch (err) {
    next(err);
  }
}

/* ───────── GET /problems/:id/status ───────── */

async function getUserStatus(req, res, next) {
  try {
    const user = await resolveUser(req);
    if (!user) {
      res.status(401);
      throw new Error('Not authorized');
    }

    const submissions = await Submission.find({
      userId: user._id,
      problemId: req.params.id,
      isDraft: false
    })
      .sort({ createdAt: -1 })
      .limit(20)
      .select('language status passedTests totalTests runtime memory createdAt')
      .lean();

    const hasAccepted = submissions.some((s) => s.status === 'accepted');

    res.status(200).json({
      status: hasAccepted ? 'accepted' : submissions.length ? 'attempted' : 'not_attempted',
      submissions
    });
  } catch (err) {
    next(err);
  }
}

/* ───────── POST /problems/:id/attempts ───────── */

// Resumes the caller's active attempt for this problem, or starts a new one.
// Resuming keeps the violation count, so reloading the page does not reset it.
async function startAttempt(req, res, next) {
  try {
    const problem = await CodingProblem.findById(req.params.id).select('_id').lean();
    if (!problem) {
      res.status(404);
      throw new Error('Problem not found');
    }

    const user = await resolveUser(req);
    if (!user) {
      res.status(401);
      throw new Error('Not authorized');
    }

    let attempt = await CodingAttempt.findOne({ userId: user._id, problemId: problem._id, status: 'active' })
      .sort({ createdAt: -1 });

    let created = false;
    if (!attempt) {
      attempt = await CodingAttempt.create({
        userId: user._id,
        problemId: problem._id,
        securityPolicy: buildSecurityPolicy()
      });
      created = true;
    }

    res.status(created ? 201 : 200).json({ attempt: attemptView(attempt) });
  } catch (err) {
    next(err);
  }
}

/* ───────── POST /attempts/:attemptId/violations ───────── */

async function logAttemptViolation(req, res, next) {
  try {
    const user = await resolveUser(req);
    if (!user) {
      res.status(401);
      throw new Error('Not authorized');
    }

    const attempt = await CodingAttempt.findById(req.params.attemptId);
    if (!attempt || String(attempt.userId) !== String(user._id)) {
      return res.status(404).json({ message: 'Coding attempt not found' });
    }

    if (attempt.status !== 'active') {
      return res.status(409).json({ message: `Coding attempt is ${attempt.status}`, security: securitySummary(attempt) });
    }

    const { type, details } = req.body;
    const { shouldTerminate } = recordViolation(attempt, { type, details });
    if (shouldTerminate) {
      attempt.status = 'terminated';
      attempt.endedAt = new Date();
    }
    await attempt.save();

    return res.status(200).json({ security: securitySummary(attempt), status: attempt.status });
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  listProblems,
  getProblem,
  submitSolution,
  runCode,
  saveDraft,
  getUserStatus,
  startAttempt,
  logAttemptViolation,
  requireActiveAttempt,
  attemptView,
  recordProblemSubmission
};
