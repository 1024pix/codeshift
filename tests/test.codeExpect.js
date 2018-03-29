const tap = require('tap');
const { replaceCodeExpect } = require('../rules/labRules.js');
const utilities = require('../helpers/utilities.js');

tap.test('can convert code.expect statements to tap', t => {
  const { ast, expectedText } = utilities.getTest('codeExpect.js');
  replaceCodeExpect(ast);
  const resultText = ast.toSource();
  console.log(resultText);
  // todo: strip eol and then match?
  t.match(resultText, expectedText);
  t.end();
});
