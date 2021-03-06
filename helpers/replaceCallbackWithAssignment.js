const codeshift = require('jscodeshift');
const replaceCallbackWithAwait = require('./replaceCallbackWithAwait');

// assign a variable to a callback function with await notation
// eg func1(done) { myFunc(1234, done); } ----> const func1 = await myFunc(1234);
module.exports = function replaceCallbackWithAssignment(pathway, varType, varName, useCallback) {
  let awaitExpr = replaceCallbackWithAwait(pathway, useCallback);
  if (awaitExpr.argument.type === 'ObjectExpression') {
    awaitExpr = awaitExpr.argument;
  }
  const varAssign = codeshift.variableDeclaration(
    varType,
    [codeshift.variableDeclarator(codeshift.identifier(varName), awaitExpr)]
  );
  return varAssign;
};
