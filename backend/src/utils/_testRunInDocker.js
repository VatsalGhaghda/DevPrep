const { runCode } = require('./runInDocker');
async function test() {
  const result = await runCode({
    code: 'print("hello native executor")',
    language: 'python',
    input: ''
  });
  console.log(result);
}
test();
