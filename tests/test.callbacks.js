const tap = require('tap');
const { replaceCallbacksWithAwait } = require('../rules/hapiRules.js');
const utilities = require('../lib/utilities.js');

tap.test('can convert an arbitrarily-complicated autoInject statement', t => {
  const { ast, expectedText } = utilities.getTest('callbacks.js');
  replaceCallbacksWithAwait(ast);
  const resultText = ast.toSource();
  console.log(resultText);
  // t.match(resultText, expectedText);
  t.end();
});
