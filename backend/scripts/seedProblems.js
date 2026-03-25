require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const CodingProblem = require('../src/models/CodingProblem');

const MONGO_URI = process.env.MONGO_URI;

/**
 * High-quality curated coding problems with full descriptions and test cases.
 * This bypasses bot-blocking tools like Cloudflare and provides a true LeetCode experience.
 */
const curatedProblems = [
  {
    title: 'Two Sum',
    difficulty: 'easy',
    category: 'Data Structures',
    tags: ['array', 'hash table'],
    description: `Given an array of integers \`nums\` and an integer \`target\`, return indices of the two numbers such that they add up to \`target\`.

You may assume that each input would have exactly one solution, and you may not use the same element twice.

You can return the answer in any order.`,
    inputFormat: 'The first line contains space-separated integers representing the array.\nThe second line contains a single integer representing the target.',
    outputFormat: 'Print two space-separated integers representing the indices.',
    constraints: '- `2 <= nums.length <= 10^4`\n- `-10^9 <= nums[i] <= 10^9`\n- `-10^9 <= target <= 10^9`\n- Only one valid answer exists.',
    hints: [
      'A really brute force way would be to search for all possible pairs of numbers but that would be too slow.',
      'Try to use a hash map to store the values you have already seen and their indices.'
    ],
    examples: [
      { input: '2 7 11 15\n9', output: '0 1', explanation: 'Because nums[0] + nums[1] == 9, we return 0 and 1.' },
      { input: '3 2 4\n6', output: '1 2', explanation: 'nums[1] + nums[2] == 6.' }
    ],
    testCases: [
      { input: '2 7 11 15\n9', expectedOutput: '0 1', isHidden: false },
      { input: '3 2 4\n6', expectedOutput: '1 2', isHidden: false },
      { input: '3 3\n6', expectedOutput: '0 1', isHidden: false },
      { input: '1 5 9 12 15\n21', expectedOutput: '2 3', isHidden: true },
      { input: '-3 4 3 90\n0', expectedOutput: '0 2', isHidden: true }
    ],
    starterCode: {
      javascript: `// Expected input format:
// Line 1: space separated array elements
// Line 2: target sum
const fs = require('fs');

function solve(input) {
  const lines = input.trim().split('\\n');
  const nums = lines[0].split(' ').map(Number);
  const target = Number(lines[1]);
  
  // Your code here
  
}

const input = fs.readFileSync('/dev/stdin', 'utf-8');
const result = solve(input);
if (result) console.log(result.join(' '));`,
      python: `import sys\n\ndef solve():\n    lines = sys.stdin.read().strip().split('\\n')\n    if len(lines) < 2: return\n    nums = list(map(int, lines[0].split()))\n    target = int(lines[1])\n    \n    # Your code here\n    \n\nsolve()\n`
    }
  },
  {
    title: 'Valid Parentheses',
    difficulty: 'easy',
    category: 'Data Structures',
    tags: ['string', 'stack'],
    description: `Given a string \`s\` containing just the characters \`'('\`, \`')'\`, \`'{'\`, \`'}'\`, \`'['\` and \`']'\`, determine if the input string is valid.

An input string is valid if:
1. Open brackets must be closed by the same type of brackets.
2. Open brackets must be closed in the correct order.
3. Every close bracket has a corresponding open bracket of the same type.`,
    inputFormat: 'A single line containing the string `s`.',
    outputFormat: 'Print "true" if the string is valid, otherwise print "false".',
    constraints: '- `1 <= s.length <= 10^4`\n- `s` consists of parentheses only.',
    hints: [
      'Use a stack to keep track of the opening brackets.',
      'When you encounter a closing bracket, check if it matches the top of the stack.'
    ],
    examples: [
      { input: '()', output: 'true', explanation: 'Simple matching parentheses.' },
      { input: '()[]{}', output: 'true', explanation: 'Multiple matching pairs.' },
      { input: '(]', output: 'false', explanation: 'Mismatched types.' }
    ],
    testCases: [
      { input: '()', expectedOutput: 'true', isHidden: false },
      { input: '()[]{}', expectedOutput: 'true', isHidden: false },
      { input: '(]', expectedOutput: 'false', isHidden: false },
      { input: '([{}])', expectedOutput: 'true', isHidden: true },
      { input: '((()', expectedOutput: 'false', isHidden: true },
      { input: ']', expectedOutput: 'false', isHidden: true }
    ],
    starterCode: {
      javascript: `const fs = require('fs');\n\nfunction solve(s) {\n  // Your code here\n  \n}\n\nconst input = fs.readFileSync('/dev/stdin', 'utf-8').trim();\nconsole.log(solve(input));`,
      python: `import sys\n\ndef solve():\n    s = sys.stdin.read().strip()\n    # Your code here\n    \n\nsolve()\n`
    }
  },
  {
    title: 'Maximum Subarray',
    difficulty: 'medium',
    category: 'Dynamic Programming',
    tags: ['array', 'divide and conquer', 'dynamic programming'],
    description: `Given an integer array \`nums\`, find the subarray with the largest sum, and return its sum.

A **subarray** is a contiguous non-empty sequence of elements within an array.`,
    inputFormat: 'A single line containing space-separated integers representing the array.',
    outputFormat: 'Print a single integer representing the maximum subarray sum.',
    constraints: '- `1 <= nums.length <= 10^5`\n- `-10^4 <= nums[i] <= 10^4`',
    hints: [
      "Kadane's algorithm is a classic way to solve this in O(N) time.",
      'Keep track of the current subarray sum and the maximum sum seen so far.'
    ],
    examples: [
      { input: '-2 1 -3 4 -1 2 1 -5 4', output: '6', explanation: 'The subarray [4,-1,2,1] has the largest sum 6.' },
      { input: '1', output: '1', explanation: 'The subarray [1] has the largest sum 1.' }
    ],
    testCases: [
      { input: '-2 1 -3 4 -1 2 1 -5 4', expectedOutput: '6', isHidden: false },
      { input: '1', expectedOutput: '1', isHidden: false },
      { input: '5 4 -1 7 8', expectedOutput: '23', isHidden: false },
      { input: '-5 -2 -9', expectedOutput: '-2', isHidden: true },
      { input: '10 -2 3 -1 6', expectedOutput: '16', isHidden: true }
    ],
    starterCode: {
      javascript: `const fs = require('fs');\n\nfunction solve(input) {\n  const nums = input.trim().split(' ').map(Number);\n  // Your code here\n  \n}\n\nconst input = fs.readFileSync('/dev/stdin', 'utf-8');\nconsole.log(solve(input));`,
      python: `import sys\n\ndef solve():\n    nums = list(map(int, sys.stdin.read().strip().split()))\n    # Your code here\n    \nsolve()\n`
    }
  },
  {
    title: 'Climbing Stairs',
    difficulty: 'easy',
    category: 'Dynamic Programming',
    tags: ['math', 'dynamic programming', 'memoization'],
    description: `You are climbing a staircase. It takes \`n\` steps to reach the top.

Each time you can either climb \`1\` or \`2\` steps. In how many distinct ways can you climb to the top?`,
    inputFormat: 'A single line containing the integer `n`.',
    outputFormat: 'A single integer representing the number of ways.',
    constraints: '- `1 <= n <= 45`',
    hints: [
      'To reach step N, you could have come from step N-1 or step N-2.',
      'This strongly resembles the Fibonacci sequence.'
    ],
    examples: [
      { input: '2', output: '2', explanation: '1. 1 step + 1 step\n2. 2 steps' },
      { input: '3', output: '3', explanation: '1. 1 step + 1 step + 1 step\n2. 1 step + 2 steps\n3. 2 steps + 1 step' }
    ],
    testCases: [
      { input: '2', expectedOutput: '2', isHidden: false },
      { input: '3', expectedOutput: '3', isHidden: false },
      { input: '5', expectedOutput: '8', isHidden: false },
      { input: '10', expectedOutput: '89', isHidden: true },
      { input: '45', expectedOutput: '1836311903', isHidden: true }
    ],
    starterCode: {
      javascript: `const fs = require('fs');\n\nfunction solve(n) {\n  // Your code here\n  \n}\n\nconst input = fs.readFileSync('/dev/stdin', 'utf-8').trim();\nconsole.log(solve(Number(input)));`,
      python: `import sys\n\ndef solve():\n    n = int(sys.stdin.read().strip())\n    # Your code here\n    \nsolve()\n`
    }
  },
  {
    title: 'Merge Intervals',
    difficulty: 'medium',
    category: 'Sorting',
    tags: ['array', 'sorting'],
    description: `Given an array of \`intervals\` where \`intervals[i] = [starti, endi]\`, merge all overlapping intervals, and return an array of the non-overlapping intervals that cover all the intervals in the input.`,
    inputFormat: 'The first line contains an integer N (number of intervals).\nThe next N lines each contain two space-separated integers representing an interval.',
    outputFormat: 'Print each merged interval on a new line as two space-separated integers.',
    constraints: '- `1 <= intervals.length <= 10^4`\n- `0 <= starti <= endi <= 10^4`',
    hints: [
      'Sort the intervals by their start points first.',
      'Iterate through the sorted intervals and maintain a "current" interval. If the next interval overlaps, extend the current interval.'
    ],
    examples: [
      { input: '4\n1 3\n2 6\n8 10\n15 18', output: '1 6\n8 10\n15 18', explanation: 'Intervals [1,3] and [2,6] overlap, so they merge into [1,6].' },
      { input: '2\n1 4\n4 5', output: '1 5', explanation: 'Intervals [1,4] and [4,5] overlap.' }
    ],
    testCases: [
      { input: '4\n1 3\n2 6\n8 10\n15 18', expectedOutput: '1 6\n8 10\n15 18', isHidden: false },
      { input: '2\n1 4\n4 5', expectedOutput: '1 5', isHidden: false },
      { input: '5\n1 4\n0 4\n6 8\n7 9\n10 12', expectedOutput: '0 4\n6 9\n10 12', isHidden: true },
      { input: '1\n1 4', expectedOutput: '1 4', isHidden: true }
    ],
    starterCode: {
      javascript: `const fs = require('fs');\n\nfunction solve(input) {\n  const lines = input.trim().split('\\n');\n  if (lines.length < 2) return;\n  const n = Number(lines[0]);\n  const intervals = lines.slice(1).map(line => line.split(' ').map(Number));\n  \n  // Your code here\n  \n}\n\nconst input = fs.readFileSync('/dev/stdin', 'utf-8');\nconst result = solve(input);\nif (Array.isArray(result)) {\n  result.forEach(interval => console.log(interval.join(' ')));\n}`,
      python: `import sys\n\ndef solve():\n    lines = sys.stdin.read().strip().split('\\n')\n    if len(lines) < 2: return\n    n = int(lines[0])\n    intervals = [list(map(int, line.split())) for line in lines[1:]]\n    \n    # Your code here\n    \nsolve()\n`
    }
  },
  {
    title: 'Valid Palindrome',
    difficulty: 'easy',
    category: 'Strings',
    tags: ['two pointers', 'string'],
    description: `A phrase is a **palindrome** if, after converting all uppercase letters into lowercase letters and removing all non-alphanumeric characters, it reads the same forward and backward. Alphanumeric characters include letters and numbers.

Given a string \`s\`, return \`true\` if it is a palindrome, or \`false\` otherwise.`,
    inputFormat: 'A single line containing the string `s`.',
    outputFormat: 'Print "true" if it is a palindrome, "false" otherwise.',
    constraints: '- `1 <= s.length <= 2 * 10^5`\n- `s` consists only of printable ASCII characters.',
    hints: [
      'You can use two pointers, one starting from the beginning and one from the end.',
      'Skip non-alphanumeric characters and compare the remaining characters ignoring case.'
    ],
    examples: [
      { input: 'A man, a plan, a canal: Panama', output: 'true', explanation: '"amanaplanacanalpanama" is a palindrome.' },
      { input: 'race a car', output: 'false', explanation: '"raceacar" is not a palindrome.' },
      { input: 'a', output: 'true', explanation: 'A single character is a valid palindrome.' }
    ],
    testCases: [
      { input: 'A man, a plan, a canal: Panama', expectedOutput: 'true', isHidden: false },
      { input: 'race a car', expectedOutput: 'false', isHidden: false },
      { input: 'a', expectedOutput: 'true', isHidden: false },
      { input: '0P', expectedOutput: 'false', isHidden: true },
      { input: 'Was it a car or a cat I saw?', expectedOutput: 'true', isHidden: true }
    ],
    starterCode: {
      javascript: `const fs = require('fs');\n\nfunction solve(s) {\n  // Your code here\n  \n}\n\nconst input = fs.readFileSync('/dev/stdin', 'utf-8').trim();\nconsole.log(solve(input));`,
      python: `import sys\n\ndef solve():\n    s = sys.stdin.read().strip()\n    # Your code here\n    \nsolve()\n`
    }
  },
  {
    title: 'Find Minimum in Rotated Sorted Array',
    difficulty: 'medium',
    category: 'Binary Search',
    tags: ['array', 'binary search'],
    description: `Suppose an array of length \`n\` sorted in ascending order is rotated between \`1\` and \`n\` times. For example, the array \`nums = [0,1,2,4,5,6,7]\` might become:
- \`[4,5,6,7,0,1,2]\` if it was rotated 4 times.
- \`[0,1,2,4,5,6,7]\` if it was rotated 7 times.

Notice that rotating an array \`[a[0], a[1], a[2], ..., a[n-1]]\` 1 time results in the array \`[a[n-1], a[0], a[1], a[2], ..., a[n-2]]\`.

Given the sorted rotated array \`nums\` of **unique** elements, return the minimum element of this array.

You must write an algorithm that runs in \`O(log n)\` time.`,
    inputFormat: 'A single line containing space-separated integers representing the rotated array.',
    outputFormat: 'Print a single integer representing the minimum element.',
    constraints: '- `1 <= nums.length <= 5000`\n- `-5000 <= nums[i] <= 5000`\n- All elements are unique.',
    hints: [
      'Because you need O(log n) time, think about Binary Search.',
      'Compare the middle element to the rightmost element to determine which half is sorted and which half contains the pivot.'
    ],
    examples: [
      { input: '3 4 5 1 2', output: '1', explanation: 'The original array was [1,2,3,4,5] rotated 3 times.' },
      { input: '4 5 6 7 0 1 2', output: '0', explanation: 'The original array was [0,1,2,4,5,6,7] and it was rotated 4 times.' },
      { input: '11 13 15 17', output: '11', explanation: 'The original array was [11,13,15,17] and it was rotated 4 times.' }
    ],
    testCases: [
      { input: '3 4 5 1 2', expectedOutput: '1', isHidden: false },
      { input: '4 5 6 7 0 1 2', expectedOutput: '0', isHidden: false },
      { input: '11 13 15 17', expectedOutput: '11', isHidden: false },
      { input: '2 1', expectedOutput: '1', isHidden: true },
      { input: '5 1 2 3 4', expectedOutput: '1', isHidden: true }
    ],
    starterCode: {
      javascript: `const fs = require('fs');\n\nfunction solve(input) {\n  const nums = input.trim().split(' ').map(Number);\n  // Your code here\n  \n}\n\nconst input = fs.readFileSync('/dev/stdin', 'utf-8');\nconsole.log(solve(input));`,
      python: `import sys\n\ndef solve():\n    nums = list(map(int, sys.stdin.read().strip().split()))\n    # Your code here\n    \nsolve()\n`
    }
  },
  {
    title: 'Container With Most Water',
    difficulty: 'medium',
    category: 'Two Pointers',
    tags: ['array', 'two pointers', 'greedy'],
    description: `You are given an integer array \`height\` of length \`n\`. There are \`n\` vertical lines drawn such that the two endpoints of the \`i\`th line are \`(i, 0)\` and \`(i, height[i])\`.

Find two lines that together with the x-axis form a container, such that the container contains the most water.

Return the maximum amount of water a container can store.

*Notice that you may not slant the container.*`,
    inputFormat: 'A single line containing space-separated integers representing the height array.',
    outputFormat: 'Print a single integer representing the maximum water area.',
    constraints: '- `2 <= height.length <= 10^5`\n- `0 <= height[i] <= 10^4`',
    hints: [
      'The area depends on the distance between the lines and the shorter line.',
      'Start with the maximum distance (pointers at start and end) and move the pointer that points to the shorter line inward.'
    ],
    examples: [
      { input: '1 8 6 2 5 4 8 3 7', output: '49', explanation: 'The max area is formed by vertical line at index 1 (height 8) and index 8 (height 7). Area = min(8,7) * (8-1) = 7 * 7 = 49.' },
      { input: '1 1', output: '1', explanation: 'Min(1,1) * 1 = 1.' }
    ],
    testCases: [
      { input: '1 8 6 2 5 4 8 3 7', expectedOutput: '49', isHidden: false },
      { input: '1 1', expectedOutput: '1', isHidden: false },
      { input: '4 3 2 1 4', expectedOutput: '16', isHidden: true },
      { input: '1 2 1', expectedOutput: '2', isHidden: true }
    ],
    starterCode: {
      javascript: `const fs = require('fs');\n\nfunction solve(input) {\n  const height = input.trim().split(' ').map(Number);\n  // Your code here\n  \n}\n\nconst input = fs.readFileSync('/dev/stdin', 'utf-8');\nconsole.log(solve(input));`,
      python: `import sys\n\ndef solve():\n    height = list(map(int, sys.stdin.read().strip().split()))\n    # Your code here\n    \nsolve()\n`
    }
  }
];

function slugify(title) {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

async function main() {
  console.log('🚀 Curated Problems Seeder');
  console.log('  Connecting to MongoDB...');

  await mongoose.connect(MONGO_URI);
  console.log('  ✓ Connected');
  
  // Optional: clear old Codeforces problems
  const res = await CodingProblem.deleteMany({ source: 'codeforces' });
  console.log(`  Cleaned up ${res.deletedCount} incomplete Codeforces problems.`);

  let inserted = 0;
  let skipped = 0;

  for (const problem of curatedProblems) {
    const sourceId = `curated-${slugify(problem.title)}`;

    const existing = await CodingProblem.findOne({ sourceId }).select('_id');
    if (existing) {
      skipped++;
      continue;
    }

    try {
      await CodingProblem.create({
        ...problem,
        slug: slugify(problem.title),
        acceptanceRate: Math.round(Math.random() * 30 + 40),
        source: 'devprep-curated',
        sourceId
      });
      inserted++;
      console.log(`  ✓ Inserted: ${problem.title}`);
    } catch (err) {
      console.error(`  ✗ Failed: ${problem.title} (${err.message})`);
    }
  }

  console.log('\n─── Summary ───');
  console.log(`  Inserted: ${inserted}`);
  console.log(`  Skipped (already exist): ${skipped}`);

  await mongoose.disconnect();
  console.log('  ✓ Done');
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
