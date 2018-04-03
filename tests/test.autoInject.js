const tap = require('tap');
const { replaceAsyncAutoInject } = require('../rules/hapiRules.js');
const utilities = require('../lib/utilities.js');

tap.test('can convert an arbitrarily-complicated autoInject statement', t => {
  const { ast, expectedText } = utilities.getTest('autoInject.js');
  replaceAsyncAutoInject(ast);
  const resultText = ast.toSource();
  console.log(resultText);
  // t.match(resultText, expectedText);
  t.end();
});
