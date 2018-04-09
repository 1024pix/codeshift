const codeshift = require('jscodeshift');

const {
  getLastArgumentFromFunction,
} = require('../helpers/getHelpers.js');

// return a callback function transformed into await notation:
// eg func1(done) { myFunc(1234, done); } ----> await myFunc(1234);
// or func1(request, done) { done(null, request); } --- > request
module.exports = function replaceCallbackWithAwait(pathway, useCallback) {
  const newArgs = [];
  const func = pathway.value ? pathway.value : pathway;
  const methodName = func.callee.type === 'MemberExpression' ? func.callee.property.name : func.callee.name;
  if (useCallback) {
    // if last item is the return value:
    const lastArg = getLastArgumentFromFunction(func);
    return codeshift.awaitExpression(lastArg);
  }
  func.arguments.forEach((arg, index) => {
    if (index < func.arguments.length - 1) {
      newArgs.push(arg);
    }
  });
  const call = codeshift.callExpression(codeshift.identifier(methodName), newArgs);
  if (func.callee) {
    call.callee = func.callee;
  }
  return codeshift.awaitExpression(call);
};
