const types = require('ast-types');
const codeshift = require('jscodeshift');

const {
  getFunctionNameFromFunctionExpression,
  getLastArgumentFromFunction
} = require('../helpers/getHelpers.js');

module.exports = (body, callbackName) => {
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
          // ??? does this need a 'return'?
          // if (func.parentPath.value.type !== 'ExpressionStatement') {
            func.parentPath.replace(func.value.arguments[1]);
          // }
          // console.log('toherwise');
          // console.log(func.parentPath.value);
          return false;
        }
      }
      // for any function expression that has the callback name as the last parameter, make it
      // a variableDeclaration, eg func1(done) { myFunc(1234, done); } ----> const func1 = await myFunc(1234);
      const expressionCallback = getLastArgumentFromFunction(func);
      if (expressionCallback.name && expressionCallback.name === callbackName) {
        func.value.arguments.pop();
        const newNode = func.parentPath.type === 'returnStatement' ? func.value : codeshift.returnStatement(func.value);
        func.parentPath.replace(newNode);
        return false;
      }
      return this.traverse(func);
    }
  });
};
