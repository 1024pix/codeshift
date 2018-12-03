const tap = require('tape');
const pixRules = require('../rules/pixRules.js');
const utilities = require('../lib/utilities.js');

const fs = require('fs');

fs.readdirSync('tests/inputs/pix').forEach(fileName => {
  tap.test(`can convert ${fileName}`, t => {
    const { ast, expected } = utilities.getTest(`pix/${fileName}`);
    Object.values(pixRules).forEach((rule) => {
      rule(ast);
    });
    const resultText = ast.toSource();
    t.equal(resultText, expected);
    t.end();
  });
});
