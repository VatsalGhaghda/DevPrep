const CodingProblem = require('../models/CodingProblem');

async function listProblems(req, res, next) {
  try {
    const { difficulty, category, q } = req.query;

    const filter = {};
    if (difficulty) filter.difficulty = String(difficulty);
    if (category) filter.category = String(category);
    if (q) {
      filter.title = { $regex: String(q), $options: 'i' };
    }

    const problems = await CodingProblem.find(filter)
      .sort({ createdAt: -1 })
      .select('-testCases -solution')
      .limit(100);

    res.status(200).json({ problems });
  } catch (err) {
    next(err);
  }
}

async function getProblem(req, res, next) {
  try {
    const problem = await CodingProblem.findById(req.params.id).select('-solution');

    if (!problem) {
      res.status(404);
      throw new Error('Problem not found');
    }

    res.status(200).json({ problem });
  } catch (err) {
    next(err);
  }
}

async function submitSolution(req, res, next) {
  try {
    const problem = await CodingProblem.findById(req.params.id);

    if (!problem) {
      res.status(404);
      throw new Error('Problem not found');
    }

    const { language = 'javascript', code = '' } = req.body;

    res.status(200).json({
      message: 'Submission received (execution not implemented yet)',
      result: {
        problemId: problem._id,
        language,
        passed: false,
        totalTests: problem.testCases.length,
        passedTests: 0,
        output: null
      }
    });
  } catch (err) {
    next(err);
  }
}

async function runCode(req, res, next) {
  try {
    const problem = await CodingProblem.findById(req.params.id).select('_id');

    if (!problem) {
      res.status(404);
      throw new Error('Problem not found');
    }

    const { language = 'javascript', code = '', input = '' } = req.body;

    res.status(200).json({
      message: 'Run received (execution not implemented yet)',
      run: {
        problemId: problem._id,
        language,
        input,
        stdout: null,
        stderr: null
      }
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listProblems,
  getProblem,
  submitSolution,
  runCode
};
