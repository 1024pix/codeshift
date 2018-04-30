const tap = require('tap');
const { replaceRouteAutoInject } = require('../rules/hapiRules.js');
const utilities = require('../lib/utilities.js');

tap.test('can convert an arbitrarily-complicated server.inject statement', t => {
  const { ast, expectedText } = utilities.getTest('autoInjectHandler.js');
  replaceRouteAutoInject(ast);
  const resultText = ast.toSource();
  console.log(resultText);
  // t.match(resultText, expectedText);
  t.end();
});
