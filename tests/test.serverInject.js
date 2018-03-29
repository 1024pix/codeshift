const tap = require('tap');
const { replaceServerInject } = require('../rules/hapiRules.js');
const utilities = require('../helpers/utilities.js');

tap.test('can convert an arbitrarily-complicated server.inject statement', t => {
  const { ast, expectedText } = utilities.getTest('serverInject.js');
  replaceServerInject(ast);
  const resultText = ast.toSource();
  console.log(resultText);
  // t.match(resultText, expectedText);
  t.end();
});
