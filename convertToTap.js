const { getAstFromFilePath } = require('./helpers/utilities.js');

// Tree Replacement Rules
// first part of each rule contains a find/filter directive to get the correct subtree
// second part of each rule is a replaceWith directive to modify the subtree

// rules to converts hapi < 17 to hapi 17:
const hapiReplacement = require('./rules/hapiRules.js');
// rules to convert lab tests to tap tests:
const labReplacement = require('./rules/labRules.js');

const convertLabFile = (ast) => {
  Object.values(labReplacement).forEach(rule => {
    rule(ast);
  });
  // console.log(ast.toSource());
};

const convertHapiFile = (ast) => {
  Object.values(hapiReplacement).forEach(rule => {
    rule(ast);
  });
};

const ast = getAstFromFilePath(process.argv[2]);
convertHapiFile(ast);
convertLabFile(ast);

// show the result if 'show' was on the command line:
if (process.argv[3] === 'show') {
  console.log(ast.toSource());
}
