const tap = require('tape');
const { replaceReplyStub } = require('../rules/pixRules.js');
const utilities = require('../lib/utilities.js');

const fs = require('fs');

fs.readdirSync('tests/inputs/pix').forEach(fileName => {
  tap.test(`can convert ${fileName}`, t => {
    const { ast, expected } = utilities.getTest(`pix/${fileName}`);
    replaceReplyStub(ast);
    const resultText = ast.toSource();
    t.equal(resultText, expected);
    t.end();
  });
});
