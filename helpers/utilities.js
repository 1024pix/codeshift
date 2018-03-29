// contains utilities that help with testing the rules and converting code

const codeshift = require('jscodeshift');
const fs = require('fs');
const path = require('path');

// turn a filepath into an AST tree:
function getAstFromFilePath(filepath) {
  const data = fs.readFileSync(filepath, 'utf-8');
  return codeshift(data);
}

function writeToFile(filepath, text) {
  fs.writeFileSync(filepath, text);
}

// used by testing:
const getTest = (fileName) => {
  const ast = getAstFromFilePath(path.join('tests', 'inputs', fileName));
  const expected = fs.readFileSync(path.join('tests', 'outputs', fileName)).toString('utf-8');
  return { ast, expected };
};

module.exports = { getAstFromFilePath, getTest };
