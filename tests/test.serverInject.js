const tap = require('tap');
const { replaceServerInject } = require('../rules/hapiRules.js');
const utilities = require('../lib/utilities.js');

tap.test('can convert an arbitrarily-complicated server.inject statement', t => {
  const { ast, expected } = utilities.getTest('serverInject.js');
  replaceServerInject(ast);
  const resultText = ast.toSource();
  t.match(resultText, expected);
  t.end();
});
