const codeshift = require('jscodeshift');

const replaceCallbacksInBody = require('./replaceCallbacksInBody.js');

const {
  getLastArgumentFromFunction,
} = require('../helpers/getHelpers.js');

// return a callback function transformed into await notation:
// eg func1(done) { myFunc(1234, done); } ----> await myFunc(1234);
// or func1(request, done) { done(null, request); } --- > request
module.exports = function replaceCallbackWithAwait(pathway, useCallback) {
  const func = pathway.value ? pathway.value : pathway;
  const lastArg = getLastArgumentFromFunction(func);
  if (useCallback) {
    // if last item is the return value:
    return codeshift.awaitExpression(lastArg);
  }
  // replace any occurences of the callback in the body:
  func.arguments = func.arguments.splice(0, func.arguments.length - 1);
  // sometimes the last arg is a function expression so that needs to be processed
  if (lastArg.type === 'Identifier') {
    replaceCallbacksInBody(func.body, lastArg.name);
  }
  // todo: handle if last arg is a function expression
  return codeshift.awaitExpression(func);
};
