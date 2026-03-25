require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const CodingProblem = require('../src/models/CodingProblem');

const MONGO_URI = process.env.MONGO_URI;

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

async function main() {
  console.log('Connecting to DB...');
  await mongoose.connect(MONGO_URI);
  
  const problems = await CodingProblem.find({ source: 'codeforces' });
  console.log(`Found ${problems.length} Codeforces problems.`);
  
  let updated = 0;
  for (const p of problems) {
    p.description = cleanMath(p.description);
    p.inputFormat = cleanMath(p.inputFormat);
    p.outputFormat = cleanMath(p.outputFormat);
    p.constraints = cleanMath(p.constraints);
    
    await p.save();
    updated++;
  }
  
  console.log(`Successfully cleaned MathJax formatting for ${updated} problems!`);
  await mongoose.disconnect();
  process.exit(0);
}

main().catch(console.error);
