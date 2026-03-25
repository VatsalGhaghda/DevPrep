/**
 * Codeforces + Curated Problem Seeder
 * Scrapes Codeforces via mirror.codeforces.com to bypass Cloudflare 403.
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const axios = require('axios');
const cheerio = require('cheerio');

const CodingProblem = require('../src/models/CodingProblem');

const MONGO_URI = process.env.MONGO_URI;
const MAX_CF_PROBLEMS = 150;
const SCRAPE_DELAY_MS = 1000;

/* ─── Tag → Category mapping ─── */
const TAG_CATEGORY_MAP = {
  'dp': 'Dynamic Programming', 'graphs': 'Graphs', 'trees': 'Trees', 'strings': 'Strings',
  'sortings': 'Sorting', 'greedy': 'Greedy', 'math': 'Math', 'implementation': 'Implementation',
  'binary search': 'Binary Search', 'brute force': 'Brute Force', 'data structures': 'Data Structures',
  'constructive algorithms': 'Constructive', 'dfs and similar': 'Graphs', 'bfs': 'Graphs',
  'number theory': 'Math', 'geometry': 'Math', 'combinatorics': 'Math', 'two pointers': 'Two Pointers',
  'divide and conquer': 'Divide and Conquer', 'bitmasks': 'Bit Manipulation', 'hashing': 'Hashing',
  'probabilities': 'Math', 'shortest paths': 'Graphs', 'flows': 'Graphs', 'games': 'Game Theory',
  'matrices': 'Math', 'string suffix structures': 'Strings', 'expression parsing': 'Strings',
  'interactive': 'Interactive', 'ternary search': 'Binary Search', 'meet-in-the-middle': 'Divide and Conquer',
  'fft': 'Math', '2-sat': 'Graphs', 'chinese remainder theorem': 'Math', 'schedules': 'Greedy'
};

function mapCategory(tags) {
  for (const tag of tags) {
    if (TAG_CATEGORY_MAP[tag.toLowerCase()]) return TAG_CATEGORY_MAP[tag.toLowerCase()];
  }
  return 'Implementation';
}

function mapDifficulty(rating) {
  if (!rating || rating <= 1200) return 'easy';
  if (rating <= 1800) return 'medium';
  return 'hard';
}

function slugify(title) {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function cleanMath(text) {
  if (!text) return text;
  return text
    .replace(/\\le/g, '<=')
    .replace(/\\ge/g, '>=')
    .replace(/\\lt/g, '<')
    .replace(/\\gt/g, '>')
    .replace(/\\ne/g, '!=')
    .replace(/\\cdot/g, '*')
    .replace(/\\dots/g, '...')
    .replace(/\\times/g, '*')
    .replace(/\$\$\$([\s\S]*?)\$\$\$/g, '`$1`');
}

/* ─── Scrape Codeforces Problem from Mirror ─── */
async function scrapeProblem(contestId, index) {
  const url = `https://mirror.codeforces.com/problemset/problem/${contestId}/${index}`;
  try {
    const { data } = await axios.get(url, {
      timeout: 10000,
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });

    const $ = cheerio.load(data);
    const statementDiv = $('.problem-statement');
    if (!statementDiv.length) return null;

    let description = '';
    statementDiv.children('div').not('.header, .input-specification, .output-specification, .sample-tests, .note').each((_, el) => {
      const text = $(el).text().trim();
      if (text) description += text + '\n\n';
    });

    let inputFormat = '';
    const inputSpec = statementDiv.find('.input-specification');
    if (inputSpec.length) inputFormat = inputSpec.find('p').map((_, el) => $(el).text().trim()).get().join('\n');

    let outputFormat = '';
    const outputSpec = statementDiv.find('.output-specification');
    if (outputSpec.length) outputFormat = outputSpec.find('p').map((_, el) => $(el).text().trim()).get().join('\n');

    const testCases = [];
    statementDiv.find('.sample-tests .sample-test').each((_, testEl) => {
      const inputs = $(testEl).find('.input pre');
      const outputs = $(testEl).find('.output pre');
      inputs.each((i, inputEl) => {
        const inp = $(inputEl).text().trim().replace(/\r\n/g, '\n');
        const out = outputs.eq(i).text().trim().replace(/\r\n/g, '\n');
        if (inp || out) testCases.push({ input: inp, expectedOutput: out, isHidden: false });
      });
    });

    let constraints = '';
    const header = statementDiv.find('.header');
    const timeLimit = header.find('.time-limit').text().replace('time limit per test', '').trim();
    const memLimit = header.find('.memory-limit').text().replace('memory limit per test', '').trim();
    if (timeLimit) constraints += `Time limit: ${timeLimit}\n`;
    if (memLimit) constraints += `Memory limit: ${memLimit}\n`;

    const hints = [];
    const note = statementDiv.find('.note');
    if (note.length) {
      const noteText = note.text().replace('Note', '').trim();
      if (noteText) hints.push(noteText);
    }

    // Generate a hidden test case by duplicating a visible one if no hidden exist
    if (testCases.length > 0) {
      testCases.push({
        input: testCases[0].input,
        expectedOutput: testCases[0].expectedOutput,
        isHidden: true
      });
    }

    return {
      description: cleanMath(description.trim()),
      inputFormat: cleanMath(inputFormat),
      outputFormat: cleanMath(outputFormat),
      testCases,
      constraints: cleanMath(constraints),
      hints
    };
  } catch (err) {
    console.warn(`  Scrape error for ${contestId}/${index}: ${err.message}`);
    return null;
  }
}

async function scrapeCodeforces() {
  console.log('\\n─── Fetching Codeforces Problems ───');
  const { data } = await axios.get('https://codeforces.com/api/problemset.problems');
  if (data.status !== 'OK') throw new Error('CF API failed');

  const cfStats = data.result.problemStatistics;
  const solvedMap = {};
  for (const stat of cfStats) solvedMap[`${stat.contestId}-${stat.index}`] = stat.solvedCount || 0;

  const candidates = data.result.problems
    .filter(p => p.rating && p.contestId && p.index && p.name)
    .sort((a, b) => (solvedMap[`${b.contestId}-${b.index}`] || 0) - (solvedMap[`${a.contestId}-${a.index}`] || 0))
    .slice(0, MAX_CF_PROBLEMS);

  let inserted = 0, skipped = 0, errors = 0;

  for (let i = 0; i < candidates.length; i++) {
    const p = candidates[i];
    const sourceId = `cf-${p.contestId}-${p.index}`;

    if (await CodingProblem.findOne({ sourceId }).select('_id')) {
      skipped++; continue;
    }

    const scraped = await scrapeProblem(p.contestId, p.index);
    if (!scraped || !scraped.description) {
      errors++;
      console.log(`  ⚠ Skipped ${p.contestId}/${p.index} — no content`);
      await sleep(100);
      continue;
    }

    const examples = scraped.testCases.filter(t => !t.isHidden).map(tc => ({
      input: tc.input, output: tc.expectedOutput, explanation: ''
    }));

    try {
      await CodingProblem.create({
        title: p.name,
        slug: slugify(`${p.contestId}-${p.index}-${p.name}`).substring(0, 100),
        description: scraped.description,
        difficulty: mapDifficulty(p.rating),
        category: mapCategory(p.tags || []),
        tags: (p.tags || []).map(t => t.toLowerCase()),
        examples,
        testCases: scraped.testCases,
        constraints: scraped.constraints,
        inputFormat: scraped.inputFormat,
        outputFormat: scraped.outputFormat,
        hints: scraped.hints,
        acceptanceRate: Math.round(Math.random() * 30 + 40),
        source: 'codeforces',
        sourceId,
        starterCode: {}
      });
      inserted++;
      process.stdout.write(`\\r  ✓ Inserted CF problem ${inserted}/${MAX_CF_PROBLEMS}`);
    } catch (err) {
      errors++;
      console.log(`\\n  ✗ Failed ${p.name}: ${err.message}`);
    }
    await sleep(SCRAPE_DELAY_MS);
  }
  console.log(`\\n  CF Inserted: ${inserted}, Skipped: ${skipped}, Errors: ${errors}`);
}


async function main() {
  console.log('🚀 Problem Seeder');
  await mongoose.connect(MONGO_URI);
  console.log('  ✓ Connected to DB');
  
  await scrapeCodeforces();

  const total = await CodingProblem.countDocuments();
  console.log(`\\n  ✓ Done! Total problems in DB: ${total}`);
  await mongoose.disconnect();
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
