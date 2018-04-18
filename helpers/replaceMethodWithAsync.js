const types = require('ast-types');
const codeshift = require('jscodeshift');


const {
  getFunctionNameFromFunctionExpression,
  getLastArgumentFromFunction,
  CallbackNames
} = require('../helpers/getHelpers.js');

const replaceCallbacksInBody = (body, callbackName) => {
  types.visit(body, {
    visitCallExpression(func) {
      // for any call to the callbackName, replace it with an awaitExpr
      // eg func1(done) { done(null, 'a value'); } --------> const func1 = 'a value';
      if (getFunctionNameFromFunctionExpression(func.value) === callbackName) {
        // if not called with args just nuke it:
        if (func.value.arguments.length === 0) {
          // removeReturnParent(func);
          func.replace();
          return false;
        }
        // if called with 1 arg that's an error:
        if (func.value.arguments.length === 1) {
          // replace the function with a throw:
          const replacement = codeshift.throwStatement(func.value.arguments[0]);
          if (func.parentPath.value.type === 'ReturnStatement') {
            func.parentPath.replace(replacement);
          } else {
            func.replace(replacement);
          }
          return false;
        }
        // if called with 2 args the 2nd arg is just returned
        // pop off the last arg and push it into a Return node:
        if (func.value.arguments.length === 2) {
          func.parentPath.replace(codeshift.returnStatement(func.value.arguments[1]));
          return false;
        }
      }
      // for any function expression that has the callback name as the last parameter, make it
      // a variableDeclaration, eg func1(done) { myFunc(1234, done); } ----> const func1 = await myFunc(1234);
      const expressionCallback = getLastArgumentFromFunction(func);
      if (expressionCallback.name && expressionCallback.name === callbackName) {
        func.value.arguments.pop();
        func.parentPath.replace(codeshift.returnStatement(func.value));
        return false;
      }
      return this.traverse(func);
    }
  });
};

// replace a class's method with an async version if needed
module.exports = function replaceCallbackWithAwait(pathway, useCallback) {
  const func = pathway.value ? pathway.value : pathway;
  // see if last param is a callback:
  const lastArg = getLastArgumentFromFunction(func);
  if (!lastArg || CallbackNames.includes(lastArg.name) === false) {
    return;
  }
  func.async = true;
  func.params = func.params.slice(0, func.params.length - 1);
  replaceCallbacksInBody(func.body, lastArg.name);
};
